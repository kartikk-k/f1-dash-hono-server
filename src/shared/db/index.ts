import pg from 'pg';
import logger from '../logger';
import type { Laptime, Gap } from '../../types';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function initDatabase() {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected error on idle database client');
  });

  logger.info('Database connection pool initialized');
  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) {
    return initDatabase();
  }
  return pool;
}

/**
 * Get lap times for a driver
 */
export async function getLaptimes(driverNr: string): Promise<Laptime[]> {
  const query = `
    SELECT
      time,
      lap,
      MIN(laptime) as laptime
    FROM timing_driver
    WHERE nr = $1
    GROUP BY lap, time
    ORDER BY lap ASC
  `;

  try {
    const pool = getPool();
    const result = await pool.query(query, [driverNr]);

    return result.rows.map((row) => ({
      time: row.time.toISOString(),
      lap: row.lap,
      laptime: row.laptime,
    }));
  } catch (error) {
    logger.error({ error, driverNr }, 'Error fetching lap times');
    throw error;
  }
}

/**
 * Get gap to leader for a driver
 */
export async function getGaps(driverNr: string): Promise<Gap[]> {
  const query = `
    SELECT
      time,
      gap
    FROM timing_driver
    WHERE nr = $1 AND gap != 0
    ORDER BY time ASC
  `;

  try {
    const pool = getPool();
    const result = await pool.query(query, [driverNr]);

    return result.rows.map((row) => ({
      time: row.time.toISOString(),
      gap: row.gap,
    }));
  } catch (error) {
    logger.error({ error, driverNr }, 'Error fetching gaps');
    throw error;
  }
}

/**
 * Insert timing data for a driver
 */
export async function insertTimingDriver(data: {
  nr: string;
  lap?: number;
  gap?: number;
  leaderGap?: number;
  laptime?: number;
  sector1?: number;
  sector2?: number;
  sector3?: number;
}) {
  const query = `
    INSERT INTO timing_driver (nr, lap, gap, leader_gap, laptime, sector_1, sector_2, sector_3)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;

  try {
    const pool = getPool();
    await pool.query(query, [
      data.nr,
      data.lap ?? null,
      data.gap ?? null,
      data.leaderGap ?? null,
      data.laptime ?? null,
      data.sector1 ?? null,
      data.sector2 ?? null,
      data.sector3 ?? null,
    ]);
  } catch (error) {
    logger.error({ error, data }, 'Error inserting timing data');
    throw error;
  }
}

/**
 * Insert tire data for a driver
 */
export async function insertTireDriver(data: {
  nr: string;
  lap: number;
  compound: string;
  laps: number;
}) {
  const query = `
    INSERT INTO tire_driver (nr, lap, compound, laps)
    VALUES ($1, $2, $3, $4)
  `;

  try {
    const pool = getPool();
    await pool.query(query, [data.nr, data.lap, data.compound, data.laps]);
  } catch (error) {
    logger.error({ error, data }, 'Error inserting tire data');
    throw error;
  }
}
