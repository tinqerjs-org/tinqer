/**
 * WHERE comparison visitor
 * Handles comparison expressions (==, !=, >, >=, <, <=)
 */

import type { ComparisonExpression, ValueExpression } from "../../expressions/expression.js";

import type { BinaryExpression } from "../../parser/ast-types.js";
import type { WhereContext } from "./context.js";
import { visitValue } from "./predicate.js";

/**
 * Visit comparison expression in WHERE context
 */
export function visitComparison(
  node: BinaryExpression,
  context: WhereContext,
): ComparisonExpression | null {
  // Normalize operator (=== to ==, !== to !=)
  const operator = normalizeOperator(node.operator);
  if (!operator) return null;

  // Visit left and right operands as value expressions
  const left = visitValue(node.left, context);
  const right = visitValue(node.right, context);

  if (!left || !right) return null;

  return {
    type: "comparison",
    operator,
    left: left as ValueExpression,
    right: right as ValueExpression,
  };
}

/**
 * Normalize JavaScript operators to SQL-style
 */
function normalizeOperator(op: string): ComparisonExpression["operator"] | null {
  switch (op) {
    case "==":
    case "===":
      return "==";
    case "!=":
    case "!==":
      return "!=";
    case ">":
      return ">";
    case ">=":
      return ">=";
    case "<":
      return "<";
    case "<=":
      return "<=";
    default:
      return null;
  }
}
