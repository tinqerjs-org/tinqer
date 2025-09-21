/**
 * TAKE (LIMIT) clause generator
 */

import type { TakeOperation, ParamRef } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";

/**
 * Generate LIMIT clause
 */
export function generateTake(operation: TakeOperation, context: SqlContext): string {
  if (typeof operation.count === "number") {
    return `LIMIT ${operation.count}`;
  } else {
    // Parameter reference
    const paramRef = operation.count as ParamRef;
    const param = paramRef.property
      ? `${context.paramPrefix}${paramRef.param}.${paramRef.property}`
      : `${context.paramPrefix}${paramRef.param}`;
    return `LIMIT ${param}`;
  }
}