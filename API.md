# F1 Dashboard API Documentation

## Overview

The F1 Dashboard Backend provides real-time Formula 1 telemetry data, race schedules, and analytics through a set of RESTful APIs and Server-Sent Events (SSE).

**Architecture:** Microservices-based with Hono.js and Bun runtime
**Base URLs:**
- API Service: `http://localhost:4001`
- Live Service: `http://localhost:4000`
- Analytics Service: `http://localhost:4002`

---

## Table of Contents

1. [API Service (Port 4001)](#api-service-port-4001)
2. [Live Service (Port 4000)](#live-service-port-4000)
3. [Analytics Service (Port 4002)](#analytics-service-port-4002)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [CORS Configuration](#cors-configuration)

---

## API Service (Port 4001)

### Health Check

Check if the API service is running.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200` - Service is healthy

---

### Get Full Schedule

Retrieve the complete F1 season schedule with all rounds and sessions.

**Endpoint:** `GET /api/schedule`

**Response:**
```json
[
  {
    "name": "Bahrain",
    "countryName": "Bahrain",
    "countryKey": "BAHRAIN",
    "start": "2024-02-29T00:00:00.000Z",
    "end": "2024-03-02T23:59:59.000Z",
    "sessions": [
      {
        "kind": "Practice",
        "start": "2024-02-29T11:30:00.000Z",
        "end": "2024-02-29T12:30:00.000Z"
      },
      {
        "kind": "Qualifying",
        "start": "2024-03-01T14:00:00.000Z",
        "end": "2024-03-01T15:00:00.000Z"
      },
      {
        "kind": "Race",
        "start": "2024-03-02T15:00:00.000Z",
        "end": "2024-03-02T17:00:00.000Z"
      }
    ],
    "over": false
  }
]
```

**Fields:**
- `name` (string) - Race location name
- `countryName` (string) - Country name
- `countryKey` (string) - Uppercase country identifier
- `start` (string) - ISO 8601 timestamp of race weekend start
- `end` (string) - ISO 8601 timestamp of race weekend end
- `sessions` (array) - List of all sessions in the weekend
  - `kind` (string) - Session type: `Practice`, `Qualifying`, `Sprint`, or `Race`
  - `start` (string) - ISO 8601 timestamp of session start
  - `end` (string) - ISO 8601 timestamp of session end
- `over` (boolean) - Whether the race weekend is complete

**Caching:**
- Results are cached for 30 minutes (configurable via `SCHEDULE_CACHE_TTL`)
- Data source: F1 iCalendar feed

**Status Codes:**
- `200` - Success
- `500` - Failed to fetch schedule

**Example:**
```bash
curl http://localhost:4001/api/schedule
```

---

### Get Next Race

Retrieve the next upcoming race weekend.

**Endpoint:** `GET /api/schedule/next`

**Response:**
```json
{
  "name": "Monaco",
  "countryName": "Monaco",
  "countryKey": "MONACO",
  "start": "2024-05-23T00:00:00.000Z",
  "end": "2024-05-26T23:59:59.000Z",
  "sessions": [
    {
      "kind": "Practice",
      "start": "2024-05-23T11:30:00.000Z",
      "end": "2024-05-23T12:30:00.000Z"
    },
    {
      "kind": "Qualifying",
      "start": "2024-05-24T14:00:00.000Z",
      "end": "2024-05-24T15:00:00.000Z"
    },
    {
      "kind": "Race",
      "start": "2024-05-26T13:00:00.000Z",
      "end": "2024-05-26T15:00:00.000Z"
    }
  ],
  "over": false
}
```

**Fields:** Same as `/api/schedule` (single round object)

**Status Codes:**
- `200` - Success (returns next race)
- `204` - No upcoming races (season ended)
- `500` - Failed to fetch schedule

**Example:**
```bash
curl http://localhost:4001/api/schedule/next
```

---

## Live Service (Port 4000)

### Health Check

Check if the Live service is running.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200` - Service is healthy

---

### Live Timing Stream (SSE)

Real-time Formula 1 telemetry data via Server-Sent Events.

**Endpoint:** `GET /api/sse`

**Protocol:** Server-Sent Events (SSE)

**Connection:**
```javascript
const eventSource = new EventSource('http://localhost:4000/api/sse');
```

**Events:**

#### `initial` Event
Sent immediately upon connection with the complete current state.

```javascript
eventSource.addEventListener('initial', (event) => {
  const state = JSON.parse(event.data);
  console.log('Initial state:', state);
});
```

**Data Structure:**
```json
{
  "driverList": {
    "1": {
      "racingNumber": "1",
      "fullName": "Max Verstappen",
      "tla": "VER",
      "teamColour": "#3671C6",
      "teamName": "Red Bull Racing"
    }
  },
  "timingData": {
    "1": {
      "line": 1,
      "position": 1,
      "gapToLeader": "0.000",
      "lastLapTime": {
        "value": "1:32.456"
      }
    }
  },
  "sessionInfo": {
    "name": "Race",
    "type": "Race",
    "number": 5
  }
}
```

#### `updates` Event
Incremental updates to the state (sent as changes occur).

```javascript
eventSource.addEventListener('updates', (event) => {
  const updates = JSON.parse(event.data);
  console.log('Updates:', updates);
});
```

**Data Structure:**
```json
[
  ["timingData", {
    "1": {
      "gapToLeader": "0.125"
    }
  }],
  ["carData", {
    "1": {
      "speed": 312
    }
  }]
]
```

Each update is an array of `[topic, data]` tuples to merge into state.

#### `ping` Event
Keep-alive ping sent every 10 seconds.

```javascript
eventSource.addEventListener('ping', (event) => {
  const { timestamp } = JSON.parse(event.data);
  console.log('Keep-alive:', timestamp);
});
```

**Available Topics:**
- `heartbeat` - Server heartbeat
- `carData` - Car telemetry (speed, RPM, gear, DRS, etc.)
- `position` - Car positions on track
- `extrapolatedClock` - Session clock
- `topThree` - Top 3 drivers
- `rcmSeries` - Race control messages series
- `timingStats` - Timing statistics
- `timingAppData` - Timing application data (tires, strategy)
- `weatherData` - Weather information
- `trackStatus` - Track status (green, yellow, red flags)
- `sessionStatus` - Session status (started, finished, etc.)
- `driverList` - List of drivers
- `raceControlMessages` - Race control messages
- `sessionInfo` - Session information
- `sessionData` - Session data
- `lapCount` - Current lap count
- `timingData` - Driver timing data
- `teamRadio` - Team radio messages
- `pitLaneTimeCollection` - Pit lane times
- `championshipPrediction` - Championship predictions

**Compression:**
- Gzip compression is automatically applied when `Accept-Encoding: gzip` header is sent

**Error Handling:**
```javascript
eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  // EventSource will automatically reconnect
};
```

**Example:**
```javascript
const eventSource = new EventSource('http://localhost:4000/api/sse');

// Handle initial state
eventSource.addEventListener('initial', (event) => {
  const state = JSON.parse(event.data);
  console.log('Initial state received:', Object.keys(state));
});

// Handle updates
eventSource.addEventListener('updates', (event) => {
  const updates = JSON.parse(event.data);
  updates.forEach(([topic, data]) => {
    console.log(`Update to ${topic}:`, data);
  });
});

// Handle keep-alive
eventSource.addEventListener('ping', (event) => {
  console.log('Server is alive');
});

// Handle errors
eventSource.onerror = (error) => {
  console.error('Connection error:', error);
};
```

---

### Get Drivers

Retrieve the current list of drivers from the live state.

**Endpoint:** `GET /api/drivers`

**Response:**
```json
[
  {
    "racingNumber": "1",
    "fullName": "Max Verstappen",
    "tla": "VER",
    "teamColour": "#3671C6",
    "teamName": "Red Bull Racing",
    "countryCode": "NED",
    "headShotUrl": "https://..."
  },
  {
    "racingNumber": "44",
    "fullName": "Lewis Hamilton",
    "tla": "HAM",
    "teamColour": "#27F4D2",
    "teamName": "Mercedes",
    "countryCode": "GBR",
    "headShotUrl": "https://..."
  }
]
```

**Fields:**
- `racingNumber` (string) - Driver's racing number
- `fullName` (string) - Full name
- `tla` (string) - Three-letter abbreviation
- `teamColour` (string) - Team color hex code
- `teamName` (string) - Team name
- Additional fields may be present depending on F1 data

**Status Codes:**
- `200` - Success
- `500` - Failed to fetch drivers

**Example:**
```bash
curl http://localhost:4000/api/drivers
```

---

## Analytics Service (Port 4002)

### Health Check

Check if the Analytics service is running.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200` - Service is healthy

---

### Get Driver Lap Times

Retrieve all lap times for a specific driver.

**Endpoint:** `GET /api/laptime/:driver_nr`

**Parameters:**
- `driver_nr` (path) - Driver racing number (e.g., "1", "44")

**Response:**
```json
[
  {
    "time": "2024-05-26T15:45:23.123Z",
    "lap": 1,
    "laptime": 82450
  },
  {
    "time": "2024-05-26T15:47:05.456Z",
    "lap": 2,
    "laptime": 81980
  }
]
```

**Fields:**
- `time` (string) - ISO 8601 timestamp when laptime was recorded
- `lap` (number) - Lap number
- `laptime` (number) - Lap time in milliseconds

**Status Codes:**
- `200` - Success
- `500` - Database error

**Example:**
```bash
# Get lap times for driver #1 (Max Verstappen)
curl http://localhost:4002/api/laptime/1
```

---

### Get Driver Gap to Leader

Retrieve gap to race leader over time for a specific driver.

**Endpoint:** `GET /api/gap/:driver_nr`

**Parameters:**
- `driver_nr` (path) - Driver racing number (e.g., "1", "44")

**Response:**
```json
[
  {
    "time": "2024-05-26T15:45:23.123Z",
    "gap": 2500
  },
  {
    "time": "2024-05-26T15:47:05.456Z",
    "gap": 3200
  }
]
```

**Fields:**
- `time` (string) - ISO 8601 timestamp when gap was recorded
- `gap` (number) - Gap to leader in milliseconds

**Status Codes:**
- `200` - Success
- `500` - Database error

**Example:**
```bash
# Get gap to leader for driver #44 (Lewis Hamilton)
curl http://localhost:4002/api/gap/44
```

---

## Data Models

### Round
```typescript
interface Round {
  name: string;
  countryName: string;
  countryKey: string;
  start: string;
  end: string;
  sessions: Session[];
  over: boolean;
}
```

### Session
```typescript
interface Session {
  kind: 'Practice' | 'Qualifying' | 'Race' | 'Sprint';
  start: string;
  end: string;
}
```

### Driver
```typescript
interface Driver {
  racingNumber: string;
  fullName: string;
  tla: string;
  teamColour: string;
  teamName: string;
  [key: string]: any;
}
```

### Laptime
```typescript
interface Laptime {
  time: string;
  lap: number;
  laptime: number; // milliseconds
}
```

### Gap
```typescript
interface Gap {
  time: string;
  gap: number; // milliseconds
}
```

### Health Response
```typescript
interface HealthResponse {
  success: boolean;
}
```

---

## Error Handling

All endpoints return JSON error responses in the following format:

```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**
- `200` - Success
- `204` - No Content (e.g., no upcoming races)
- `500` - Internal Server Error

**Error Response Example:**
```json
{
  "error": "Failed to fetch schedule"
}
```

---

## CORS Configuration

All services support Cross-Origin Resource Sharing (CORS).

**Allowed Origins:**
Configured via `ORIGIN` environment variable (semicolon-separated list).

**Default:** `http://localhost:3000`

**Allowed Methods:**
- `GET`
- `POST`
- `PUT`
- `DELETE`
- `OPTIONS`

**Allowed Headers:**
- `Content-Type`
- `Authorization`
- `Accept-Encoding`

**Exposed Headers:**
- `Content-Length`
- `Content-Encoding`

**Credentials:** Enabled

**Example Configuration:**
```bash
ORIGIN=http://localhost:3000;https://example.com
```

---

## Environment Variables

### Required

```bash
# Service Ports
LIVE_PORT=4000
API_PORT=4001
ANALYTICS_PORT=4002

# Database
DATABASE_URL=postgres://user:password@localhost:5432/postgres
```

### Optional

```bash
# Service Addresses
LIVE_ADDRESS=0.0.0.0
API_ADDRESS=0.0.0.0
ANALYTICS_ADDRESS=0.0.0.0

# CORS
ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=debug

# F1 Data Sources
F1_SIGNALR_URL=https://livetiming.formula1.com/signalr
F1_ICAL_URL=https://ics.ecal.com/ecal-sub/660897ca63f9ca0008bcbea6/Formula%201.ics

# Caching
SCHEDULE_CACHE_TTL=1800

# Override F1 WebSocket (for testing/simulation)
WS_URL=ws://localhost:8000/ws
```

---

## Database Schema

### `timing_driver` Table

Stores real-time timing data for drivers.

```sql
CREATE TABLE timing_driver (
  time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nr TEXT NOT NULL,
  lap INTEGER,
  gap INTEGER,
  leader_gap INTEGER,
  laptime INTEGER,
  sector_1 INTEGER,
  sector_2 INTEGER,
  sector_3 INTEGER
);

CREATE INDEX ON timing_driver (nr, time DESC);
```

**Columns:**
- `time` - Timestamp (auto-generated)
- `nr` - Driver racing number
- `lap` - Lap number
- `gap` - Gap to leader (milliseconds)
- `leader_gap` - Gap to car ahead (milliseconds)
- `laptime` - Lap time (milliseconds)
- `sector_1` - Sector 1 time (milliseconds)
- `sector_2` - Sector 2 time (milliseconds)
- `sector_3` - Sector 3 time (milliseconds)

### `tire_driver` Table

Stores tire stint data for drivers.

```sql
CREATE TABLE tire_driver (
  time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nr TEXT NOT NULL,
  lap INTEGER NOT NULL,
  compound TEXT NOT NULL,
  laps INTEGER NOT NULL
);

CREATE INDEX ON tire_driver (nr, time DESC);
```

**Columns:**
- `time` - Timestamp (auto-generated)
- `nr` - Driver racing number
- `lap` - Lap when tires were fitted
- `compound` - Tire compound (SOFT, MEDIUM, HARD, INTERMEDIATE, WET)
- `laps` - Total laps on these tires

---

## Quick Start

### Installation

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env

# Configure environment variables
nano .env
```

### Running Services

```bash
# Start all services
bun start

# Or start services individually
bun start:api        # API Service (Port 4001)
bun start:live       # Live Service (Port 4000)
bun start:analytics  # Analytics Service (Port 4002)
bun start:importer   # Importer Service (background)
```

### Development

```bash
# Start all services in watch mode
bun dev

# Or start services individually
bun dev:api
bun dev:live
bun dev:analytics
bun dev:importer
```

---

## Architecture

### Services Overview

1. **API Service (4001)**: Provides race schedule information from F1 iCalendar feed
2. **Live Service (4000)**: Real-time telemetry streaming via SSE from F1 SignalR server
3. **Analytics Service (4002)**: Historical data queries from PostgreSQL database
4. **Importer Service**: Background worker that persists live data to database

### Data Flow

```
F1 SignalR Server
        ↓
   Live Service
        ↓
    ┌────────────┐
    │  SSE       │  Importer Service
    │  Stream    │       ↓
    ↓            ↓   PostgreSQL
Frontend     Analytics Service
                    ↓
                Frontend
```

---

## Support

For issues and questions:
- GitHub: [https://github.com/kartikk-k/f1-dash-hono-server](https://github.com/kartikk-k/f1-dash-hono-server)
- Report bugs in the Issues section

---

## License

MIT License - See LICENSE file for details
