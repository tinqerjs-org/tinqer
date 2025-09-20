/**
 * Tree Helper Utilities for Testing
 * Creates the same expression tree structures that the parser produces
 */

import type {
  Expression,
  ConstantExpression,
  ParameterExpression,
  MemberExpression,
  BinaryExpression,
  LogicalExpression,
  UnaryExpression,
  CallExpression,
  ConditionalExpression,
  ArrayExpression,
  ObjectExpression,
  LambdaExpression,
  ParameterOrigin,
} from "../../src/types/expressions.js";

/**
 * Expression builders for explicit construction
 */
export const expr = {
  constant(value: any): ConstantExpression {
    return { type: "constant", value };
  },

  parameter(name: string, origin?: ParameterOrigin): ParameterExpression {
    return { type: "parameter", name, origin };
  },

  member(property: string, object: Expression): MemberExpression {
    return { type: "member", property, object };
  },

  binary(left: Expression, operator: string, right: Expression): BinaryExpression {
    return { type: "binary", operator, left, right };
  },

  logical(left: Expression, operator: "&&" | "||", right: Expression): LogicalExpression {
    return { type: "logical", operator, left, right };
  },

  unary(operator: string, operand: Expression): UnaryExpression {
    return { type: "unary", operator, operand };
  },

  call(method: string, args: Expression[], callee?: Expression): CallExpression {
    return { type: "call", method, arguments: args, callee };
  },

  conditional(
    test: Expression,
    consequent: Expression,
    alternate: Expression,
  ): ConditionalExpression {
    return { type: "conditional", test, consequent, alternate };
  },

  array(elements: Expression[]): ArrayExpression {
    return { type: "array", elements };
  },

  object(properties: Array<{ key: string | Expression; value: Expression }>): ObjectExpression {
    const props = properties.map((p) => ({
      key: typeof p.key === "string" ? expr.constant(p.key) : p.key,
      value: p.value,
    }));
    return { type: "object", properties: props };
  },

  lambda(body: Expression, params: string[], tableName?: string): LambdaExpression {
    // Create parameters with table origin if tableName provided
    const parameters = params.map((p) =>
      expr.parameter(p, tableName ? { type: "table", ref: tableName } : undefined),
    );
    return { type: "lambda", parameters, body };
  },
};

/**
 * Shortcuts for creating specific parameter types
 */
export const param = {
  // Table parameter with origin
  table(name: string, tableName: string): ParameterExpression {
    return expr.parameter(name, { type: "table", ref: tableName });
  },

  // External parameter
  external(name: string): ParameterExpression {
    return expr.parameter(name, { type: "external" });
  },

  // Joined parameter
  joined(name: string): ParameterExpression {
    return expr.parameter(name, { type: "joined" });
  },

  // Subquery parameter
  subquery(name: string, subqueryId: string): ParameterExpression {
    return expr.parameter(name, { type: "subquery", ref: subqueryId });
  },

  // CTE parameter
  cte(name: string, cteName: string): ParameterExpression {
    return expr.parameter(name, { type: "cte", ref: cteName });
  },
};

/**
 * Comparison shortcuts that accept any expressions
 */
export const compare = {
  eq(left: Expression, right: Expression | any): BinaryExpression {
    const rightExpr = isExpression(right) ? right : expr.constant(right);
    return expr.binary(left, "==", rightExpr);
  },

  neq(left: Expression, right: Expression | any): BinaryExpression {
    const rightExpr = isExpression(right) ? right : expr.constant(right);
    return expr.binary(left, "!=", rightExpr);
  },

  gt(left: Expression, right: Expression | any): BinaryExpression {
    const rightExpr = isExpression(right) ? right : expr.constant(right);
    return expr.binary(left, ">", rightExpr);
  },

  gte(left: Expression, right: Expression | any): BinaryExpression {
    const rightExpr = isExpression(right) ? right : expr.constant(right);
    return expr.binary(left, ">=", rightExpr);
  },

  lt(left: Expression, right: Expression | any): BinaryExpression {
    const rightExpr = isExpression(right) ? right : expr.constant(right);
    return expr.binary(left, "<", rightExpr);
  },

  lte(left: Expression, right: Expression | any): BinaryExpression {
    const rightExpr = isExpression(right) ? right : expr.constant(right);
    return expr.binary(left, "<=", rightExpr);
  },

  and(left: Expression, right: Expression): LogicalExpression {
    return expr.logical(left, "&&", right);
  },

  or(left: Expression, right: Expression): LogicalExpression {
    return expr.logical(left, "||", right);
  },

  not(operand: Expression): UnaryExpression {
    return expr.unary("!", operand);
  },
};

/**
 * Helper to check if a value is an Expression
 */
function isExpression(value: any): value is Expression {
  return value && typeof value === "object" && "type" in value;
}
