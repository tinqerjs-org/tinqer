/**
 * Converts expression trees to SQL fragments
 */

import type {
  Expression,
  BooleanExpression,
  ValueExpression,
  ComparisonExpression,
  LogicalExpression,
  InExpression,
  ColumnExpression,
  ConstantExpression,
  ParameterExpression,
  ArithmeticExpression,
  NotExpression,
  StringMethodExpression,
  BooleanMethodExpression,
  ObjectExpression,
  ArrayExpression,
  ConcatExpression,
  AggregateExpression,
  ConditionalExpression,
  CoalesceExpression,
} from "@webpods/tinqer";
import type { SqlContext } from "./types.js";

/**
 * Generate SQL for any expression
 */
export function generateExpression(expr: Expression, context: SqlContext): string {
  if (isBooleanExpression(expr)) {
    return generateBooleanExpression(expr, context);
  }
  if (isValueExpression(expr)) {
    return generateValueExpression(expr, context);
  }
  if (isObjectExpression(expr)) {
    return generateObjectExpression(expr, context);
  }
  if (isConditionalExpression(expr)) {
    return generateConditionalExpression(expr, context);
  }
  if (isArrayExpression(expr)) {
    throw new Error("Array expressions not yet supported");
  }
  throw new Error(`Unknown expression type: ${(expr as any).type}`);
}

/**
 * Generate SQL for boolean expressions
 */
export function generateBooleanExpression(expr: BooleanExpression, context: SqlContext): string {
  switch (expr.type) {
    case "comparison":
      return generateComparisonExpression(expr, context);
    case "logical":
      return generateLogicalExpression(expr, context);
    case "not":
      return generateNotExpression(expr, context);
    case "booleanColumn":
      return expr.name;
    case "booleanConstant":
      return expr.value ? "1" : "0";
    case "booleanMethod":
      return generateBooleanMethodExpression(expr, context);
    case "in":
      return generateInExpression(expr as InExpression, context);
    default:
      throw new Error(`Unsupported boolean expression type: ${(expr as any).type}`);
  }
}

/**
 * Generate SQL for value expressions
 */
export function generateValueExpression(expr: ValueExpression, context: SqlContext): string {
  switch (expr.type) {
    case "column":
      return generateColumnExpression(expr as ColumnExpression, context);
    case "constant":
      return generateConstantExpression(expr as ConstantExpression);
    case "param":
      return generateParameterExpression(expr as ParameterExpression, context);
    case "arithmetic":
      return generateArithmeticExpression(expr as ArithmeticExpression, context);
    case "concat":
      return generateConcatExpression(expr as ConcatExpression, context);
    case "stringMethod":
      return generateStringMethodExpression(expr as StringMethodExpression, context);
    case "aggregate":
      return generateAggregateExpression(expr as AggregateExpression, context);
    case "coalesce":
      return generateCoalesceExpression(expr as CoalesceExpression, context);
    default:
      throw new Error(`Unsupported value expression type: ${(expr as any).type}`);
  }
}

/**
 * Generate SQL for comparison expressions
 */
function generateComparisonExpression(expr: ComparisonExpression, context: SqlContext): string {
  // Handle cases where left or right side might be boolean expressions
  const left = generateExpressionForComparison(expr.left, context);
  const right = generateExpressionForComparison(expr.right, context);

  // Special handling for NULL comparisons
  if (right === "NULL") {
    if (expr.operator === "==") {
      return `${left} IS NULL`;
    } else if (expr.operator === "!=") {
      return `${left} IS NOT NULL`;
    }
  }
  if (left === "NULL") {
    if (expr.operator === "==") {
      return `${right} IS NULL`;
    } else if (expr.operator === "!=") {
      return `${right} IS NOT NULL`;
    }
  }

  const operator = mapComparisonOperator(expr.operator);
  return `${left} ${operator} ${right}`;
}

/**
 * Generate expression for use in comparisons - handles both value and boolean expressions
 */
function generateExpressionForComparison(expr: any, context: SqlContext): string {
  // Check if it's a boolean expression
  if (isBooleanExpression(expr)) {
    return generateBooleanExpression(expr, context);
  }
  // Otherwise treat as value expression
  return generateValueExpression(expr, context);
}

/**
 * Map JavaScript comparison operators to SQL
 */
function mapComparisonOperator(op: string): string {
  switch (op) {
    case "==":
    case "===":
      return "=";
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
      return op;
  }
}

/**
 * Generate SQL for logical expressions
 */
function generateLogicalExpression(expr: LogicalExpression, context: SqlContext): string {
  const left = generateBooleanExpression(expr.left, context);
  const right = generateBooleanExpression(expr.right, context);
  const operator = expr.operator === "and" ? "AND" : "OR";
  return `(${left} ${operator} ${right})`;
}

/**
 * Generate SQL for NOT expressions
 */
function generateNotExpression(expr: NotExpression, context: SqlContext): string {
  const operand = generateBooleanExpression(expr.expression, context);
  // Check if operand is a simple column reference (no operators)
  if (!operand.includes(" ") && !operand.includes("(")) {
    return `NOT ${operand}`;
  }
  return `NOT (${operand})`;
}

/**
 * Generate SQL for column references
 */
function generateColumnExpression(expr: ColumnExpression, context: SqlContext): string {
  if (expr.table) {
    const alias = context.tableAliases.get(expr.table) || expr.table;
    return `"${alias}"."${expr.name}"`;
  }
  return `"${expr.name}"`;
}

/**
 * Generate SQL for constants
 */
function generateConstantExpression(expr: ConstantExpression): string {
  if (expr.value === null) {
    return "NULL";
  }
  if (typeof expr.value === "string") {
    // Escape single quotes in strings
    const escaped = expr.value.replace(/'/g, "''");
    return `'${escaped}'`;
  }
  if (typeof expr.value === "boolean") {
    return expr.value ? "1" : "0";
  }
  return String(expr.value);
}

/**
 * Generate SQL for parameter references
 */
function generateParameterExpression(expr: ParameterExpression, context: SqlContext): string {
  // Handle array indexing
  if (expr.index !== undefined) {
    // For array access, we need to extract the value at runtime
    // The parameter should reference the array element directly
    // e.g., params.roles[0] becomes roles[0] in the parameter
    const baseName = expr.property || expr.param;
    const indexedName = `${baseName}[${expr.index}]`;

    // Store the array access for runtime resolution
    // The query executor will need to resolve this
    return context.formatParameter(indexedName);
  }

  // Extract only the last property name for the parameter
  const paramName = expr.property || expr.param;
  return context.formatParameter(paramName);
}

/**
 * Generate SQL for arithmetic expressions
 */
function generateArithmeticExpression(expr: ArithmeticExpression, context: SqlContext): string {
  const left = generateValueExpression(expr.left, context);
  const right = generateValueExpression(expr.right, context);
  return `(${left} ${expr.operator} ${right})`;
}

/**
 * Generate SQL for string concatenation
 */
function generateConcatExpression(expr: ConcatExpression, context: SqlContext): string {
  const left = generateValueExpression(expr.left, context);
  const right = generateValueExpression(expr.right, context);
  // PostgreSQL uses || for concatenation
  return `${left} || ${right}`;
}

/**
 * Generate SQL for string method expressions
 */
function generateStringMethodExpression(expr: StringMethodExpression, context: SqlContext): string {
  const object = generateValueExpression(expr.object, context);

  switch (expr.method) {
    case "toLowerCase":
      return `LOWER(${object})`;
    case "toUpperCase":
      return `UPPER(${object})`;
    default:
      throw new Error(`Unsupported string method: ${expr.method}`);
  }
}

/**
 * Generate SQL for IN expressions
 */
function generateInExpression(expr: InExpression, context: SqlContext): string {
  const value = generateValueExpression(expr.value, context);

  // Handle list as array expression or array of values
  let listValues: string[];
  if (Array.isArray(expr.list)) {
    listValues = expr.list.map((item) => generateValueExpression(item, context));
  } else if (expr.list.type === "array") {
    const arrayExpr = expr.list as ArrayExpression;
    listValues = arrayExpr.elements.map((item) => generateExpression(item, context));
  } else {
    throw new Error("IN expression requires an array");
  }

  if (listValues.length === 0) {
    // Empty IN list always returns false (0 in SQLite)
    return "0";
  }

  return `${value} IN (${listValues.join(", ")})`;
}

/**
 * Generate SQL for boolean method expressions
 */
function generateBooleanMethodExpression(
  expr: BooleanMethodExpression,
  context: SqlContext,
): string {
  const object = generateValueExpression(expr.object, context);

  switch (expr.method) {
    case "startsWith":
      if (expr.arguments && expr.arguments.length > 0) {
        const prefix = generateValueExpression(expr.arguments[0]!, context);
        return `${object} LIKE ${prefix} || '%'`;
      }
      throw new Error("startsWith requires an argument");
    case "endsWith":
      if (expr.arguments && expr.arguments.length > 0) {
        const suffix = generateValueExpression(expr.arguments[0]!, context);
        return `${object} LIKE '%' || ${suffix}`;
      }
      throw new Error("endsWith requires an argument");
    case "includes":
    case "contains":
      if (expr.arguments && expr.arguments.length > 0) {
        const search = generateValueExpression(expr.arguments[0]!, context);
        return `${object} LIKE '%' || ${search} || '%'`;
      }
      throw new Error("includes/contains requires an argument");
    default:
      throw new Error(`Unsupported boolean method: ${expr.method}`);
  }
}

/**
 * Generate SQL for aggregate expressions
 */
function generateAggregateExpression(expr: AggregateExpression, context: SqlContext): string {
  const func = expr.function.toUpperCase();

  // COUNT(*) special case
  if (func === "COUNT" && !expr.expression) {
    return "COUNT(*)";
  }

  // Aggregate with expression (e.g., SUM(amount), COUNT(id))
  if (expr.expression) {
    const innerExpr = generateValueExpression(expr.expression, context);
    return `${func}(${innerExpr})`;
  }

  // Default to COUNT(*) for other aggregates without expression
  return `${func}(*)`;
}

/**
 * Generate SQL for coalesce expressions
 */
function generateCoalesceExpression(expr: CoalesceExpression, context: SqlContext): string {
  const expressions = expr.expressions.map((e) => generateValueExpression(e, context));
  return `COALESCE(${expressions.join(", ")})`;
}

/**
 * Generate SQL for conditional expressions (ternary)
 */
function generateConditionalExpression(expr: ConditionalExpression, context: SqlContext): string {
  const condition = generateBooleanExpression(expr.condition, context);
  const thenExpr = generateExpression(expr.then, context);
  const elseExpr = generateExpression(expr.else, context);
  // Use SQL CASE expression
  return `CASE WHEN ${condition} THEN ${thenExpr} ELSE ${elseExpr} END`;
}

/**
 * Generate SQL for object expressions (used in SELECT)
 */
function generateObjectExpression(expr: ObjectExpression, context: SqlContext): string {
  if (!expr.properties) {
    throw new Error("Object expression must have properties");
  }
  const parts = Object.entries(expr.properties).map(([key, value]) => {
    const sqlValue = generateExpression(value, context);
    return `${sqlValue} AS "${key}"`;
  });
  return parts.join(", ");
}

// Type guards
function isBooleanExpression(expr: Expression): expr is BooleanExpression {
  return [
    "comparison",
    "logical",
    "not",
    "booleanColumn",
    "booleanConstant",
    "booleanMethod",
    "exists",
  ].includes((expr as any).type);
}

function isValueExpression(expr: Expression): expr is ValueExpression {
  return [
    "column",
    "constant",
    "param",
    "arithmetic",
    "concat",
    "stringMethod",
    "case",
    "aggregate",
  ].includes((expr as any).type);
}

function isObjectExpression(expr: Expression): expr is ObjectExpression {
  return (expr as any).type === "object";
}

function isArrayExpression(expr: Expression): expr is ArrayExpression {
  return (expr as any).type === "array";
}

function isConditionalExpression(expr: Expression): expr is ConditionalExpression {
  return (expr as any).type === "conditional";
}
