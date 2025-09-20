import type { Expression, ComparisonExpression, ColumnExpression, ConstantExpression, MemberAccessExpression, ParameterExpression, LogicalExpression, NotExpression, ArithmeticExpression } from "../../src/expressions/expression.js";

export const expr = {
  // Basic expressions
  column(name: string): ColumnExpression {
    return { type: "column", name };
  },

  constant(value: any): ConstantExpression {
    return { type: "constant", value };
  },

  parameter(param: string, property?: string): ParameterExpression {
    return property ? { type: "param", param, property } : { type: "param", param };
  },

  member(object: Expression, property: string): MemberAccessExpression {
    return { type: "memberAccess", object, property };
  },

  // Table origin helper
  tableOrigin(ref: string) {
    return { type: "table", ref };
  },

  // Query param origin helper
  queryParamOrigin(name: string) {
    return { type: "query-param", name };
  },

  // Comparison operators
  eq(left: Expression, right: Expression): ComparisonExpression {
    return { type: "comparison", operator: "==", left, right };
  },

  ne(left: Expression, right: Expression): ComparisonExpression {
    return { type: "comparison", operator: "!=", left, right };
  },

  gt(left: Expression, right: Expression): ComparisonExpression {
    return { type: "comparison", operator: ">", left, right };
  },

  gte(left: Expression, right: Expression): ComparisonExpression {
    return { type: "comparison", operator: ">=", left, right };
  },

  lt(left: Expression, right: Expression): ComparisonExpression {
    return { type: "comparison", operator: "<", left, right };
  },

  lte(left: Expression, right: Expression): ComparisonExpression {
    return { type: "comparison", operator: "<=", left, right };
  },

  // Logical operators
  and(left: Expression, right: Expression): LogicalExpression {
    return { type: "logical", operator: "&&", left, right };
  },

  or(left: Expression, right: Expression): LogicalExpression {
    return { type: "logical", operator: "||", left, right };
  },

  not(operand: Expression): NotExpression {
    return { type: "not", operand };
  },

  // Arithmetic operators
  add(left: Expression, right: Expression): ArithmeticExpression {
    return { type: "arithmetic", operator: "+", left: left as any, right: right as any };
  },

  subtract(left: Expression, right: Expression): ArithmeticExpression {
    return { type: "arithmetic", operator: "-", left: left as any, right: right as any };
  },

  multiply(left: Expression, right: Expression): ArithmeticExpression {
    return { type: "arithmetic", operator: "*", left: left as any, right: right as any };
  },

  divide(left: Expression, right: Expression): ArithmeticExpression {
    return { type: "arithmetic", operator: "/", left: left as any, right: right as any };
  },

  modulo(left: Expression, right: Expression): ArithmeticExpression {
    return { type: "arithmetic", operator: "%", left: left as any, right: right as any };
  },
};