/**
 * Visitor for comparison expressions (==, !=, >, >=, <, <=)
 * Produces boolean expressions from value comparisons
 */

import type { ComparisonExpression, ValueExpression } from "../../expressions/expression.js";

import type {
  BinaryExpression as ASTBinaryExpression,
  Expression as ASTExpression,
  Literal,
  NumericLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,
} from "../../parser/ast-types.js";

import type { VisitorContext } from "../types.js";
import { visitLiteral } from "../common/literal.js";

/**
 * Visit a comparison expression
 */
export function visitComparison(
  node: ASTBinaryExpression,
  context: VisitorContext,
  visitExpression: (node: unknown, ctx: VisitorContext) => unknown,
): ComparisonExpression | null {
  const operator = normalizeComparisonOperator(node.operator);
  if (!operator) return null;

  // Convert left side
  let left: ValueExpression | null = null;
  const leftNode = node.left as ASTExpression;
  if (isLiteral(leftNode)) {
    left = visitLiteral(leftNode, context) as ValueExpression;
  } else {
    left = visitExpression(leftNode, context) as ValueExpression;
  }

  // Convert right side
  let right: ValueExpression | null = null;
  const rightNode = node.right as ASTExpression;
  if (isLiteral(rightNode)) {
    right = visitLiteral(rightNode, context) as ValueExpression;
  } else {
    right = visitExpression(rightNode, context) as ValueExpression;
  }

  if (!left || !right) {
    throw new Error(
      `Failed to convert comparison expression with operator '${operator}'. ` +
        `Left: ${left ? "converted" : "failed"}, Right: ${right ? "converted" : "failed"}`,
    );
  }

  return {
    type: "comparison",
    operator,
    left,
    right,
  } as ComparisonExpression;
}

/**
 * Normalize JavaScript comparison operators to SQL-style
 */
function normalizeComparisonOperator(op: string): ComparisonExpression["operator"] | null {
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

/**
 * Check if node is a literal type
 */
function isLiteral(
  node: unknown,
): node is Literal | NumericLiteral | StringLiteral | BooleanLiteral | NullLiteral {
  if (!node) return false;
  const type = (node as { type?: string }).type;
  return ["Literal", "NumericLiteral", "StringLiteral", "BooleanLiteral", "NullLiteral"].includes(
    type || "",
  );
}
