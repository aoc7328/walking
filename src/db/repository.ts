import { db, ACTIVE_TRIP_ID } from './schema';
import type { Trip } from '../types/trip';
import { toISODate } from '../utils/date';

let writeTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 1000;

export async function loadActiveTrip(): Promise<Trip | null> {
  try {
    const trip = await db.trips.get(ACTIVE_TRIP_ID);
    return trip ?? null;
  } catch {
    return null;
  }
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
    // 同日已備份 → 覆蓋當日 snapshot
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
  // 保留最近 7 個
  const all = await db.backups.where('tripId').equals(trip.id).sortBy('createdAt');
  if (all.length > MAX_BACKUPS) {
    const toDelete = all.slice(0, all.length - MAX_BACKUPS);
    await db.backups.bulkDelete(toDelete.map((b) => b.id));
  }
}

export async function listBackups(tripId: string) {
  return db.backups.where('tripId').equals(tripId).reverse().sortBy('createdAt');
}
