/**
 * Shared generic visitor utility
 * Used by operations that accept any expression type (not limited to boolean or value)
 * (GROUP BY, JOIN key selectors, etc.)
 */

import type { Expression } from "../../expressions/expression.js";
import type { Expression as ASTExpression } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { visitExpression as visitExpressionImpl } from "../index.js";

/**
 * Result type for expression visitors
 */
export type ExpressionResult = {
  expression: Expression | null;
  autoParams: Record<string, unknown>;
  counter: number;
};

/**
 * Visit an expression and return any type of Expression
 * Used by operations that accept any expression type
 */
export function visitGenericExpression(
  node: ASTExpression,
  tableParams: Set<string>,
  queryParams: Set<string>,
  existingAutoParams: Map<string, unknown>,
  startCounter: number = 0,
): ExpressionResult {
  // Create visitor context
  const context: VisitorContext = {
    tableParams,
    queryParams,
    autoParams: existingAutoParams,
    autoParamCounter: startCounter,
  };

  // Visit the expression
  const expression = visitExpressionImpl(node, context);

  // Extract auto params
  const autoParams: Record<string, unknown> = {};
  for (const [name, value] of context.autoParams) {
    autoParams[name] = value;
  }

  return {
    expression,
    autoParams,
    counter: context.autoParamCounter,
  };
}
