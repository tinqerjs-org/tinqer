/**
 * SKIP (OFFSET) clause generator
 */

import type { SkipOperation, ParamRef } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";

/**
 * Generate OFFSET clause
 */
export function generateSkip(operation: SkipOperation, context: SqlContext): string {
  if (typeof operation.count === "number") {
    return `OFFSET ${operation.count}`;
  } else {
    // Parameter reference
    const paramRef = operation.count as ParamRef;
    const param = paramRef.property
      ? `${context.paramPrefix}${paramRef.param}.${paramRef.property}`
      : `${context.paramPrefix}${paramRef.param}`;
    return `OFFSET ${param}`;
  }
}