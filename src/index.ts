#!/usr/bin/env bun
/**
 * F1 Dashboard Backend - Hono.js Migration
 *
 * This is the main entry point that starts all services.
 * You can also run services individually using:
 * - bun run src/services/api/index.ts
 * - bun run src/services/live/index.ts
 * - bun run src/services/analytics/index.ts
 * - bun run src/services/importer/index.ts
 */

import logger from './shared/logger';

async function main() {
  logger.info('Starting F1 Dashboard Backend Services');

  // Import all services
  const [apiService, liveService, analyticsService] = await Promise.all([
    import('./services/api/index'),
    import('./services/live/index'),
    import('./services/analytics/index'),
  ]);

  // Start all services
  const servers = await Promise.all([
    Bun.serve(apiService.default),
    Bun.serve(liveService.default),
    Bun.serve(analyticsService.default),
  ]);

  logger.info({
    api: `http://${apiService.default.hostname}:${apiService.default.port}`,
    live: `http://${liveService.default.hostname}:${liveService.default.port}`,
    analytics: `http://${analyticsService.default.hostname}:${analyticsService.default.port}`,
  }, 'All services started successfully');

  // Start importer service in the background
  import('./services/importer/index').catch((error) => {
    logger.error({ error }, 'Failed to start Importer service');
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down all services...');

    for (const server of servers) {
      server.stop();
    }

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error starting services');
  process.exit(1);
});
