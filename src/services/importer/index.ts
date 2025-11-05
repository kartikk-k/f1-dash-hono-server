import { getF1Client } from '../live/f1-client';
import { insertTimingDriver, insertTireDriver, initDatabase } from '../../shared/db';
import { parseGap, parseLaptime, parseSector } from '../../shared/utils/parsers';
import logger from '../../shared/logger';

// Initialize database
try {
  initDatabase();
  logger.info('Database initialized for Importer service');
} catch (error) {
  logger.error({ error }, 'Failed to initialize database');
  process.exit(1);
}

// Get F1 client singleton
const f1Client = getF1Client();

/**
 * Parse and store timing data
 */
async function handleTimingData(data: any): Promise<void> {
  if (!data || typeof data !== 'object') return;

  for (const [driverNr, driverData] of Object.entries(data)) {
    if (!driverData || typeof driverData !== 'object') continue;

    const driver = driverData as any;

    try {
      const timingData: any = {
        nr: driverNr,
      };

      // Parse lap number
      if (driver.Line !== undefined) {
        timingData.lap = parseInt(driver.Line);
      }

      // Parse gap
      if (driver.GapToLeader) {
        timingData.gap = parseGap(driver.GapToLeader);
      }

      // Parse leader gap (interval to car ahead)
      if (driver.IntervalToPositionAhead) {
        timingData.leaderGap = parseGap(driver.IntervalToPositionAhead.Value);
      }

      // Parse laptime
      if (driver.LastLapTime?.Value) {
        timingData.laptime = parseLaptime(driver.LastLapTime.Value);
      }

      // Parse sectors
      if (driver.Sectors) {
        if (driver.Sectors['0']?.Value) {
          timingData.sector1 = parseSector(driver.Sectors['0'].Value);
        }
        if (driver.Sectors['1']?.Value) {
          timingData.sector2 = parseSector(driver.Sectors['1'].Value);
        }
        if (driver.Sectors['2']?.Value) {
          timingData.sector3 = parseSector(driver.Sectors['2'].Value);
        }
      }

      // Insert if we have meaningful data
      if (Object.keys(timingData).length > 1) {
        await insertTimingDriver(timingData);
        logger.debug({ driverNr, data: timingData }, 'Inserted timing data');
      }
    } catch (error) {
      logger.error({ error, driverNr }, 'Error processing timing data');
    }
  }
}

/**
 * Parse and store tire data
 */
async function handleTireData(data: any): Promise<void> {
  if (!data || typeof data !== 'object') return;

  for (const [driverNr, driverData] of Object.entries(data)) {
    if (!driverData || typeof driverData !== 'object') continue;

    const driver = driverData as any;

    try {
      // Parse tire stint data
      if (driver.Stints) {
        for (const stint of driver.Stints) {
          if (!stint || typeof stint !== 'object') continue;

          const compound = stint.Compound;
          const totalLaps = parseInt(stint.TotalLaps || stint.LapNumber || '0');
          const lapNumber = parseInt(stint.LapNumber || '0');

          if (compound && totalLaps > 0) {
            await insertTireDriver({
              nr: driverNr,
              lap: lapNumber,
              compound,
              laps: totalLaps,
            });

            logger.debug({ driverNr, compound, laps: totalLaps }, 'Inserted tire data');
          }
        }
      }
    } catch (error) {
      logger.error({ error, driverNr }, 'Error processing tire data');
    }
  }
}

/**
 * Handle F1 messages
 */
function handleMessage(type: 'initial' | 'updates', data: any): void {
  try {
    if (type === 'initial') {
      // Initial state - process all topics
      if (data.timingData) {
        handleTimingData(data.timingData).catch((error) => {
          logger.error({ error }, 'Error handling initial timing data');
        });
      }
      if (data.timingAppData) {
        handleTireData(data.timingAppData).catch((error) => {
          logger.error({ error }, 'Error handling initial tire data');
        });
      }
    } else if (type === 'updates') {
      // Updates - process each update
      for (const [topic, topicData] of data) {
        if (topic === 'timingData') {
          handleTimingData(topicData).catch((error) => {
            logger.error({ error }, 'Error handling timing data update');
          });
        } else if (topic === 'timingAppData') {
          handleTireData(topicData).catch((error) => {
            logger.error({ error }, 'Error handling tire data update');
          });
        }
      }
    }
  } catch (error) {
    logger.error({ error, type }, 'Error handling message');
  }
}

// Start F1 client and listen for messages
async function main() {
  logger.info('Starting Importer service');

  // Subscribe to F1 messages
  f1Client.onMessage(handleMessage);

  // Start F1 client
  await f1Client.start();

  logger.info('Importer service started and listening for F1 data');

  // Keep the process running
  process.on('SIGINT', async () => {
    logger.info('Shutting down Importer service');
    await f1Client.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down Importer service');
    await f1Client.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error in Importer service');
  process.exit(1);
});
