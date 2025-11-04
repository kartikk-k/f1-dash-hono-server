# Docker and Docker Compose

> [!NOTE]
> The docker compose is not meant as a production deployment rather a tool to setup f1-dash locally for testing or development.
> If you want to deploy f1-dash, it can be used as a base.

## Quick Start

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

## Services

The docker-compose.yaml defines three services:

1. **backend** - Hono.js backend (all API services)
   - Ports: 4000 (Live), 4001 (API), 4002 (Analytics)
   - Built with Bun runtime

2. **frontend** - Next.js dashboard
   - Port: 3000

3. **timescaledb** - PostgreSQL database with TimescaleDB extension
   - Port: 5432

## Environment Variables

To substitute environment variables in compose.yaml, use `--env-file` flag:

```bash
docker compose --env-file ./compose.env up
# or
docker compose --env-file ./compose.env build
# or
docker compose --env-file ./compose.env down
```

To set environment variables in the container, use the `environment` directive in [`compose.yaml`](compose.yaml).

Example environment configuration for backend:

```yaml
environment:
  - ORIGIN=http://localhost:3000
  - LIVE_PORT=4000
  - API_PORT=4001
  - ANALYTICS_PORT=4002
  - LOG_LEVEL=debug
  - DATABASE_URL=postgres://postgres:password@timescaledb:5432/postgres
```

## Building Images

### Build all images
```bash
docker compose build
```

### Build specific service
```bash
docker compose build backend
docker compose build frontend
```

### Build with no cache
```bash
docker compose build --no-cache
```

## Running Services

### Start all services
```bash
docker compose up -d
```

### Start specific service
```bash
docker compose up -d backend
docker compose up -d frontend
```

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

## Database Setup

The TimescaleDB container automatically creates the database on first run. To initialize the tables:

```bash
# Connect to database
docker compose exec timescaledb psql -U postgres

# Run table creation SQL
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

CREATE TABLE tire_driver (
  time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nr TEXT NOT NULL,
  lap INTEGER NOT NULL,
  compound TEXT NOT NULL,
  laps INTEGER NOT NULL
);

CREATE INDEX ON tire_driver (nr, time DESC);

-- Enable TimescaleDB (optional but recommended)
SELECT create_hypertable('timing_driver', 'time');
SELECT create_hypertable('tire_driver', 'time');
```

## Accessing Services

Once running, access the services at:

- **Frontend**: http://localhost:3000
- **Live API**: http://localhost:4000/api/sse
- **Schedule API**: http://localhost:4001/api/schedule
- **Analytics API**: http://localhost:4002/api/laptime/1

## Volumes

Data persistence:
- `timescale-data` - PostgreSQL database data

To remove volumes:
```bash
docker compose down -v
```

## Troubleshooting

### Port conflicts
If ports are already in use, modify the port mappings in compose.yaml:

```yaml
ports:
  - "14000:4000"  # Live Service
  - "14001:4001"  # API Service
  - "14002:4002"  # Analytics Service
```

### Database connection issues
Ensure the DATABASE_URL matches the TimescaleDB service name:
```
postgres://postgres:password@timescaledb:5432/postgres
```

### Container won't start
Check logs for errors:
```bash
docker compose logs backend
```

Rebuild with no cache:
```bash
docker compose build --no-cache backend
```

## Production Deployment

For production, consider:

1. **Use environment files** for sensitive data
2. **Enable HTTPS** with a reverse proxy (nginx, Traefik)
3. **Configure proper database credentials**
4. **Set resource limits** in compose.yaml
5. **Use Docker secrets** for sensitive values
6. **Enable monitoring** (Prometheus, Grafana)

Example with resource limits:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G
```

## Development Workflow

### Hot Reload
The backend service uses Bun's watch mode in development:

```bash
# Edit compose.yaml to use dev command
command: ["bun", "dev"]
```

Then restart:
```bash
docker compose restart backend
```

### Rebuilding After Changes
```bash
docker compose up -d --build
```

## Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Hono.js Documentation](https://hono.dev)
- [TimescaleDB Documentation](https://docs.timescale.com)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
