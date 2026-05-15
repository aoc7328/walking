import { db, ACTIVE_TRIP_ID_KEY } from './schema';
import type { Trip } from '../types/trip';
import { toISODate } from '../utils/date';

let writeTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 1000;

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

/**
 * 載入目前 active 的 trip。若 activeTripId 失效或不存在，
 * 改載入 DB 中最近更新的 trip；都沒有則回 null（由 caller 載入 mock）。
 */
export async function loadActiveTrip(): Promise<Trip | null> {
  try {
    const id = getActiveTripId();
    if (id) {
      const trip = await db.trips.get(id);
      if (trip) return trip;
    }
    const recent = await db.trips.orderBy('updatedAt').reverse().limit(1).toArray();
    if (recent.length > 0) {
      setActiveTripId(recent[0]!.id);
      return recent[0]!;
    }
    return null;
  } catch {
    return null;
  }
}

export async function listAllTrips(): Promise<Trip[]> {
  try {
    return await db.trips.orderBy('updatedAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function deleteTripFromDB(id: string): Promise<void> {
  await db.trips.delete(id);
  await db.backups.where('tripId').equals(id).delete();
}

export function persistTripDebounced(trip: Trip) {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    void db.trips.put(trip);
  }, DEBOUNCE_MS);
}

export async function persistTripImmediate(trip: Trip): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  await db.trips.put(trip);
}

const MAX_BACKUPS = 7;

export async function recordDailyBackup(trip: Trip): Promise<void> {
  const today = toISODate(new Date());
  const existing = await db.backups.where({ tripId: trip.id, date: today }).first();
  if (existing) {
    await db.backups.put({ ...existing, snapshot: trip, createdAt: Date.now() });
  } else {
    await db.backups.add({
      id: `${trip.id}-${today}`,
      tripId: trip.id,
      date: today,
      snapshot: trip,
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
