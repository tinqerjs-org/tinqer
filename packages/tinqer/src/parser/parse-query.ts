/**
 * Main parsing function for query builder functions
 */

import type { QueryOperation } from "../query-tree/operations.js";
import type { Expression as ASTExpression } from "./ast-types.js";
import { parseJavaScript } from "./oxc-parser.js";
import { convertAstToQueryOperationWithParams } from "./ast-visitor.js";
import { normalizeJoins } from "./normalize-joins.js";
import { wrapWindowFilters } from "./normalize-window-filters.js";
import type { createQueryHelpers } from "../linq/functions.js";
import { parseCache, type CachedParseResult } from "./parse-cache.js";
import { getParseCacheConfig } from "./parse-cache-config.js";
import type { ParseQueryOptions } from "./types.js";
import { snapshotVisitorContext } from "../visitors/types.js";
import type { VisitorContextSnapshot } from "../visitors/types.js";

/**
 * Result of parsing a query, including auto-extracted parameters
 */
export interface ParseResult {
  operation: QueryOperation;
  autoParams: Record<string, string | number | boolean | null>;
  autoParamInfos?: Record<string, unknown>; // Enhanced field context information
  contextSnapshot: VisitorContextSnapshot;
}

/**
 * Deep freeze an object to make it immutable
 */
function deepFreeze<T>(obj: T): T {
  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as Record<string, unknown>)[prop];
    if (value !== null && (typeof value === "object" || typeof value === "function")) {
      deepFreeze(value);
    }
  });

  return obj;
}

/**
 * Freeze a parse result for caching
 */
function freezeParseResult(result: ParseResult): CachedParseResult {
  return deepFreeze({
    operation: result.operation,
    autoParams: result.autoParams,
    autoParamInfos: result.autoParamInfos,
    contextSnapshot: result.contextSnapshot,
  });
}

/**
 * Clone a cached parse result to return to caller
 */
function cloneParseResult(cached: CachedParseResult): ParseResult {
  return {
    operation: cached.operation, // Frozen, safe to reuse
    autoParams: { ...cached.autoParams } as Record<string, string | number | boolean | null>, // Clone params object
    autoParamInfos: cached.autoParamInfos ? { ...cached.autoParamInfos } : undefined,
    contextSnapshot: cached.contextSnapshot,
  };
}

/**
 * Parses a query builder function into a QueryOperation tree with auto-extracted parameters
 * @param queryBuilder The function that builds the query with DSL context, params, and optional helpers
 * @param options Parse options including cache control
 * @returns The parsed result containing operation tree and auto-params, or null if parsing fails
 */
export function parseQuery<TContext, TParams, TQuery>(
  queryBuilder:
    | ((ctx: TContext) => TQuery)
    | ((ctx: TContext, params: TParams) => TQuery)
    | ((ctx: TContext, params: TParams, helpers: ReturnType<typeof createQueryHelpers>) => TQuery),
  options: ParseQueryOptions = {},
): ParseResult | null {
  try {
    // 1. Convert function to string
    const fnString = queryBuilder.toString();

    // 2. Check cache if enabled
    const config = getParseCacheConfig();
    const useCache = config.enabled && config.capacity > 0 && options.cache !== false;

    if (useCache) {
      const cached = parseCache.get(fnString);
      if (cached) {
        return cloneParseResult(cached);
      }
    }

    // 3. Parse with OXC to get AST
    const program = parseJavaScript(fnString);
    if (!program) {
      return null;
    }

    // Extract the first statement's expression (the arrow function)
    const programNode = program as { body?: Array<{ type: string; expression?: unknown }> };
    if (!programNode.body || programNode.body.length === 0) {
      return null;
    }

    const firstStatement = programNode.body[0];
    if (
      !firstStatement ||
      firstStatement.type !== "ExpressionStatement" ||
      !firstStatement.expression
    ) {
      return null;
    }

    const ast = firstStatement.expression as ASTExpression;

    // 4. Convert AST to QueryOperation tree with auto-params
    const result = convertAstToQueryOperationWithParams(ast);

    if (!result.operation) {
      return null;
    }

    // Apply normalization passes
    let normalizedOperation: QueryOperation | null = result.operation
      ? normalizeJoins(result.operation)
      : null;

    if (!normalizedOperation) {
      return null;
    }

    // Apply window filter wrapping normalization
    normalizedOperation = wrapWindowFilters(normalizedOperation);

    const parseResult: ParseResult = {
      operation: normalizedOperation,
      autoParams: result.autoParams as Record<string, string | number | boolean | null>,
      autoParamInfos: result.autoParamInfos,
      contextSnapshot: snapshotVisitorContext(result.visitorContext),
    };

    // Cache the result if caching is enabled
    if (useCache) {
      const frozen = freezeParseResult(parseResult);
      parseCache.set(fnString, frozen);
      return cloneParseResult(frozen);
    }

    return parseResult;
  } catch (error) {
    console.error("Failed to parse query:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    return null;
  }
}
