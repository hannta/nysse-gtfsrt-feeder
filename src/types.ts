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
  scheduleRelationship?: number; // Enum
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
  scheduleRelationship?: number; // Enum
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
  cause?: Cause;
  effect?: Effect;
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

export enum Cause {
  UNKNOWN_CAUSE,
  OTHER_CAUSE,
  TECHNICAL_PROBLEM,
  STRIKE,
  DEMONSTRATION,
  ACCIDENT,
  HOLIDAY,
  WEATHER,
  MAINTENANCE,
  CONSTRUCTION,
  POLICE_ACTIVITY,
  MEDICAL_EMERGENCY,
}

export enum Effect {
  NO_SERVICE,
  REDUCED_SERVICE,
  SIGNIFICANT_DELAYS,
  DETOUR,
  ADDITIONAL_SERVICE,
  MODIFIED_SERVICE,
  OTHER_EFFECT,
  UNKNOWN_EFFECT,
  STOP_MOVED,
}
