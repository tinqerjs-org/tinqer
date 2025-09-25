/**
 * Visitor for comparison expressions (==, !=, >, >=, <, <=)
 * Produces boolean expressions from value comparisons
 */

import type { ComparisonExpression, ValueExpression, ColumnExpression } from "../../expressions/expression.js";

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
import { createAutoParam } from "../types.js";

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

  // First, detect field names by checking if either side is a column
  let fieldName: string | undefined;
  let tableName: string | undefined;

  // Check left side for column (without creating parameters yet)
  const leftNode = node.left as ASTExpression;
  const rightNode = node.right as ASTExpression;

  // Peek at non-literal expressions to find column names
  if (!isLiteral(leftNode)) {
    const leftExpr = visitExpression(leftNode, context) as ValueExpression;
    if (leftExpr && leftExpr.type === "column") {
      const col = leftExpr as ColumnExpression;
      fieldName = col.name;
      tableName = context.currentTable;
    }
  }

  if (!fieldName && !isLiteral(rightNode)) {
    const rightExpr = visitExpression(rightNode, context) as ValueExpression;
    if (rightExpr && rightExpr.type === "column") {
      const col = rightExpr as ColumnExpression;
      fieldName = col.name;
      tableName = context.currentTable;
    }
  }

  // Now process both sides, with field context for literals
  let left: ValueExpression | null = null;
  if (isLiteral(leftNode)) {
    left = visitLiteralWithContext(leftNode, context, fieldName, tableName) as ValueExpression;
  } else {
    left = visitExpression(leftNode, context) as ValueExpression;
  }

  let right: ValueExpression | null = null;
  if (isLiteral(rightNode)) {
    right = visitLiteralWithContext(rightNode, context, fieldName, tableName) as ValueExpression;
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
 * Visit literal with field context
 */
function visitLiteralWithContext(
  node: Literal | NumericLiteral | StringLiteral | BooleanLiteral | NullLiteral,
  context: VisitorContext,
  fieldName?: string,
  tableName?: string,
): ValueExpression {
  // Extract value based on literal type
  let value: string | number | boolean | null;

  switch (node.type) {
    case "NumericLiteral":
      value = (node as NumericLiteral).value;
      break;
    case "StringLiteral":
      value = (node as StringLiteral).value;
      break;
    case "BooleanLiteral":
      value = (node as BooleanLiteral).value;
      break;
    case "NullLiteral":
      value = null;
      break;
    default:
      // Generic Literal type
      value = (node as Literal).value;
  }

  // Special case: null is not parameterized (needed for IS NULL/IS NOT NULL)
  if (value === null) {
    return {
      type: "constant",
      value: null,
      valueType: "null",
    } as ValueExpression;
  }

  // Auto-parameterize with field context
  const paramName = createAutoParam(context, value, {
    fieldName,
    tableName,
  });

  return {
    type: "param",
    param: paramName,
  } as ValueExpression;
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
