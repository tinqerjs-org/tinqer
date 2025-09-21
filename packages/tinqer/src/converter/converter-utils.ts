/**
 * Utility functions and types for AST conversion
 */

import type { Expression, BooleanExpression, ColumnExpression } from "../expressions/expression.js";

import type {
  Statement,
  ReturnStatement,
  Expression as ASTExpression,
  ArrowFunctionExpression,
  CallExpression as ASTCallExpression,
} from "../parser/ast-types.js";

/**
 * Context for tracking parameter origins during conversion
 */
export interface ConversionContext {
  // Track which parameters come from tables vs query params
  tableParams: Set<string>;
  queryParams: Set<string>;
  currentTable?: string;
  tableAliases: Map<string, string>;
  // Track parameters that represent IGrouping<TKey, TElement> after groupBy
  groupingParams?: Set<string>;

  // Auto-parameterization: track extracted constants
  autoParams: Map<string, string | number | boolean | null>; // Maps param name to value
  columnCounters: Map<string, number>; // Tracks counter per column for naming
}

/**
 * Extract return expression from a block statement
 */
export function getReturnExpression(blockBody: Statement[] | undefined): ASTExpression | null {
  const firstStatement = blockBody && blockBody.length > 0 ? blockBody[0] : null;
  if (firstStatement && firstStatement.type === "ReturnStatement") {
    const returnStmt = firstStatement as ReturnStatement;
    return returnStmt.argument || null;
  }
  return null;
}

/**
 * Find arrow function in AST
 */
export function findArrowFunction(ast: ASTExpression): ArrowFunctionExpression | null {
  if (ast.type === "ArrowFunctionExpression") {
    return ast as ArrowFunctionExpression;
  }

  // Handle other expression types that might wrap arrow functions
  // For now, we only check the direct expression
  return null;
}

/**
 * Get parameter name from arrow function
 */
export function getParameterName(arrowFunc: ArrowFunctionExpression): string | null {
  if (arrowFunc.params && arrowFunc.params.length > 0) {
    const firstParam = arrowFunc.params[0];
    if (firstParam) {
      return firstParam.name;
    }
  }
  return null;
}

/**
 * Get method name from call expression
 */
export function getMethodName(callExpr: ASTCallExpression): string | null {
  if (callExpr.callee) {
    if (callExpr.callee.type === "Identifier") {
      return callExpr.callee.name;
    }
    if (callExpr.callee.type === "MemberExpression" && callExpr.callee.property) {
      return callExpr.callee.property.name;
    }
  }
  return null;
}

/**
 * Type guard for boolean expressions
 */
export function isBooleanExpression(expr: Expression): boolean {
  return [
    "comparison",
    "logical",
    "not",
    "booleanConstant",
    "booleanColumn",
    "booleanParam",
    "booleanMethod",
    "in",
    "between",
    "isNull",
    "exists",
    "like",
    "regex",
  ].includes(expr.type);
}

/**
 * Type guard for value expressions
 */
export function isValueExpression(expr: Expression): boolean {
  return [
    "column",
    "constant",
    "param",
    "arithmetic",
    "concat",
    "stringMethod",
    "case",
    "coalesce",
    "cast",
    "aggregate",
  ].includes(expr.type);
}

/**
 * Type guard for object expressions
 */
export function isObjectExpression(expr: Expression): boolean {
  return expr.type === "object";
}

/**
 * Check if column name is likely a string type
 */
export function isLikelyStringColumn(name: string): boolean {
  const stringPatterns =
    /^(name|title|description|text|message|label|prefix|suffix|firstName|lastName|fullName|displayName|email|url|path|address|city|country|state)$/i;
  return stringPatterns.test(name);
}

/**
 * Check if parameter property is likely a string type
 */
export function isLikelyStringParam(property: string | undefined): boolean {
  if (!property) return false;
  return isLikelyStringColumn(property);
}

/**
 * Convert column to boolean column for predicates
 */
export function convertColumnToBooleanColumn(expr: Expression): BooleanExpression | Expression {
  if (expr && expr.type === "column") {
    return {
      type: "booleanColumn",
      name: (expr as ColumnExpression).name,
    };
  }
  return expr;
}
