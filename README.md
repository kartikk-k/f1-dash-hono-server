<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./dash/public/tag-logo.png" width="200">
    <img alt="f1-dash" src="./dash/public/tag-logo.png" width="200">
  </picture>
</p>

<h1 align="center">Real-time Formula 1 telemetry and timing</h1>

## f1-dash

A real-time F1 dashboard that shows the leader board, tires, gaps, laps, mini sectors and much more.

**Backend**: Hono.js + Bun | **Frontend**: Next.js 15 + React 19

## Features

- **Real-time Telemetry**: Live F1 data streaming via Server-Sent Events (SSE)
- **Race Schedule**: Complete F1 season calendar with session times
- **Historical Analytics**: Lap times, gaps, and tire strategy data
- **High Performance**: Built on Bun runtime for maximum speed
- **Type Safe**: Full TypeScript support with comprehensive type definitions
- **Microservices**: Modular architecture with independent services

## Architecture

### Services

| Service | Port | Purpose |
|---------|------|---------|
| **API** | 4001 | Race schedule and calendar |
| **Live** | 4000 | Real-time telemetry streaming |
| **Analytics** | 4002 | Historical data queries |
| **Importer** | N/A | Background data persistence |

### Tech Stack

- **Runtime**: Bun
- **Framework**: Hono.js
- **Database**: PostgreSQL (TimescaleDB recommended)
- **Language**: TypeScript
- **Real-time**: Server-Sent Events (SSE) + SignalR client
- **Logging**: Pino

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0 or higher
- PostgreSQL database (optional, for analytics)

### Installation

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env

# Configure your environment variables
nano .env
```

### Configuration

Edit `.env` with your settings:

```bash
# Service Ports
LIVE_PORT=4000
API_PORT=4001
ANALYTICS_PORT=4002

# Database (optional, for analytics)
DATABASE_URL=postgres://user:password@localhost:5432/postgres

# Frontend URL (for CORS)
ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=debug
```

### Running

```bash
# Start all services
bun start

# Or start services individually
bun start:api        # API Service only
bun start:live       # Live Service only
bun start:analytics  # Analytics Service only
bun start:importer   # Importer Service only
```

### Development Mode

```bash
# Start all services in watch mode
bun dev

# Or start services individually
bun dev:api
bun dev:live
bun dev:analytics
bun dev:importer
```

## API Documentation

Comprehensive API documentation is available in [API.md](./API.md).

### Quick Reference

#### API Service (Port 4001)

```bash
# Get full F1 season schedule
GET http://localhost:4001/api/schedule

# Get next upcoming race
GET http://localhost:4001/api/schedule/next
```

#### Live Service (Port 4000)

```bash
# Real-time telemetry stream (SSE)
GET http://localhost:4000/api/sse

# Get current drivers
GET http://localhost:4000/api/drivers
```

#### Analytics Service (Port 4002)

```bash
# Get lap times for driver #1
GET http://localhost:4002/api/laptime/1

# Get gap to leader for driver #44
GET http://localhost:4002/api/gap/44
```

## Project Structure

```
f1-dash-hono-server/
├── src/
│   ├── services/
│   │   ├── api/           # API Service (schedule endpoints)
│   │   ├── live/          # Live Service (SSE streaming)
│   │   ├── analytics/     # Analytics Service (database queries)
│   │   └── importer/      # Importer Service (data persistence)
│   ├── shared/
│   │   ├── middleware/    # CORS, compression, logging
│   │   ├── utils/         # Data transformations, parsers
│   │   └── db/            # Database utilities
│   ├── types/             # TypeScript type definitions
│   └── index.ts           # Main entry point
├── dash/                  # Next.js frontend
├── API.md                 # API documentation
└── README.md
```

## Database Setup (Optional)

For analytics features, set up PostgreSQL:

```sql
-- Create timing table
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

-- Create tire table
CREATE TABLE tire_driver (
  time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nr TEXT NOT NULL,
  lap INTEGER NOT NULL,
  compound TEXT NOT NULL,
  laps INTEGER NOT NULL
);

CREATE INDEX ON tire_driver (nr, time DESC);
```

## Contributing

I really appreciate your interest in contributing to this project. I recommend checking out the GitHub issues marked as "Good First Issue" to get started. Also, please read [`CONTRIBUTING.md`](CONTRIBUTING.md) to learn how to contribute and set up f1-dash on your local machine for development.

## Supporting

If you'd like to support this project and help me dedicate more time to it, you can [buy me a coffee](https://www.buymeacoffee.com/slowlydev).

## Notice

This project/website is unofficial and is not associated in any way with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One Licensing B.V.