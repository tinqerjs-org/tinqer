/**
 * Main parsing function for query builder functions
 */

import type { QueryOperation } from "../query-tree/operations.js";
import type { Expression as ASTExpression } from "./ast-types.js";
import { parseJavaScript } from "./oxc-parser.js";
import { convertAstToQueryOperationWithParams } from "./ast-visitor.js";
import { normalizeJoins } from "./normalize-joins.js";
import type { createQueryHelpers } from "../linq/functions.js";

/**
 * Result of parsing a query, including auto-extracted parameters
 */
export interface ParseResult {
  operation: QueryOperation;
  autoParams: Record<string, string | number | boolean | null>;
  autoParamInfos?: Record<string, unknown>; // Enhanced field context information
}

/**
 * Parses a query builder function into a QueryOperation tree with auto-extracted parameters
 * @param queryBuilder The function that builds the query, optionally with helpers as second parameter
 * @returns The parsed result containing operation tree and auto-params, or null if parsing fails
 */
export function parseQuery<TParams, TQuery>(
  queryBuilder:
    | ((params: TParams) => TQuery)
    | ((params: TParams, helpers: ReturnType<typeof createQueryHelpers>) => TQuery),
): ParseResult | null {
  try {
    // 1. Convert function to string
    const fnString = queryBuilder.toString();

    // 2. Parse with OXC to get AST
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

    // 3. Convert AST to QueryOperation tree with auto-params
    const result = convertAstToQueryOperationWithParams(ast);

    if (!result.operation) {
      return null;
    }

    const normalizedOperation: QueryOperation | null = result.operation
      ? normalizeJoins(result.operation)
      : null;

    if (!normalizedOperation) {
      return null;
    }

    return {
      operation: normalizedOperation,
      autoParams: result.autoParams as Record<string, string | number | boolean | null>,
      autoParamInfos: result.autoParamInfos,
    };
  } catch (error) {
    console.error("Failed to parse query:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    return null;
  }
}
