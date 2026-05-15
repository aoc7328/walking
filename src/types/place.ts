export interface Place {
  id: string;
  placeId: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  rating?: number;
  reviewCount?: number;
  photoUrls?: string[];
  types: string[];
  phoneNumber?: string;
  website?: string;
  openingHours?: string[];
  priceLevel?: number;
  reviews?: PlaceReview[];
}

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  time?: number;
}

export type TransportMode = 'driving' | 'walking' | 'transit' | 'bicycling';
