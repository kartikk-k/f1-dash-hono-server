import { Hono } from 'hono';
import { corsMiddleware } from '../../shared/middleware/cors';
import { getLaptimes, getGaps, initDatabase } from '../../shared/db';
import logger from '../../shared/logger';
import type { HealthResponse } from '../../types';

const app = new Hono();

// Initialize database
try {
  initDatabase();
  logger.info('Database initialized for Analytics service');
} catch (error) {
  logger.error({ error }, 'Failed to initialize database');
}

// Apply CORS middleware
app.use('*', corsMiddleware());

// Health check endpoint
app.get('/api/health', (c) => {
  const response: HealthResponse = { success: true };
  return c.json(response);
});

// Get lap times for a driver
app.get('/api/laptime/:driver_nr', async (c) => {
  const driverNr = c.req.param('driver_nr');

  try {
    const laptimes = await getLaptimes(driverNr);
    return c.json(laptimes);
  } catch (error) {
    logger.error({ error, driverNr }, 'Error fetching lap times');
    return c.json({ error: 'Failed to fetch lap times' }, 500);
  }
});

// Get gap to leader for a driver
app.get('/api/gap/:driver_nr', async (c) => {
  const driverNr = c.req.param('driver_nr');

  try {
    const gaps = await getGaps(driverNr);
    return c.json(gaps);
  } catch (error) {
    logger.error({ error, driverNr }, 'Error fetching gaps');
    return c.json({ error: 'Failed to fetch gaps' }, 500);
  }
});

// Start server
const port = parseInt(process.env.ANALYTICS_PORT || '4002');
const address = process.env.ANALYTICS_ADDRESS || '0.0.0.0';

logger.info({ port, address }, 'Starting Analytics service');

export default {
  port,
  hostname: address,
  fetch: app.fetch,
};
