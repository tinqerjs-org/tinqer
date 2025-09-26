/**
 * Expression Types for Tinqer Query System
 *
 * Precise type hierarchy for expressions that evaluate to different types.
 * These are used by the parser to represent parsed lambda expressions.
 */

// ==================== Value Expressions ====================

/**
 * Column source - where a column comes from
 */
export type ColumnSource =
  | { type: "direct" } // Direct table access (no qualifier needed)
  | { type: "table"; alias: string } // Explicit table alias
  | { type: "joinParam"; paramIndex: number } // JOIN parameter (0=outer, 1=inner)
  | { type: "joinResult"; tableIndex: number } // From previous JOIN result
  | { type: "spread"; sourceIndex: number }; // Spread operator source

/**
 * Column reference - references a table column
 */
export interface ColumnExpression {
  type: "column";
  name: string;
  source?: ColumnSource; // Where this column comes from (for JOINs)
  table?: string; // Table name for regular references (not JOINs)
}

/**
 * Constant value - literal values
 */
export interface ConstantExpression {
  type: "constant";
  value: unknown;
  valueType?: "string" | "number" | "boolean" | "null" | "undefined";
}

/**
 * Parameter reference - references external query parameters
 */
export interface ParameterExpression {
  type: "param";
  param: string; // Parameter name (e.g., "p")
  property?: string; // Property path (e.g., "minAge")
  index?: number; // Array index (e.g., roles[0])
}

/**
 * Arithmetic expression - mathematical operations
 */
export interface ArithmeticExpression {
  type: "arithmetic";
  operator: "+" | "-" | "*" | "/" | "%";
  left: ValueExpression;
  right: ValueExpression;
}

/**
 * String concatenation
 */
export interface ConcatExpression {
  type: "concat";
  left: ValueExpression;
  right: ValueExpression;
}

/**
 * String method calls
 */
export interface StringMethodExpression {
  type: "stringMethod";
  object: ValueExpression;
  method: "toLowerCase" | "toUpperCase";
  arguments?: ValueExpression[];
}

/**
 * CASE expression (SQL CASE WHEN)
 */
export interface CaseExpression {
  type: "case";
  conditions: Array<{
    when: BooleanExpression;
    then: ValueExpression;
  }>;
  else?: ValueExpression;
}

/**
 * Coalesce expression (COALESCE / ??)
 */
export interface CoalesceExpression {
  type: "coalesce";
  expressions: ValueExpression[];
}

/**
 * Cast expression - type conversion
 */
export interface CastExpression {
  type: "cast";
  expression: ValueExpression;
  targetType: "string" | "number" | "boolean" | "date";
}

/**
 * Aggregate expression - for GROUP BY aggregations
 * Follows C# LINQ IGrouping pattern
 */
export interface AggregateExpression {
  type: "aggregate";
  function: "count" | "sum" | "avg" | "min" | "max";
  expression?: ValueExpression; // Optional - COUNT(*) doesn't need one
}

/**
 * Reference to an entire table/object (for JOIN result selectors)
 */
export interface ReferenceExpression {
  type: "reference";
  source?: ColumnSource; // Where this reference comes from (for JOINs)
  table?: string; // Table name for regular references (not JOINs)
}

/**
 * Union type for all value-producing expressions
 */
export type ValueExpression =
  | ColumnExpression
  | ConstantExpression
  | ParameterExpression
  | ArithmeticExpression
  | ConcatExpression
  | StringMethodExpression
  | CaseExpression
  | CoalesceExpression
  | CastExpression
  | AggregateExpression
  | ReferenceExpression;

// ==================== Boolean Expressions ====================

/**
 * Comparison expression - binary comparisons
 */
export interface ComparisonExpression {
  type: "comparison";
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
  left: ValueExpression;
  right: ValueExpression;
}

/**
 * Logical expression - combines boolean expressions
 */
export interface LogicalExpression {
  type: "logical";
  operator: "and" | "or";
  left: BooleanExpression;
  right: BooleanExpression;
}

/**
 * NOT expression - negation
 */
export interface NotExpression {
  type: "not";
  expression: BooleanExpression;
}

/**
 * Boolean constant
 */
export interface BooleanConstantExpression {
  type: "booleanConstant";
  value: boolean;
}

/**
 * Boolean column reference (for columns that are boolean)
 */
export interface BooleanColumnExpression {
  type: "booleanColumn";
  name: string;
  table?: string;
}

/**
 * Boolean parameter reference
 */
export interface BooleanParameterExpression {
  type: "booleanParam";
  param: string;
  property?: string;
}

/**
 * String comparison methods that return boolean
 */
export interface BooleanMethodExpression {
  type: "booleanMethod";
  object: ValueExpression;
  method: "startsWith" | "endsWith" | "includes" | "contains";
  arguments: ValueExpression[];
}

/**
 * IN expression - value in list
 */
export interface InExpression {
  type: "in";
  value: ValueExpression;
  list: ValueExpression[] | ArrayExpression | ParameterExpression;
}

/**
 * BETWEEN expression
 */
export interface BetweenExpression {
  type: "between";
  value: ValueExpression;
  lower: ValueExpression;
  upper: ValueExpression;
}

/**
 * IS NULL / IS NOT NULL
 */
export interface IsNullExpression {
  type: "isNull";
  expression: ValueExpression;
  negated?: boolean;
}

/**
 * EXISTS expression (for subqueries)
 */
export interface ExistsExpression {
  type: "exists";
  subquery: QueryOperation; // From query-operations.ts
  negated?: boolean;
}

/**
 * LIKE expression for pattern matching
 */
export interface LikeExpression {
  type: "like";
  value: ValueExpression;
  pattern: ValueExpression;
  escape?: string;
}

/**
 * Regular expression match
 */
export interface RegexExpression {
  type: "regex";
  value: ValueExpression;
  pattern: ValueExpression;
  flags?: string;
}

/**
 * Union type for all boolean-producing expressions
 */
export type BooleanExpression =
  | ComparisonExpression
  | LogicalExpression
  | NotExpression
  | BooleanConstantExpression
  | BooleanColumnExpression
  | BooleanParameterExpression
  | BooleanMethodExpression
  | InExpression
  | BetweenExpression
  | IsNullExpression
  | ExistsExpression
  | LikeExpression
  | RegexExpression;

// ==================== Complex Expressions ====================

/**
 * Object literal expression (for SELECT projections)
 */
export interface ObjectExpression {
  type: "object";
  properties: Record<string, Expression>;
}

/**
 * Array expression
 */
export interface ArrayExpression {
  type: "array";
  elements: Expression[];
}

/**
 * Member access expression (before simplification)
 * Used during parsing before we determine if it's a column
 */
export interface MemberAccessExpression {
  type: "memberAccess";
  object: Expression;
  member: string;
}

/**
 * Method call expression (general, before categorization)
 */
export interface MethodCallExpression {
  type: "methodCall";
  object: Expression;
  method: string;
  arguments: Expression[];
}

/**
 * Conditional expression (ternary)
 */
export interface ConditionalExpression {
  type: "conditional";
  condition: BooleanExpression;
  then: Expression;
  else: Expression;
}

/**
 * Function call expression
 */
export interface FunctionCallExpression {
  type: "functionCall";
  name: string;
  arguments: Expression[];
}

/**
 * New expression (constructor call)
 */
export interface NewExpression {
  type: "new";
  constructor: string;
  arguments: Expression[];
}

// ==================== Lambda Expression ====================

/**
 * Lambda parameter
 */
export interface LambdaParameter {
  name: string;
  type?: string; // Optional type annotation
}

/**
 * Lambda expression (arrow function)
 */
export interface LambdaExpression {
  type: "lambda";
  parameters: LambdaParameter[];
  body: Expression;
}

// ==================== Base Expression Type ====================

/**
 * Import QueryOperation for EXISTS subqueries
 */
import type { QueryOperation } from "../query-tree/operations.js";

/**
 * Union type for all expressions
 */
export type Expression =
  | ValueExpression
  | BooleanExpression
  | ObjectExpression
  | ArrayExpression
  | MemberAccessExpression
  | MethodCallExpression
  | ConditionalExpression
  | FunctionCallExpression
  | NewExpression
  | LambdaExpression;

// ==================== Type Guards ====================

/**
 * Type guard for value expressions
 */
export function isValueExpression(expr: Expression): expr is ValueExpression {
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
 * Type guard for boolean expressions
 */
export function isBooleanExpression(expr: Expression): expr is BooleanExpression {
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
 * Type guard for object expressions
 */
export function isObjectExpression(expr: Expression): expr is ObjectExpression {
  return expr.type === "object";
}

/**
 * Type guard for array expressions
 */
export function isArrayExpression(expr: Expression): expr is ArrayExpression {
  return expr.type === "array";
}
