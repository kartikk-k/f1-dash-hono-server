import { Hono } from 'hono';
import { corsMiddleware } from '../../shared/middleware/cors';
import { getSchedule, getNextRound } from './schedule';
import logger from '../../shared/logger';
import type { HealthResponse } from '../../types';

const app = new Hono();

// Apply CORS middleware
app.use('*', corsMiddleware());

// Health check endpoint
app.get('/api/health', (c) => {
  const response: HealthResponse = { success: true };
  return c.json(response);
});

// Get full schedule
app.get('/api/schedule', async (c) => {
  try {
    const schedule = await getSchedule();
    return c.json(schedule);
  } catch (error) {
    logger.error({ error }, 'Error getting schedule');
    return c.json({ error: 'Failed to fetch schedule' }, 500);
  }
});

// Get next upcoming race
app.get('/api/schedule/next', async (c) => {
  try {
    const nextRound = await getNextRound();

    if (!nextRound) {
      return c.body(null, 204);
    }

    return c.json(nextRound);
  } catch (error) {
    logger.error({ error }, 'Error getting next round');
    return c.json({ error: 'Failed to fetch next round' }, 500);
  }
});

// Start server
const port = parseInt(process.env.API_PORT || '4001');
const address = process.env.API_ADDRESS || '0.0.0.0';

logger.info({ port, address }, 'Starting API service');

export default {
  port,
  hostname: address,
  fetch: app.fetch,
};
