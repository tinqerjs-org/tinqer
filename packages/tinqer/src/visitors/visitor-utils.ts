/**
 * Utility functions for visitor implementations
 */

import type {
  Expression,
  BooleanExpression,
  ValueExpression,
} from "../expressions/expression.js";
import type {
  ArrowFunctionExpression,
  Statement,
  Expression as ASTExpression,
  Identifier,
} from "../parser/ast-types.js";

/**
 * Get the parameter name from an arrow function
 */
export function getParameterName(arrowFunc: ArrowFunctionExpression): string | null {
  if (arrowFunc.params && arrowFunc.params.length > 0) {
    const param = arrowFunc.params[0];
    if (param.type === "Identifier") {
      return (param as Identifier).name;
    }
  }
  return null;
}

/**
 * Get the return expression from a block statement body
 */
export function getReturnExpression(statements: Statement[]): ASTExpression | null {
  for (const stmt of statements) {
    if (stmt.type === "ReturnStatement") {
      return (stmt as { argument?: ASTExpression }).argument || null;
    }
  }
  return null;
}

/**
 * Check if an expression is a boolean expression
 */
export function isBooleanExpression(expr: Expression): expr is BooleanExpression {
  if (!expr) return false;

  const booleanTypes = [
    "comparison",
    "logical",
    "negation",
    "in",
    "like",
    "between",
    "booleanLiteral",
    "booleanColumn",
    "exists",
    "isNull",
    "isNotNull"
  ];

  return booleanTypes.includes(expr.type);
}

/**
 * Check if an expression is a value expression
 */
export function isValueExpression(expr: Expression): expr is ValueExpression {
  if (!expr) return false;

  const valueTypes = [
    "literal",
    "column",
    "parameter",
    "arithmetic",
    "concat",
    "conditional",
    "object",
    "array",
    "call"
  ];

  return valueTypes.includes(expr.type);
}