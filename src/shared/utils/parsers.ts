/**
 * Parse gap string to milliseconds
 * Examples: "±0.273s" -> 273, "LAP1" -> 0, "1.234" -> 1234
 */
export function parseGap(gap: string | undefined): number {
  if (!gap) return 0;

  // Remove ± and s
  gap = gap.replace(/[±s]/g, '').trim();

  // Check if it's a lap gap
  if (gap.startsWith('LAP')) {
    return 0;
  }

  // Parse as float and convert to milliseconds
  const seconds = parseFloat(gap);
  return isNaN(seconds) ? 0 : Math.round(seconds * 1000);
}

/**
 * Parse laptime string to milliseconds
 * Example: "1:23.456" -> 83456
 */
export function parseLaptime(laptime: string | undefined): number {
  if (!laptime) return 0;

  const parts = laptime.split(':');
  if (parts.length !== 2) return 0;

  const minutes = parseInt(parts[0]);
  const seconds = parseFloat(parts[1]);

  if (isNaN(minutes) || isNaN(seconds)) return 0;

  return Math.round((minutes * 60 + seconds) * 1000);
}

/**
 * Parse sector time to milliseconds
 * Example: "26.259" -> 26259
 */
export function parseSector(sector: string | undefined): number {
  if (!sector) return 0;

  const seconds = parseFloat(sector);
  return isNaN(seconds) ? 0 : Math.round(seconds * 1000);
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform object keys from snake_case to camelCase
 */
export function transformKeys(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(transformKeys);
  }

  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = transformKeys(obj[key]);
    }
  }

  return result;
}
