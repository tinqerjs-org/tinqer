/**
 * @webpods/tinqer
 * LINQ-style query builder that outputs expression trees (AST)
 */

// Core types
export type {
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
  ObjectProperty,
  LambdaExpression,
  ParameterOrigin,
} from "./types/expressions.js";

export type {
  QueryExpression,
  SourceExpression,
  TableExpression,
  ValuesExpression,
  JoinExpression,
  OrderExpression,
  CteExpression,
} from "./types/query-expressions.js";

// Main classes
export { Queryable } from "./queryable/queryable.js";
export { OxcParser } from "./parser/oxc-parser.js";
export { AstConverter } from "./converter/ast-converter.js";
export type { ConversionContext } from "./converter/ast-converter.js";

// Version
export const version = "1.0.0";
