/**
 * WHERE logical expression visitor
 * Handles AND (&&) and OR (||) logical operators
 */

import type {
  LogicalExpression,
  BooleanExpression,
} from "../../expressions/expression.js";

import type { LogicalExpression as ASTLogicalExpression } from "../../parser/ast-types.js";
import type { WhereContext } from "./context.js";
import { visitPredicate } from "./predicate.js";

/**
 * Visit logical expression in WHERE context
 */
export function visitLogical(
  node: ASTLogicalExpression,
  context: WhereContext
): LogicalExpression | null {
  // Only handle boolean logical operators
  if (node.operator !== "&&" && node.operator !== "||") {
    return null;
  }

  // Visit left and right as predicates
  const left = visitPredicate(node.left, context);
  const right = visitPredicate(node.right, context);

  if (!left || !right) return null;

  // Convert to SQL-style operator names
  const operator = node.operator === "&&" ? "and" : "or";

  return {
    type: "logical",
    operator,
    left: ensureBoolean(left),
    right: ensureBoolean(right),
  };
}

/**
 * Ensure expression is boolean (already validated as BooleanExpression)
 */
function ensureBoolean(expr: BooleanExpression): BooleanExpression {
  // Expression is already a BooleanExpression, no conversion needed
  return expr;
}