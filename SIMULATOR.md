# F1 Telemetry Simulator

The F1 Telemetry Simulator allows you to replay recorded F1 telemetry data for testing and development without waiting for a live race.

## Quick Start

### 1. Get Telemetry Data

Download pre-recorded telemetry files from:
- [F1 Dash Data Releases](https://github.com/slowlydev/f1-dash-data-parser/releases/tag/data)

Or record your own during a live race (see [Recording Telemetry](#recording-telemetry) below).

### 2. Run the Simulator

```bash
# Run simulator with a telemetry file
bun simulator 2024-monaco.data.txt

# Or use the full command
bun run src/simulator/index.ts 2024-monaco.data.txt
```

The simulator will start on `ws://localhost:8000/ws` by default.

### 3. Configure Live Service

Update your `.env` file to point to the simulator:

```bash
# Point live service to simulator instead of F1
WS_URL=ws://localhost:8000/ws
```

### 4. Start Live Service

```bash
# In another terminal
bun dev:live
```

The live service will now receive data from the simulator instead of the real F1 server.

## How It Works

1. **Load**: The simulator loads a `.data.txt` file containing recorded telemetry
2. **WebSocket Server**: Starts a WebSocket server mimicking F1's SignalR protocol
3. **Playback**: Replays telemetry data at 10 Hz (10 updates per second)
4. **Loop**: When playback completes, it loops back to the start

## Telemetry File Format

Each line in a `.data.txt` file is a JSON object:

```json
{"timestamp": 1234567890, "data": [[topic, value], [topic2, value2]]}
{"timestamp": 1234567990, "data": [[topic, value], [topic2, value2]]}
```

## HTTP API

The simulator provides HTTP endpoints for control:

### Health Check
```bash
GET http://localhost:8000/health

Response:
{
  "success": true,
  "playing": true,
  "index": 1234,
  "total": 5000
}
```

### Status
```bash
GET http://localhost:8000/status

Response:
{
  "playing": true,
  "currentIndex": 1234,
  "totalFrames": 5000,
  "clients": 1
}
```

### Start Playback
```bash
GET http://localhost:8000/play

Response:
{
  "success": true,
  "message": "Playback started"
}
```

### Stop Playback
```bash
GET http://localhost:8000/stop

Response:
{
  "success": true,
  "message": "Playback stopped"
}
```

## Configuration

### Environment Variables

```bash
# Simulator WebSocket port (default: 8000)
SIMULATOR_PORT=8000

# Simulator bind address (default: 0.0.0.0)
SIMULATOR_ADDRESS=0.0.0.0
```

### Custom Port

```bash
# Start simulator on custom port
SIMULATOR_PORT=9000 bun simulator 2024-monaco.data.txt

# Update WS_URL in live service
WS_URL=ws://localhost:9000/ws
```

## Recording Telemetry

To record your own telemetry data during a live race, you'll need to create a saver tool. Here's a simple example:

```typescript
// saver.ts
import { getF1Client } from './src/services/live/f1-client';

const outputFile = process.argv[2] || 'recording.data.txt';
const file = Bun.file(outputFile);
const writer = file.writer();

const f1Client = getF1Client();

f1Client.onMessage((type, data) => {
  const entry = {
    timestamp: Date.now(),
    type,
    data
  };

  writer.write(JSON.stringify(entry) + '\n');
  writer.flush();
});

await f1Client.start();

console.log(`Recording telemetry to ${outputFile}...`);
console.log('Press Ctrl+C to stop');

process.on('SIGINT', () => {
  writer.end();
  console.log('Recording saved');
  process.exit(0);
});
```

Then run during a live race:
```bash
bun run saver.ts 2024-monaco.data.txt
```

## Development Workflow

### Typical Setup

You'll need 4 terminal sessions:

**Terminal 1: Simulator**
```bash
bun simulator 2024-monaco.data.txt
```

**Terminal 2: Live Service**
```bash
# Set WS_URL in .env first
WS_URL=ws://localhost:8000/ws

bun dev:live
```

**Terminal 3: API Service**
```bash
bun dev:api
```

**Terminal 4: Frontend**
```bash
cd dash
yarn dev
```

## Troubleshooting

### Simulator Won't Start

**Problem**: Port already in use
```
error: EADDRINUSE: address already in use
```

**Solution**: Use a different port
```bash
SIMULATOR_PORT=9000 bun simulator 2024-monaco.data.txt
```

### Live Service Can't Connect

**Problem**: Connection refused to simulator

**Solution**: Ensure simulator is running first, and WS_URL is set correctly
```bash
# Check if simulator is running
curl http://localhost:8000/health

# Verify WS_URL in .env
WS_URL=ws://localhost:8000/ws
```

### No Data in Frontend

**Problem**: Frontend shows no telemetry

**Solution**: Check the full pipeline:
1. Simulator is running: `curl http://localhost:8000/status`
2. Live service is connected: Check logs for "Connected to F1"
3. Frontend is pointing to live service: Check `NEXT_PUBLIC_LIVE_URL`

### Telemetry File Won't Load

**Problem**: Failed to parse telemetry file

**Solution**: Ensure file format is correct (one JSON object per line)
```bash
# Check file format
head -n 1 2024-monaco.data.txt | jq .
```

## Tips

1. **Name Convention**: Use `.data.txt` extension - it's in `.gitignore`
2. **Loop Playback**: Simulator automatically loops when reaching the end
3. **Multiple Clients**: Multiple live services can connect to one simulator
4. **Auto-Start**: Playback starts automatically when first client connects
5. **Auto-Stop**: Playback stops when all clients disconnect

## Example Session

```bash
# Terminal 1: Start simulator
$ bun simulator 2024-monaco.data.txt

F1 Simulator is running!
WebSocket URL: ws://localhost:8000/ws
HTTP Status: http://localhost:8000/status

Configure your live service to use the simulator:
  WS_URL=ws://localhost:8000/ws

# Terminal 2: Update .env and start live service
$ echo "WS_URL=ws://localhost:8000/ws" >> .env
$ bun dev:live

info: Starting Live service {"port":4000,"address":"0.0.0.0"}
info: Connected to F1 server

# Terminal 3: Start frontend
$ cd dash && yarn dev

# Open browser to http://localhost:3000
# See replayed telemetry data!
```

## Data Sources

Pre-recorded telemetry files available at:
- [F1 Dash Data Parser Releases](https://github.com/slowlydev/f1-dash-data-parser/releases/tag/data)

Contains recordings from various races and sessions.

## Advanced Usage

### Custom Playback Speed

Edit `src/simulator/index.ts` and change the interval:

```typescript
// Default: 100ms (10 Hz)
setInterval(() => { ... }, 100);

// Faster: 50ms (20 Hz)
setInterval(() => { ... }, 50);

// Slower: 200ms (5 Hz)
setInterval(() => { ... }, 200);
```

### Pause/Resume Support

Use the HTTP API:
```bash
# Pause
curl http://localhost:8000/stop

# Resume
curl http://localhost:8000/play
```

### Monitor Playback

```bash
# Check status every second
watch -n 1 'curl -s http://localhost:8000/status | jq'
```

## Contributing

If you improve the simulator or create useful telemetry recordings, please contribute them back:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

Happy Testing! 🏎️💨
