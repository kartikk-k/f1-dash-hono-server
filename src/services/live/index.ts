import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { corsMiddleware } from '../../shared/middleware/cors';
import { compressionMiddleware } from '../../shared/middleware/compression';
import { getF1Client } from './f1-client';
import logger from '../../shared/logger';
import type { HealthResponse, Driver } from '../../types';

const app = new Hono();

// Apply middleware
app.use('*', corsMiddleware());
app.use('*', compressionMiddleware());

// Get F1 client singleton
const f1Client = getF1Client();

// Start F1 client
f1Client.start().catch((error) => {
  logger.error({ error }, 'Failed to start F1 client');
});

// Health check endpoint
app.get('/api/health', (c) => {
  const response: HealthResponse = { success: true };
  return c.json(response);
});

// Server-Sent Events endpoint for live timing
app.get('/api/sse', async (c) => {
  logger.info('New SSE client connected');

  return streamSSE(c, async (stream) => {
    // Send initial state
    const initialState = f1Client.getState();
    await stream.writeSSE({
      event: 'initial',
      data: JSON.stringify(initialState),
    });

    // Set up message handler for updates
    const removeHandler = f1Client.onMessage(async (type, data) => {
      try {
        await stream.writeSSE({
          event: type,
          data: JSON.stringify(data),
        });
      } catch (error) {
        logger.error({ error }, 'Error sending SSE update');
      }
    });

    // Keep-alive interval (every 10 seconds)
    const keepAliveInterval = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: 'ping',
          data: JSON.stringify({ timestamp: Date.now() }),
        });
      } catch (error) {
        logger.debug('Client disconnected during keep-alive');
        clearInterval(keepAliveInterval);
      }
    }, 10000);

    // Handle client disconnect
    stream.onAbort(() => {
      logger.info('SSE client disconnected');
      removeHandler();
      clearInterval(keepAliveInterval);
    });

    // Keep the stream open
    await stream.sleep(Number.MAX_SAFE_INTEGER);
  });
});

// Get drivers list
app.get('/api/drivers', (c) => {
  try {
    const state = f1Client.getState();
    const driverList = state.driverList || {};

    // Convert driver map to array
    const drivers: Driver[] = Object.values(driverList);

    return c.json(drivers);
  } catch (error) {
    logger.error({ error }, 'Error getting drivers');
    return c.json({ error: 'Failed to fetch drivers' }, 500);
  }
});

// Start server
const port = parseInt(process.env.LIVE_PORT || '4000');
const address = process.env.LIVE_ADDRESS || '0.0.0.0';

logger.info({ port, address }, 'Starting Live service');

export default {
  port,
  hostname: address,
  fetch: app.fetch,
};
