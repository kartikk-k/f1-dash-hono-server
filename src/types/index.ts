// Schedule Types
export interface Session {
  kind: 'Practice' | 'Qualifying' | 'Race' | 'Sprint';
  start: string;
  end: string;
}

export interface Round {
  name: string;
  countryName: string;
  countryKey: string;
  start: string;
  end: string;
  sessions: Session[];
  over: boolean;
}

// Live Timing Types
export interface Driver {
  racingNumber: string;
  fullName: string;
  tla: string;
  teamColour: string;
  teamName: string;
  [key: string]: any;
}

export interface LiveState {
  driverList?: Record<string, Driver>;
  [key: string]: any;
}

// Analytics Types
export interface Laptime {
  time: string;
  lap: number;
  laptime: number;
}

export interface Gap {
  time: string;
  gap: number;
}

// Message Types for Importer
export interface Message {
  type: 'initial' | 'updates';
  data: any;
}

// Health Check Response
export interface HealthResponse {
  success: boolean;
}

// Environment Variables
export interface Env {
  LIVE_ADDRESS: string;
  LIVE_PORT: string;
  API_ADDRESS: string;
  API_PORT: string;
  ANALYTICS_ADDRESS: string;
  ANALYTICS_PORT: string;
  ORIGIN: string;
  DATABASE_URL: string;
  LOG_LEVEL: string;
  F1_SIGNALR_URL: string;
  F1_ICAL_URL: string;
  SCHEDULE_CACHE_TTL: string;
  WS_URL?: string;
}
