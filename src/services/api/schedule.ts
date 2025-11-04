import ICAL from 'ical.js';
import logger from '../../shared/logger';
import type { Round, Session } from '../../types';

const SCHEDULE_CACHE_KEY = 'f1-schedule';
let scheduleCache: { data: Round[]; timestamp: number } | null = null;

/**
 * Fetch and parse F1 schedule from iCal feed
 */
async function fetchSchedule(): Promise<Round[]> {
  const icalUrl = process.env.F1_ICAL_URL || 'https://ics.ecal.com/ecal-sub/660897ca63f9ca0008bcbea6/Formula%201.ics';

  try {
    logger.debug({ url: icalUrl }, 'Fetching F1 schedule from iCal');
    const response = await fetch(icalUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch iCal: ${response.statusText}`);
    }

    const icalData = await response.text();
    return parseICalSchedule(icalData);
  } catch (error) {
    logger.error({ error }, 'Error fetching F1 schedule');
    throw error;
  }
}

/**
 * Parse iCal data into Round objects
 */
function parseICalSchedule(icalData: string): Round[] {
  const jcalData = ICAL.parse(icalData);
  const vcalendar = new ICAL.Component(jcalData);
  const vevents = vcalendar.getAllSubcomponents('vevent');

  const roundsMap = new Map<string, Round>();

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);

    // Extract location and session type from summary
    // Format: "Monaco - Qualifying" or "Monaco Grand Prix"
    const summary = event.summary;
    const location = event.location;

    // Parse country and event name
    const match = summary.match(/^(.+?)\s*(?:-\s*(.+)|Grand Prix)$/);
    if (!match) continue;

    const countryName = match[1].trim();
    const sessionKind = match[2]?.trim() || 'Race';

    // Generate a unique key for this round
    const roundKey = `${countryName}-${event.startDate.toJSDate().getFullYear()}`;

    // Get or create round
    let round = roundsMap.get(roundKey);
    if (!round) {
      round = {
        name: countryName,
        countryName: countryName,
        countryKey: countryName.toUpperCase().replace(/\s+/g, '_'),
        start: event.startDate.toJSDate().toISOString(),
        end: event.endDate.toJSDate().toISOString(),
        sessions: [],
        over: event.endDate.toJSDate() < new Date(),
      };
      roundsMap.set(roundKey, round);
    }

    // Determine session kind
    let kind: Session['kind'] = 'Race';
    if (sessionKind.toLowerCase().includes('practice')) {
      kind = 'Practice';
    } else if (sessionKind.toLowerCase().includes('qualifying')) {
      kind = 'Qualifying';
    } else if (sessionKind.toLowerCase().includes('sprint')) {
      kind = 'Sprint';
    }

    // Add session
    round.sessions.push({
      kind,
      start: event.startDate.toJSDate().toISOString(),
      end: event.endDate.toJSDate().toISOString(),
    });

    // Update round start/end times if needed
    const sessionStart = event.startDate.toJSDate();
    const sessionEnd = event.endDate.toJSDate();
    if (sessionStart < new Date(round.start)) {
      round.start = sessionStart.toISOString();
    }
    if (sessionEnd > new Date(round.end)) {
      round.end = sessionEnd.toISOString();
    }
  }

  // Convert map to array and sort by start date
  const rounds = Array.from(roundsMap.values()).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  logger.info({ count: rounds.length }, 'Parsed F1 schedule');
  return rounds;
}

/**
 * Get schedule with caching
 */
export async function getSchedule(): Promise<Round[]> {
  const cacheTTL = parseInt(process.env.SCHEDULE_CACHE_TTL || '1800') * 1000; // Convert to ms
  const now = Date.now();

  // Check cache
  if (scheduleCache && now - scheduleCache.timestamp < cacheTTL) {
    logger.debug('Returning cached schedule');
    return scheduleCache.data;
  }

  // Fetch fresh data
  const schedule = await fetchSchedule();

  // Update cache
  scheduleCache = {
    data: schedule,
    timestamp: now,
  };

  return schedule;
}

/**
 * Get next upcoming race
 */
export async function getNextRound(): Promise<Round | null> {
  const schedule = await getSchedule();
  const now = new Date();

  const upcomingRounds = schedule.filter((round) => new Date(round.end) > now);

  if (upcomingRounds.length === 0) {
    return null;
  }

  return upcomingRounds[0];
}
