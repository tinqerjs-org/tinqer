/**
 * Visitor for literal values (numbers, strings, booleans, null)
 * Handles auto-parameterization of literal values
 */

import type {
  ConstantExpression,
  ParameterExpression,
} from "../../expressions/expression.js";

import type {
  Literal,
  NumericLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,
} from "../../parser/ast-types.js";

import type { VisitorContext } from "../types.js";
import { createAutoParam } from "../types.js";

/**
 * Convert a literal AST node to an expression
 * Auto-parameterizes values except for null
 */
export function visitLiteral(
  node: Literal | NumericLiteral | StringLiteral | BooleanLiteral | NullLiteral,
  context: VisitorContext
): ParameterExpression | ConstantExpression {
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
    } as ConstantExpression;
  }

  // Auto-parameterize the value (column hint now ignored for simpler naming)
  const paramName = createAutoParam(context, value);

  return {
    type: "param",
    param: paramName,
  } as ParameterExpression;
}