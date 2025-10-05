/**
 * Parse cache configuration
 */

import { parseCache } from "./parse-cache.js";

/**
 * Configuration options for the parse result cache
 */
export interface ParseCacheConfig {
  /**
   * Whether caching is enabled
   * @default true
   */
  enabled: boolean;

  /**
   * Maximum number of cached parse results
   * @default 1024
   */
  capacity: number;
}

/**
 * Current cache configuration
 */
let currentConfig: ParseCacheConfig = {
  enabled: true,
  capacity: 1024,
};

/**
 * Update parse cache configuration
 */
export function setParseCacheConfig(config: Partial<ParseCacheConfig>): void {
  currentConfig = { ...currentConfig, ...config };

  if (config.capacity !== undefined) {
    parseCache.setCapacity(currentConfig.capacity);
  }
}

/**
 * Get current parse cache configuration
 */
export function getParseCacheConfig(): ParseCacheConfig {
  return { ...currentConfig };
}

/**
 * Clear all cached parse results
 */
export function clearParseCache(): void {
  parseCache.clear();
}
