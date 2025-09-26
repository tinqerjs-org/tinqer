/**
 * WHERE comparison visitor
 * Handles comparison expressions (==, !=, >, >=, <, <=)
 */

import type {
  ComparisonExpression,
  ValueExpression,
  ColumnExpression,
} from "../../expressions/expression.js";

import type { BinaryExpression } from "../../parser/ast-types.js";
import type { WhereContext, VisitorResult } from "./context.js";
import { visitValue } from "./value.js";

/**
 * Check if node is a literal
 */
function isLiteral(node: unknown): boolean {
  if (!node) return false;
  const type = (node as { type?: string }).type;
  return ["Literal", "NumericLiteral", "StringLiteral", "BooleanLiteral", "NullLiteral"].includes(
    type || "",
  );
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
  let leftFieldName: string | undefined;
  let leftTableName: string | undefined;
  let rightFieldName: string | undefined;
  let rightTableName: string | undefined;
  let leftExpr: ValueExpression | null = null;
  let rightExpr: ValueExpression | null = null;

  // Helper to extract field context from expressions (only for direct columns)
  const extractFieldFromExpression = (
    expr: ValueExpression,
  ): { fieldName?: string; tableName?: string } => {
    if (expr.type === "column") {
      return {
        fieldName: (expr as ColumnExpression).name,
        tableName: context.currentTable,
      };
    }
    // Don't extract field from arithmetic - literals in arithmetic get context internally
    return {};
  };

  // Process non-literals first to detect field names and save results
  if (!isLiteral(node.left)) {
    const leftResult = visitValue(node.left, { ...context, autoParamCounter: currentCounter });
    leftExpr = leftResult.value;
    currentCounter = leftResult.counter;
    if (leftExpr) {
      const extracted = extractFieldFromExpression(leftExpr);
      leftFieldName = extracted.fieldName;
      leftTableName = extracted.tableName;
    }
  }

  if (!isLiteral(node.right)) {
    const rightResult = visitValue(node.right, { ...context, autoParamCounter: currentCounter });
    rightExpr = rightResult.value;
    currentCounter = rightResult.counter;
    if (rightExpr) {
      const extracted = extractFieldFromExpression(rightExpr);
      rightFieldName = extracted.fieldName;
      rightTableName = extracted.tableName;
    }
  }

  // Visit literals with appropriate field context
  let left = leftExpr;
  let right = rightExpr;

  if (!left) {
    // Left is a literal - use field context from right side if it's a column
    const leftContext = rightFieldName
      ? {
          ...context,
          autoParamCounter: currentCounter,
          _currentFieldName: rightFieldName,
          _currentTableName: rightTableName,
          _currentSourceTable: undefined,
        }
      : {
          ...context,
          autoParamCounter: currentCounter,
          _currentTableName: context.currentTable, // Keep table context even without field
          _currentSourceTable: undefined,
        };

    const leftResult = visitValue(node.left, leftContext);
    left = leftResult.value;
    currentCounter = leftResult.counter;
  }

  if (!right) {
    // Right is a literal - use field context from left side if it's a column
    const rightContext = leftFieldName
      ? {
          ...context,
          autoParamCounter: currentCounter,
          _currentFieldName: leftFieldName,
          _currentTableName: leftTableName,
          _currentSourceTable: undefined,
        }
      : {
          ...context,
          autoParamCounter: currentCounter,
          _currentTableName: context.currentTable, // Keep table context even without field
          _currentSourceTable: undefined,
        };

    const rightResult = visitValue(node.right, rightContext);
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
    counter: currentCounter,
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
