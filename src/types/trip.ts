import type { Place, TransportMode } from './place';

export interface ItineraryItem {
  id: string;
  place: Place;
  arrivalTime: string;
  stayMinutes: number;
  notes?: string[];
  isHotel: boolean;
}

export interface Leg {
  mode: TransportMode;
  durationMinutes?: number;
  distanceMeters?: number;
}

export interface DayPlan {
  id: string;
  dayIndex: number;
  date: string;
  city?: string;
  items: ItineraryItem[];
  legs: Leg[];
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  days: DayPlan[];
  favorites: Place[];
  createdAt: number;
  updatedAt: number;
}
