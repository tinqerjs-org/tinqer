/**
 * Expression visitor for operation-specific visitors
 * Provides a simplified interface to expression conversion
 */

import type { Expression } from "../expressions/expression.js";
import type { Expression as ASTExpression } from "../parser/ast-types.js";
import { convertAstToExpression } from "../converter/expressions-visitor.js";
import type { ConversionContext } from "../converter/converter-utils.js";

/**
 * Visit an expression and return the converted expression with auto-params
 */
export function visitExpression(
  ast: ASTExpression,
  tableParams: Set<string>,
  queryParams: Set<string>
): { expression: Expression | null; autoParams: Record<string, unknown> } {
  // Create a conversion context
  const context: ConversionContext = {
    tableParams,
    queryParams,
    autoParams: new Map(),
    autoParamCounter: 0,
    groupingParams: new Set(),
    tableAliases: new Map(),
  };

  // Convert the expression
  const expression = convertAstToExpression(ast, context);

  // Extract auto params
  const autoParams: Record<string, unknown> = {};
  for (const [name, info] of context.autoParams) {
    autoParams[name] = info.value;
  }

  return { expression, autoParams };
}