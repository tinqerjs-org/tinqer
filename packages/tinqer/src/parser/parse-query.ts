/**
 * Main parsing function for query builder functions
 */

import type { QueryOperation } from "../query-tree/operations.js";
import type { Expression as ASTExpression } from "./ast-types.js";
import { parseJavaScript } from "./oxc-parser.js";
import { convertAstToQueryOperationWithParams } from "./ast-visitor.js";
import type { Queryable, OrderedQueryable } from "../linq/queryable.js";
import type { TerminalQuery } from "../linq/terminal-query.js";

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
 * @param queryBuilder The function that builds the query
 * @returns The parsed result containing operation tree and auto-params, or null if parsing fails
 */
export function parseQuery<TParams, TResult>(
  queryBuilder: (
    params: TParams,
  ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>,
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

    return {
      operation: result.operation,
      autoParams: result.autoParams as Record<string, string | number | boolean | null>,
      autoParamInfos: result.autoParamInfos,
    };
  } catch (error) {
    console.error("Failed to parse query:", error);
    return null;
  }
}
