/**
 * Visitor for logical expressions (&&, ||)
 * Combines boolean expressions with logical operators
 */

import type {
  BooleanExpression,
  LogicalExpression,
  ColumnExpression,
  CoalesceExpression,
  ValueExpression,
} from "../../expressions/expression.js";

import type { LogicalExpression as ASTLogicalExpression } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { isValueExpression, isBooleanExpression } from "../utils.js";

/**
 * Visit a logical expression
 */
export function visitLogical(
  node: ASTLogicalExpression,
  context: VisitorContext,
  visitExpression: (node: unknown, ctx: VisitorContext) => unknown,
): LogicalExpression | CoalesceExpression | null {
  const left = visitExpression(node.left, context);
  const right = visitExpression(node.right, context);

  if (!left || !right) {
    throw new Error(
      `Failed to convert logical expression with operator '${node.operator}'. ` +
        `Left: ${left ? "converted" : "failed"}, Right: ${right ? "converted" : "failed"}`,
    );
  }

  // Handle ?? (nullish coalescing) as COALESCE
  if (node.operator === "??" && isValueExpression(left) && isValueExpression(right)) {
    return {
      type: "coalesce",
      expressions: [left as ValueExpression, right as ValueExpression],
    } as CoalesceExpression;
  }

  // Convert columns to booleanColumns if needed
  const finalLeft = ensureBoolean(left);
  const finalRight = ensureBoolean(right);

  // Handle || as coalesce when not both boolean (backward compatibility)
  if (node.operator === "||") {
    if (!isBooleanExpression(left) || !isBooleanExpression(right)) {
      if (isValueExpression(left) && isValueExpression(right)) {
        return {
          type: "coalesce",
          expressions: [left as ValueExpression, right as ValueExpression],
        } as CoalesceExpression;
      }
    }
  }

  if (isBooleanExpression(finalLeft) && isBooleanExpression(finalRight)) {
    return {
      type: "logical",
      operator: node.operator === "&&" ? "and" : "or",
      left: finalLeft as BooleanExpression,
      right: finalRight as BooleanExpression,
    } as LogicalExpression;
  }

  return null;
}

/**
 * Ensure expression is boolean, converting columns if needed
 */
function ensureBoolean(expr: unknown): unknown {
  if (!expr) return expr;

  // Convert column to booleanColumn
  if ((expr as { type?: string }).type === "column") {
    const col = expr as ColumnExpression;
    const boolCol: Record<string, unknown> = {
      type: "booleanColumn",
      name: col.name,
    };
    // Only add table if it exists
    if (col.table) {
      boolCol.table = col.table;
    }
    return boolCol;
  }

  return expr;
}
