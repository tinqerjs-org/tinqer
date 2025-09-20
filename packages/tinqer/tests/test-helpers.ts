/**
 * Type definitions for accessing internal query structures in tests
 * These are used to validate the generated expression trees
 */

import type {
  Expression,
  BinaryExpression,
  MemberExpression,
  ConstantExpression,
  CallExpression,
  ObjectExpression,
  ArrayExpression,
  ConditionalExpression,
  LogicalExpression,
  UnaryExpression,
  LambdaExpression,
} from "../src/types/expressions.js";

// Helper types for type assertions in tests
// When using Queryable API, we know that select, where, etc. are LambdaExpressions
export interface QueryResultFromQueryable {
  type: "query";
  operation: "SELECT";
  from: { type: "source"; source: { type: "table"; name: string } };
  select?: LambdaExpression; // Always LambdaExpression when set via Queryable
  where?: Expression; // Combined WHERE expressions
  orderBy?: Array<{ type: "order"; expression: LambdaExpression; direction: "ASC" | "DESC" }>;
  joins?: Array<{ type: "join"; table: string; on?: Expression; kind: string }>;
  limit?: { type: "constant"; value: number };
  offset?: { type: "constant"; value: number };
  distinct?: boolean;
  groupBy?: LambdaExpression;
  having?: Expression;
}

export interface QueryWithBody {
  body: Expression;
}

export interface QueryWithBinaryBody {
  body: BinaryExpression;
}

export interface QueryWithMemberBody {
  body: MemberExpression;
}

export interface QueryWithCallBody {
  type: string;
  method: string;
  arguments: Expression[];
}

export interface QueryWithObjectBody {
  body: ObjectExpression;
}

export interface QueryWithArrayBody {
  body: ArrayExpression;
}

export interface QueryWithLimit {
  value: number;
}

export interface QueryWithTableSource {
  source: {
    name: string;
  };
}

// Type guards for better type safety
export function isBinaryExpression(expr: Expression | undefined): expr is BinaryExpression {
  return expr?.type === "binary";
}

export function isMemberExpression(expr: Expression | undefined): expr is MemberExpression {
  return expr?.type === "member";
}

export function isConstantExpression(expr: Expression | undefined): expr is ConstantExpression {
  return expr?.type === "constant";
}

export function isCallExpression(expr: Expression | undefined): expr is CallExpression {
  return expr?.type === "call";
}

export function isObjectExpression(expr: Expression | undefined): expr is ObjectExpression {
  return expr?.type === "object";
}

export function isArrayExpression(expr: Expression | undefined): expr is ArrayExpression {
  return expr?.type === "array";
}

export function isConditionalExpression(
  expr: Expression | undefined,
): expr is ConditionalExpression {
  return expr?.type === "conditional";
}

export function isLogicalExpression(expr: Expression | undefined): expr is LogicalExpression {
  return expr?.type === "logical";
}

export function isUnaryExpression(expr: Expression | undefined): expr is UnaryExpression {
  return expr?.type === "unary";
}

// Assertion helpers that cast through unknown for TypeScript compatibility
export function assertBinaryExpression(expr: Expression | undefined): BinaryExpression {
  if (!isBinaryExpression(expr)) {
    throw new Error(`Expected binary expression, got ${expr?.type || "undefined"}`);
  }
  return expr;
}

export function assertMemberExpression(expr: Expression | undefined): MemberExpression {
  if (!isMemberExpression(expr)) {
    throw new Error(`Expected member expression, got ${expr?.type || "undefined"}`);
  }
  return expr;
}

export function assertConstantExpression(expr: Expression | undefined): ConstantExpression {
  if (!isConstantExpression(expr)) {
    throw new Error(`Expected constant expression, got ${expr?.type || "undefined"}`);
  }
  return expr;
}

export function assertCallExpression(expr: Expression | undefined): CallExpression {
  if (!isCallExpression(expr)) {
    throw new Error(`Expected call expression, got ${expr?.type || "undefined"}`);
  }
  return expr;
}

export function assertObjectExpression(expr: Expression | undefined): ObjectExpression {
  if (!isObjectExpression(expr)) {
    throw new Error(`Expected object expression, got ${expr?.type || "undefined"}`);
  }
  return expr;
}

export function assertArrayExpression(expr: Expression | undefined): ArrayExpression {
  if (!isArrayExpression(expr)) {
    throw new Error(`Expected array expression, got ${expr?.type || "undefined"}`);
  }
  return expr;
}

export function assertConditionalExpression(expr: Expression | undefined): ConditionalExpression {
  if (!isConditionalExpression(expr)) {
    throw new Error(`Expected conditional expression, got ${expr?.type || "undefined"}`);
  }
  return expr;
}

export function assertLogicalExpression(expr: Expression | undefined): LogicalExpression {
  if (!isLogicalExpression(expr)) {
    throw new Error(`Expected logical expression, got ${expr?.type || "undefined"}`);
  }
  return expr;
}

export function assertUnaryExpression(expr: Expression | undefined): UnaryExpression {
  if (!isUnaryExpression(expr)) {
    throw new Error(`Expected unary expression, got ${expr?.type || "undefined"}`);
  }
  return expr;
}
