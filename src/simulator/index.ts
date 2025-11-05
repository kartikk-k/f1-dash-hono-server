import { serve } from 'bun';
import logger from '../shared/logger';

const SIMULATOR_PORT = parseInt(process.env.SIMULATOR_PORT || '8000');
const SIMULATOR_ADDRESS = process.env.SIMULATOR_ADDRESS || '0.0.0.0';

// Store for telemetry data
let telemetryData: any[] = [];
let currentIndex = 0;
let isPlaying = false;
let playbackInterval: Timer | null = null;

// Connected WebSocket clients
const clients = new Set<any>();

/**
 * Load telemetry data from file
 */
async function loadTelemetryFile(filePath: string): Promise<void> {
  try {
    const file = Bun.file(filePath);
    const content = await file.text();

    // Parse line-by-line (each line is a JSON object with timestamp and data)
    telemetryData = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          logger.warn({ line }, 'Failed to parse telemetry line');
          return null;
        }
      })
      .filter(Boolean);

    logger.info({ count: telemetryData.length, file: filePath }, 'Loaded telemetry data');
    currentIndex = 0;
  } catch (error) {
    logger.error({ error, filePath }, 'Failed to load telemetry file');
    throw error;
  }
}

/**
 * Broadcast message to all connected clients
 */
function broadcast(message: any): void {
  const data = JSON.stringify(message);

  for (const client of clients) {
    try {
      client.send(data);
    } catch (error) {
      logger.error({ error }, 'Error broadcasting to client');
      clients.delete(client);
    }
  }
}

/**
 * Start playback of telemetry data
 */
function startPlayback(): void {
  if (isPlaying || telemetryData.length === 0) return;

  isPlaying = true;
  logger.info('Starting telemetry playback');

  // Send initial state if available
  if (telemetryData[0]) {
    broadcast({
      M: 'feed',
      A: [
        'Streaming',
        'feed',
        telemetryData[0].data,
        Date.now()
      ]
    });
    currentIndex = 1;
  }

  // Playback interval (send message every 100ms)
  playbackInterval = setInterval(() => {
    if (currentIndex >= telemetryData.length) {
      // Loop back to start
      logger.info('Telemetry playback completed, looping...');
      currentIndex = 0;

      // Send initial state again
      if (telemetryData[0]) {
        broadcast({
          M: 'feed',
          A: [
            'Streaming',
            'feed',
            telemetryData[0].data,
            Date.now()
          ]
        });
        currentIndex = 1;
      }
      return;
    }

    const entry = telemetryData[currentIndex];
    if (entry) {
      broadcast({
        M: 'feed',
        A: [
          'Streaming',
          'feed',
          entry.data,
          Date.now()
        ]
      });
    }

    currentIndex++;
  }, 100); // Send updates every 100ms (10 Hz)
}

/**
 * Stop playback
 */
function stopPlayback(): void {
  if (playbackInterval) {
    clearInterval(playbackInterval);
    playbackInterval = null;
  }
  isPlaying = false;
  logger.info('Stopped telemetry playback');
}

/**
 * WebSocket server
 */
const server = serve({
  port: SIMULATOR_PORT,
  hostname: SIMULATOR_ADDRESS,

  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      if (server.upgrade(req)) {
        return undefined;
      }
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // HTTP endpoints
    if (url.pathname === '/health') {
      return Response.json({ success: true, playing: isPlaying, index: currentIndex, total: telemetryData.length });
    }

    if (url.pathname === '/play') {
      startPlayback();
      return Response.json({ success: true, message: 'Playback started' });
    }

    if (url.pathname === '/stop') {
      stopPlayback();
      return Response.json({ success: true, message: 'Playback stopped' });
    }

    if (url.pathname === '/status') {
      return Response.json({
        playing: isPlaying,
        currentIndex,
        totalFrames: telemetryData.length,
        clients: clients.size
      });
    }

    return new Response('F1 Simulator - WebSocket server running', { status: 200 });
  },

  websocket: {
    open(ws) {
      clients.add(ws);
      logger.info({ clients: clients.size }, 'Client connected');

      // Send initial state immediately
      if (telemetryData.length > 0) {
        ws.send(JSON.stringify({
          M: 'feed',
          A: [
            'Streaming',
            'feed',
            telemetryData[0].data,
            Date.now()
          ]
        }));
      }

      // Auto-start playback when first client connects
      if (clients.size === 1 && !isPlaying) {
        setTimeout(() => startPlayback(), 1000);
      }
    },

    message(ws, message) {
      // Handle subscribe messages (similar to SignalR)
      try {
        const data = JSON.parse(message.toString());
        logger.debug({ data }, 'Received message from client');

        // Send acknowledgment
        ws.send(JSON.stringify({ success: true }));
      } catch (error) {
        logger.warn({ error, message }, 'Failed to parse client message');
      }
    },

    close(ws) {
      clients.delete(ws);
      logger.info({ clients: clients.size }, 'Client disconnected');

      // Stop playback if no clients
      if (clients.size === 0) {
        stopPlayback();
      }
    },

    error(ws, error) {
      logger.error({ error }, 'WebSocket error');
      clients.delete(ws);
    }
  }
});

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: bun run src/simulator/index.ts <telemetry-file.data.txt>');
    console.error('');
    console.error('Example:');
    console.error('  bun run src/simulator/index.ts 2024-monaco.data.txt');
    console.error('');
    console.error('Get telemetry files from:');
    console.error('  https://github.com/slowlydev/f1-dash-data-parser/releases/tag/data');
    process.exit(1);
  }

  const filePath = args[0];

  logger.info({ port: SIMULATOR_PORT, address: SIMULATOR_ADDRESS, file: filePath }, 'Starting F1 Simulator');

  // Load telemetry data
  await loadTelemetryFile(filePath);

  logger.info({
    url: `ws://${SIMULATOR_ADDRESS}:${SIMULATOR_PORT}/ws`,
    frames: telemetryData.length
  }, 'F1 Simulator started');

  console.log('');
  console.log('F1 Simulator is running!');
  console.log(`WebSocket URL: ws://localhost:${SIMULATOR_PORT}/ws`);
  console.log(`HTTP Status: http://localhost:${SIMULATOR_PORT}/status`);
  console.log('');
  console.log('Configure your live service to use the simulator:');
  console.log(`  WS_URL=ws://localhost:${SIMULATOR_PORT}/ws`);
  console.log('');
  console.log('HTTP Controls:');
  console.log(`  GET /health  - Health check`);
  console.log(`  GET /status  - Playback status`);
  console.log(`  GET /play    - Start playback`);
  console.log(`  GET /stop    - Stop playback`);
  console.log('');

  // Handle shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down simulator');
    stopPlayback();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down simulator');
    stopPlayback();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error in simulator');
  process.exit(1);
});
