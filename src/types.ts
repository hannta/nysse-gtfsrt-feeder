export interface FeedMessage {
  header: FeedHeader;
  entity?: FeedEntity[];
}

export interface FeedHeader {
  gtfsRealtimeVersion: string;
  incrementality: number; // Enum
  timestamp: Timestamp;
}

export interface FeedEntity {
  id: string;
  isDeleted?: boolean;
  tripUpdate?: TripUpdate;
  alert?: Alert;
}

export interface TripUpdate {
  trip: TripDescriptor;
  vehicle?: VehicleDescriptor;
  stopTimeUpdate?: StopTimeUpdate[];
  timestamp?: Timestamp;
  delay?: number;
}

export interface TripDescriptor {
  tripId?: string;
  routeId?: string;
  directionId?: number;
  startTime?: string;
  startDate?: string;
  scheduleRelationship?: number; // enum number value
}

export interface VehicleDescriptor {
  id?: string;
  label?: string;
  licensePlate?: string;
}

export interface StopTimeUpdate {
  stopSequence?: number;
  stopId?: string;
  arrival?: StopTimeEvent;
  departure?: StopTimeEvent;
  scheduleRelationship?: number; // enum number value
}

export interface StopTimeEvent {
  delay?: number;
  time?: Timestamp;
  uncertainty?: number;
}

// int64
export interface Timestamp {
  low: number;
  high: number;
  unsigned: boolean;
}

export interface Alert {
  activePeriod?: TimeRange[];
  informedEntity: EntitySelector[];
  cause?: number; // Cause enum number value
  effect?: number; // Effect enum number value
  url?: TranslatedString;
  headerText: TranslatedString;
  descriptionText: TranslatedString;
}

export interface TimeRange {
  start: Timestamp;
  end: Timestamp;
}

export interface EntitySelector {
  agencyId?: string;
  routeId?: string;
  routeType?: number;
  trip?: TripDescriptor;
  stopId?: string;
}

export interface TranslatedString {
  translation: Translation[];
}

export interface Translation {
  text: string;
  language?: string;
}

export enum ScheduleRelationship {
  SCHEDULED = 'SCHEDULED',
  ADDED = 'ADDED', // Only with trip
  UNSCHEDULED = 'UNSCHEDULED', // Only with trip
  CANCELED = 'CANCELED', // Only with trip
  SKIPPED = 'SKIPPED', // Only wit stop time
  NO_DATA = 'NO_DATA', // Only with stop time
  REPLACEMENT = 'REPLACEMENT', // Only with trip
}

export enum Cause {
  UNKNOWN_CAUSE = 'UNKNOWN_CAUSE',
  OTHER_CAUSE = 'OTHER_CAUSE',
  TECHNICAL_PROBLEM = 'TECHNICAL_PROBLEM',
  STRIKE = 'TECHNICAL_PROBLEM',
  DEMONSTRATION = 'DEMONSTRATION',
  ACCIDENT = 'ACCIDENT',
  HOLIDAY = 'HOLIDAY',
  WEATHER = 'WEATHER',
  MAINTENANCE = 'MAINTENANCE',
  CONSTRUCTION = 'CONSTRUCTION',
  POLICE_ACTIVITY = 'POLICE_ACTIVITY',
  MEDICAL_EMERGENCY = 'MEDICAL_EMERGENCY',
}

export enum Effect {
  NO_SERVICE = 'NO_SERVICE',
  REDUCED_SERVICE = 'REDUCED_SERVICE',
  SIGNIFICANT_DELAYS = 'SIGNIFICANT_DELAYS',
  DETOUR = 'DETOUR',
  ADDITIONAL_SERVICE = 'ADDITIONAL_SERVICE',
  MODIFIED_SERVICE = 'MODIFIED_SERVICE',
  OTHER_EFFECT = 'OTHER_EFFECT',
  UNKNOWN_EFFECT = 'UNKNOWN_EFFECT',
  STOP_MOVED = 'STOP_MOVED',
}

/**
 * Database types
 */

export interface AlertDB {
  id: string;
  start_time?: number;
  end_time?: number;
  cause?: string;
  effect?: string;
}

export interface InformedEntityDB {
  alert_id: string;
  agency_id?: string;
  route_id?: string;
  route_type?: number;
  stop_id?: string;
  trip_id?: string;
}

export interface TranslatedTextDB {
  alert_id: string;
  translated_text: string;
  language_code?: string;
}

/**
 * Other types
 */

export interface DataProviderStatus {
  updated: Date;
  newItemCount: number;
}
