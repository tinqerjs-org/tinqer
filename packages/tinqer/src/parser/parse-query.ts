/**
 * Main parsing function for query builder functions
 */

import type { QueryOperation } from "../query-tree/operations.js";
import { parseJavaScript } from "./oxc-parser.js";
import { convertAstToQueryOperation } from "../converter/ast-converter.js";
import type { Queryable } from "../linq/queryable.js";
import type { TerminalQuery } from "../linq/terminal-query.js";

/**
 * Parses a query builder function into a QueryOperation tree
 * @param queryBuilder The function that builds the query
 * @returns The parsed QueryOperation tree or null if parsing fails
 */
export function parseQuery<TParams, TResult>(
  queryBuilder: (params: TParams) => Queryable<TResult> | TerminalQuery<TResult>
): QueryOperation | null {
  try {
    // 1. Convert function to string
    const fnString = queryBuilder.toString();

    // 2. Parse with OXC to get AST
    const ast = parseJavaScript(fnString);
    if (!ast) {
      return null;
    }

    // 3. Convert AST to QueryOperation tree
    const queryOperation = convertAstToQueryOperation(ast);

    return queryOperation;
  } catch (error) {
    console.error("Failed to parse query:", error);
    return null;
  }
}