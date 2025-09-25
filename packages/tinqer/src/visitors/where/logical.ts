/**
 * WHERE logical expression visitor
 * Handles AND (&&) and OR (||) logical operators
 */

import type {
  LogicalExpression,
  BooleanExpression,
  ColumnExpression,
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
 * Ensure expression is boolean (convert column to booleanColumn if needed)
 */
function ensureBoolean(expr: BooleanExpression): BooleanExpression {
  // If it's a plain column, wrap it as booleanColumn
  if (expr.type === "column") {
    const col = expr as unknown as ColumnExpression;
    return {
      type: "booleanColumn",
      name: col.name,
      ...(col.table && { table: col.table }),
    };
  }
  return expr;
}