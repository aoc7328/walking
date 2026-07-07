import { db, ACTIVE_TRIP_ID_KEY } from './schema';
import type { Trip } from '../types/trip';
import { toISODate } from '../utils/date';
import { getUserId } from '../services/identity';
import { isAccountMigrationDone, markAccountMigrationDone, getLegacyUserId } from '../services/auth';

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite: Trip | null = null;
const DEBOUNCE_MS = 1000;

const MIGRATION_FLAG_KEY = 'walking.migratedToKV';

export function getActiveTripId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TRIP_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveTripId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_TRIP_ID_KEY, id);
  } catch {
    // ignore
  }
}

function apiUrl(path: string): string {
  const userId = getUserId();
  const sep = path.includes('?') ? '&' : '?';
  return `/api/trips${path}${sep}u=${userId}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** 跟 KV 拿目前 active 的 trip。沒設過 active → 拉清單第一筆。都沒有回 null。 */
export async function loadActiveTrip(): Promise<Trip | null> {
  const id = getActiveTripId();
  if (id) {
    try {
      const trip = await apiFetch<Trip>(`/${encodeURIComponent(id)}`);
      return trip;
    } catch {
      // GET 失敗（暫時性錯誤或真的不存在）→ 往下用清單嘗試，但優先沿用原本的 active
    }
  }
  try {
    const trips = await apiFetch<Trip[]>('');
    if (trips.length > 0) {
      // 原本的 active 還在清單裡就沿用，別因為剛才那次 GET 暫時性失敗（500/離線）就默默換成別的行程
      const keep = id ? trips.find((t) => t.id === id) : undefined;
      if (keep) return keep;
      setActiveTripId(trips[0]!.id);
      return trips[0]!;
    }
  } catch {
    // 後端壞、沒連線
  }
  return null;
}

export async function listAllTrips(): Promise<Trip[]> {
  try {
    return await apiFetch<Trip[]>('');
  } catch {
    return [];
  }
}

/** 從 KV 取單一 trip，失敗回 null。給 trip 切換用。 */
export async function loadTripById(id: string): Promise<Trip | null> {
  try {
    return await apiFetch<Trip>(`/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function deleteTripFromDB(id: string): Promise<void> {
  await apiFetch(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function persistTripDebounced(trip: Trip): void {
  pendingWrite = trip;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const t = pendingWrite;
    pendingWrite = null;
    writeTimer = null;
    if (t) void putTripToKV(t);
  }, DEBOUNCE_MS);
}

export async function persistTripImmediate(trip: Trip): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  pendingWrite = null;
  await putTripToKV(trip);
}

/**
 * 寫進雲端 / 本地備份前，剝掉「不進持久化」的暫存欄位。
 * 目前是 Visit Japan Web 入境 QR 圖：base64 很大（會撞後端 500KB 上限），且屬一次性
 *（上傳 → 下載 JPG / 列印 → 用完即丟），刻意不存。記憶體裡的 trip 仍保留，當下照樣能下載/列印。
 */
function stripEphemeral(trip: Trip): Trip {
  if (!trip.ledger || trip.ledger.vjw === undefined) return trip;
  const ledger = { ...trip.ledger };
  delete ledger.vjw;
  return { ...trip, ledger };
}

async function putTripToKV(trip: Trip): Promise<void> {
  try {
    await apiFetch(`/${encodeURIComponent(trip.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stripEphemeral(trip)),
    });
  } catch (err) {
    console.error('[walking] 行程同步到 KV 失敗:', err);
    throw err;
  }
}

/**
 * 第一次啟用 KV 模式時，把舊版 IndexedDB 裡的行程一次性上傳到 KV。
 * 成功上傳的不刪除 IndexedDB（保留當地備份）。
 */
export async function migrateLocalTripsToKV(): Promise<{ migrated: number; failed: number }> {
  let migrated = 0;
  let failed = 0;
  try {
    if (localStorage.getItem(MIGRATION_FLAG_KEY)) {
      return { migrated: 0, failed: 0 };
    }
    const localTrips = await db.trips.toArray();
    for (const trip of localTrips) {
      try {
        await putTripToKV(trip);
        migrated += 1;
      } catch {
        failed += 1;
      }
    }
    // 只有全部成功才標記完成；若整段離線導致全失敗，留著旗標下次重試，避免永久漏遷移
    if (failed === 0) {
      localStorage.setItem(MIGRATION_FLAG_KEY, String(Date.now()));
    }
  } catch (err) {
    console.error('[walking] migration error:', err);
  }
  return { migrated, failed };
}

/**
 * 帳號系統上線後，把舊 UUID 命名空間（KV）裡的行程搬到新帳號雜湊命名空間。
 * 同時補做 Dexie → KV 的遷移（避免該裝置從沒上過 KV）。
 * 一次性，靠 `walking.migratedToAccount` flag 防止重跑。
 */
export async function migrateAccountData(): Promise<{ migrated: number; failed: number }> {
  if (isAccountMigrationDone()) return { migrated: 0, failed: 0 };
  let migrated = 0;
  let failed = 0;

  // 取目前 KV 已有的行程 id 集合，避免重複 PUT
  let existingIds: Set<string>;
  try {
    const current = await apiFetch<Trip[]>('');
    existingIds = new Set(current.map((t) => t.id));
  } catch {
    existingIds = new Set();
  }

  // (a) 從舊 UUID 命名空間搬資料
  const oldUserId = getLegacyUserId();
  if (oldUserId && /^[a-f0-9]{16,40}$/i.test(oldUserId)) {
    try {
      const res = await fetch(`/api/trips?u=${encodeURIComponent(oldUserId)}`);
      if (res.ok) {
        const trips = (await res.json()) as Trip[];
        for (const trip of trips) {
          if (existingIds.has(trip.id)) continue;
          try {
            await putTripToKV(trip);
            existingIds.add(trip.id);
            migrated += 1;
          } catch {
            failed += 1;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // (b) 從本地 Dexie 補搬（如果還有沒上 KV 過的）
  try {
    const localTrips = await db.trips.toArray();
    for (const trip of localTrips) {
      if (existingIds.has(trip.id)) continue;
      try {
        await putTripToKV(trip);
        existingIds.add(trip.id);
        migrated += 1;
      } catch {
        failed += 1;
      }
    }
  } catch {
    // ignore
  }

  // 只有全部成功才標記完成；否則（離線、PUT 全失敗）留著旗標下次重試，避免永久漏遷移舊行程
  if (failed === 0) markAccountMigrationDone();
  return { migrated, failed };
}

const MAX_BACKUPS = 7;

/** 本地備份（Dexie backups 表）仍然保留，作為災難復原用 */
export async function recordDailyBackup(trip: Trip): Promise<void> {
  const today = toISODate(new Date());
  const snap = stripEphemeral(trip); // 本地備份也不留暫存 QR，免得越積越大
  const existing = await db.backups.where({ tripId: trip.id, date: today }).first();
  if (existing) {
    await db.backups.put({ ...existing, snapshot: snap, createdAt: Date.now() });
  } else {
    await db.backups.add({
      id: `${trip.id}-${today}`,
      tripId: trip.id,
      date: today,
      snapshot: snap,
      createdAt: Date.now(),
    });
  }
  const all = await db.backups.where('tripId').equals(trip.id).sortBy('createdAt');
  if (all.length > MAX_BACKUPS) {
    const toDelete = all.slice(0, all.length - MAX_BACKUPS);
    await db.backups.bulkDelete(toDelete.map((b) => b.id));
  }
}

export async function listBackups(tripId: string) {
  return db.backups.where('tripId').equals(tripId).reverse().sortBy('createdAt');
}
