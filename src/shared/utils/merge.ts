/**
 * Deep merge two objects
 * Used to merge F1 data updates into existing state
 */
export function deepMerge(target: any, source: any): any {
  if (!source) return target;
  if (!target) return source;

  // Handle primitives
  if (typeof source !== 'object' || source === null) {
    return source;
  }

  // Handle arrays - replace instead of merge
  if (Array.isArray(source)) {
    return source;
  }

  // Handle objects
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Merge multiple updates into a state object
 */
export function mergeUpdates(state: any, updates: Array<[string, any]>): any {
  let result = { ...state };

  for (const [key, value] of updates) {
    result[key] = deepMerge(result[key], value);
  }

  return result;
}
