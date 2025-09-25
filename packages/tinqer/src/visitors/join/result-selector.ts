/**
 * JOIN result selector visitor
 * Handles result selector expressions in JOIN operations
 */

import type { Expression } from "../../expressions/expression.js";
import type {
  Expression as ASTExpression,
  ParenthesizedExpression,
  ObjectExpression as ASTObjectExpression,
} from "../../parser/ast-types.js";
import type { JoinContext } from "./context.js";
import { visitJoinExpression } from "./expression.js";

/**
 * Visit JOIN result selector with proper parameter tracking
 */
export function visitJoinResultSelector(
  node: ASTExpression,
  context: JoinContext,
  startCounter: number,
): { expression: Expression | null; autoParams: Record<string, unknown>; counter: number } | null {
  let currentCounter = startCounter;
  const autoParams: Record<string, unknown> = {};

  // Unwrap parenthesized expressions
  let expr = node;
  while (expr.type === "ParenthesizedExpression") {
    expr = (expr as ParenthesizedExpression).expression;
  }

  // Handle object expressions
  if (expr.type === "ObjectExpression") {
    const properties: Record<string, Expression> = {};

    for (const prop of (expr as ASTObjectExpression).properties) {
      if (prop.type === "Property" && prop.key.type === "Identifier") {
        const key = prop.key.name;
        const valueExpr = visitJoinExpression(prop.value, context, currentCounter);

        if (valueExpr && valueExpr.value) {
          properties[key] = valueExpr.value;
          currentCounter = valueExpr.counter;
          Object.assign(autoParams, valueExpr.autoParams);
        }
      }
    }

    return {
      expression: {
        type: "object",
        properties,
      },
      autoParams,
      counter: currentCounter,
    };
  }

  // For non-object expressions, use the regular visitor
  const result = visitJoinExpression(expr, context, currentCounter);
  if (result) {
    return {
      expression: result.value,
      autoParams: result.autoParams,
      counter: result.counter,
    };
  }

  return null;
}
