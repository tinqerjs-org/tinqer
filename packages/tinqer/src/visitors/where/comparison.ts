/**
 * WHERE comparison visitor
 * Handles comparison expressions (==, !=, >, >=, <, <=)
 */

import type { ComparisonExpression, ValueExpression, ColumnExpression } from "../../expressions/expression.js";

import type { BinaryExpression } from "../../parser/ast-types.js";
import type { WhereContext, VisitorResult } from "./context.js";
import { visitValue } from "./predicate.js";

/**
 * Check if node is a literal
 */
function isLiteral(node: unknown): boolean {
  if (!node) return false;
  const type = (node as { type?: string }).type;
  return ["Literal", "NumericLiteral", "StringLiteral", "BooleanLiteral", "NullLiteral"].includes(type || "");
}

/**
 * Visit comparison expression in WHERE context
 */
export function visitComparison(
  node: BinaryExpression,
  context: WhereContext,
): VisitorResult<ComparisonExpression | null> {
  let currentCounter = context.autoParamCounter;

  // Normalize operator (=== to ==, !== to !=)
  const operator = normalizeOperator(node.operator);
  if (!operator) return { value: null, counter: currentCounter };

  // First detect field names by looking at the structure
  let fieldName: string | undefined;
  let tableName: string | undefined;
  let leftExpr: ValueExpression | null = null;
  let rightExpr: ValueExpression | null = null;

  // Process non-literals first to detect field names and save results
  if (!isLiteral(node.left)) {
    const leftResult = visitValue(node.left, { ...context, autoParamCounter: currentCounter });
    leftExpr = leftResult.value;
    currentCounter = leftResult.counter;
    if (leftExpr && leftExpr.type === "column") {
      fieldName = (leftExpr as ColumnExpression).name;
      tableName = context.currentTable;
    }
  }

  if (!isLiteral(node.right)) {
    const rightResult = visitValue(node.right, { ...context, autoParamCounter: currentCounter });
    rightExpr = rightResult.value;
    currentCounter = rightResult.counter;
    if (rightExpr && rightExpr.type === "column") {
      fieldName = (rightExpr as ColumnExpression).name;
      tableName = context.currentTable;
    }
  }

  // Create a temporary context with field info for literal processing
  const enhancedContext = fieldName ? {
    ...context,
    autoParamCounter: currentCounter,
    _currentFieldName: fieldName,
    _currentTableName: tableName,
  } : { ...context, autoParamCounter: currentCounter };

  // Visit literals with field context, or reuse already-processed non-literals
  let left = leftExpr;
  let right = rightExpr;

  if (!left) {
    const leftResult = visitValue(node.left, enhancedContext);
    left = leftResult.value;
    currentCounter = leftResult.counter;
  }

  if (!right) {
    const rightResult = visitValue(node.right, { ...enhancedContext, autoParamCounter: currentCounter });
    right = rightResult.value;
    currentCounter = rightResult.counter;
  }

  if (!left || !right) return { value: null, counter: currentCounter };

  return {
    value: {
      type: "comparison",
      operator,
      left: left as ValueExpression,
      right: right as ValueExpression,
    },
    counter: currentCounter
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
