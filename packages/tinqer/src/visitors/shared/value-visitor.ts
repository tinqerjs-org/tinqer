/**
 * Shared value expression visitor utility
 * Used by aggregate operations that need to extract value expressions
 * (SUM, AVG, MIN, MAX, GROUP BY, etc.)
 */

import type { ValueExpression } from "../../expressions/expression.js";
import type { Expression as ASTExpression } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { visitExpression } from "../index.js";
import { isValueExpression } from "../visitor-utils.js";

/**
 * Result type for value expression visitors
 */
export type ValueResult = {
  value: ValueExpression | undefined;
  autoParams: Record<string, unknown>;
  counter: number;
};

/**
 * Visit an expression and convert to ValueExpression if possible
 * Used by aggregate operations that work with numeric/string values
 */
export function visitValue(
  node: ASTExpression,
  tableParams: Set<string>,
  queryParams: Set<string>,
  existingAutoParams: Map<string, unknown>,
  startCounter: number = 0,
): ValueResult {
  // Create visitor context
  const context: VisitorContext = {
    tableParams,
    queryParams,
    autoParams: existingAutoParams,
    autoParamCounter: startCounter,
  };

  // Visit the expression
  const expr = visitExpression(node, context);

  // Convert to value expression if needed
  let value: ValueExpression | undefined;
  if (expr && isValueExpression(expr)) {
    value = expr as ValueExpression;
  }

  // Extract auto params
  const autoParams: Record<string, unknown> = {};
  for (const [name, val] of context.autoParams) {
    autoParams[name] = val;
  }

  return {
    value,
    autoParams,
    counter: context.autoParamCounter,
  };
}
