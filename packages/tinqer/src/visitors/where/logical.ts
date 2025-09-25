/**
 * WHERE logical expression visitor
 * Handles AND (&&) and OR (||) logical operators
 */

import type { LogicalExpression, BooleanExpression } from "../../expressions/expression.js";

import type { LogicalExpression as ASTLogicalExpression } from "../../parser/ast-types.js";
import type { WhereContext, VisitorResult } from "./context.js";
import { visitPredicate } from "./predicate.js";

/**
 * Visit logical expression in WHERE context
 */
export function visitLogical(
  node: ASTLogicalExpression,
  context: WhereContext,
): VisitorResult<LogicalExpression | null> {
  let currentCounter = context.autoParamCounter;

  // Only handle boolean logical operators
  if (node.operator !== "&&" && node.operator !== "||") {
    return { value: null, counter: currentCounter };
  }

  // Visit left and right as predicates
  const leftResult = visitPredicate(node.left, { ...context, autoParamCounter: currentCounter });
  const left = leftResult.value;
  currentCounter = leftResult.counter;

  const rightResult = visitPredicate(node.right, { ...context, autoParamCounter: currentCounter });
  const right = rightResult.value;
  currentCounter = rightResult.counter;

  if (!left || !right) return { value: null, counter: currentCounter };

  // Convert to SQL-style operator names
  const operator = node.operator === "&&" ? "and" : "or";

  return {
    value: {
      type: "logical",
      operator,
      left: ensureBoolean(left),
      right: ensureBoolean(right),
    },
    counter: currentCounter
  };
}

/**
 * Ensure expression is boolean (already validated as BooleanExpression)
 */
function ensureBoolean(expr: BooleanExpression): BooleanExpression {
  // Expression is already a BooleanExpression, no conversion needed
  return expr;
}
