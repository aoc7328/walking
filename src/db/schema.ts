import Dexie, { type EntityTable } from 'dexie';
import type { Trip } from '../types/trip';

export interface BackupRow {
  id: string;
  tripId: string;
  date: string;
  snapshot: Trip;
  createdAt: number;
}

export class WalkingDB extends Dexie {
  trips!: EntityTable<Trip, 'id'>;
  backups!: EntityTable<BackupRow, 'id'>;

  constructor() {
    super('walking');
    this.version(1).stores({
      trips: 'id, updatedAt',
      backups: 'id, tripId, date, createdAt',
    });
  }
}

export const db = new WalkingDB();

export const ACTIVE_TRIP_ID = 'demo-trip';
