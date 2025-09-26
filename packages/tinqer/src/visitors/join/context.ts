/**
 * JOIN operation context
 * Provides context for JOIN visitors
 */

import type { ResultShape } from "../../query-tree/operations.js";

/**
 * Join visitor context
 */
export interface JoinContext {
  tableParams: Set<string>;
  queryParams: Set<string>;
  joinParams?: Map<string, number>;
  currentResultShape?: ResultShape;
  joinResultParam?: string;
}
