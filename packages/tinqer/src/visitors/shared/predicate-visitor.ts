/**
 * Shared predicate visitor utility
 * Used by operations that need to convert AST expressions to BooleanExpression
 * (COUNT, ANY, ALL, FIRST, LAST, SINGLE, etc.)
 */

import type {
  BooleanExpression,
  ColumnExpression,
  BooleanColumnExpression,
} from "../../expressions/expression.js";
import type { Expression as ASTExpression } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { visitExpression } from "../index.js";
import { isBooleanExpression } from "../visitor-utils.js";

/**
 * Result type for predicate visitors
 */
export type PredicateResult = {
  predicate: BooleanExpression | undefined;
  autoParams: Record<string, unknown>;
  counter: number;
};

/**
 * Visit an expression and convert to BooleanExpression if possible
 * Used by terminal operations that accept optional predicates
 */
export function visitPredicate(
  node: ASTExpression,
  tableParams: Set<string>,
  queryParams: Set<string>,
  existingAutoParams: Map<string, unknown>,
  startCounter: number = 0,
): PredicateResult {
  // Create visitor context
  const context: VisitorContext = {
    tableParams,
    queryParams,
    autoParams: existingAutoParams,
    autoParamCounter: startCounter,
  };

  // Visit the expression
  const expr = visitExpression(node, context);

  // Convert to boolean if needed
  let predicate: BooleanExpression | undefined;
  if (expr) {
    if (isBooleanExpression(expr)) {
      predicate = expr as BooleanExpression;
    } else if (expr.type === "column") {
      // If we get a column expression in a predicate context,
      // treat it as a boolean column
      predicate = {
        type: "booleanColumn",
        name: (expr as ColumnExpression).name,
        ...((expr as ColumnExpression).table ? { table: (expr as ColumnExpression).table } : {}),
      } as BooleanColumnExpression;
    }
  }

  // Extract auto params
  const autoParams: Record<string, unknown> = {};
  for (const [name, value] of context.autoParams) {
    autoParams[name] = value;
  }

  return {
    predicate,
    autoParams,
    counter: context.autoParamCounter,
  };
}
