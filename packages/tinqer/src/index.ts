/**
 * Tinqer - LINQ to SQL for TypeScript
 * Public API exports
 */

// ==================== LINQ API ====================
// User-facing classes and functions

export { Queryable, OrderedQueryable } from "./linq/queryable.js";
export { TerminalQuery } from "./linq/terminal-query.js";
export { from } from "./linq/from.js";
export { Grouping } from "./linq/grouping.js";

// ==================== LINQ Interfaces ====================
// Type contracts

export type { IQueryable, IOrderedQueryable } from "./linq/iqueryable.js";
export type { IGrouping } from "./linq/igrouping.js";

// ==================== Expression Types ====================
// For parsers and SQL generators to use

export type {
  Expression,
  ValueExpression,
  BooleanExpression,
  ObjectExpression,
  ArrayExpression,

  // Value expressions
  ColumnExpression,
  ConstantExpression,
  ParameterExpression,
  ArithmeticExpression,
  ConcatExpression,
  StringMethodExpression,
  CaseExpression,
  CoalesceExpression,
  CastExpression,

  // Boolean expressions
  ComparisonExpression,
  LogicalExpression,
  NotExpression,
  BooleanConstantExpression,
  BooleanColumnExpression,
  BooleanParameterExpression,
  BooleanMethodExpression,
  InExpression,
  BetweenExpression,
  IsNullExpression,
  ExistsExpression,
  LikeExpression,
  RegexExpression,

  // Complex expressions
  MemberAccessExpression,
  MethodCallExpression,
  ConditionalExpression,
  FunctionCallExpression,
  NewExpression,
  LambdaExpression,
  LambdaParameter,
} from "./expressions/expression.js";

// Type guards
export {
  isValueExpression,
  isBooleanExpression,
  isObjectExpression,
  isArrayExpression,
} from "./expressions/expression.js";

// ==================== Query Tree Types ====================
// Operation nodes for the parsed query tree

export type {
  QueryOperation,
  ParamRef,

  // Chainable operations
  FromOperation,
  WhereOperation,
  SelectOperation,
  SelectManyOperation,
  JoinOperation,
  GroupJoinOperation,
  GroupByOperation,
  GroupByWithResultSelectorOperation,
  OrderByOperation,
  ThenByOperation,
  DistinctOperation,
  DistinctByOperation,
  TakeOperation,
  TakeWhileOperation,
  SkipOperation,
  SkipWhileOperation,
  ConcatOperation,
  UnionOperation,
  IntersectOperation,
  ExceptOperation,
  ReverseOperation,
  DefaultIfEmptyOperation,
  ZipOperation,
  AppendOperation,
  PrependOperation,
  HavingOperation,

  // Terminal operations
  FirstOperation,
  FirstOrDefaultOperation,
  SingleOperation,
  SingleOrDefaultOperation,
  LastOperation,
  LastOrDefaultOperation,
  ElementAtOperation,
  ElementAtOrDefaultOperation,
  AnyOperation,
  AllOperation,
  ContainsOperation,
  CountOperation,
  LongCountOperation,
  SumOperation,
  AverageOperation,
  MinOperation,
  MaxOperation,
  AggregateOperation,
  ToArrayOperation,
  ToListOperation,
  ToDictionaryOperation,
  ToLookupOperation,

  // Union types
  ChainableOperation,
  TerminalOperation,
  AnyQueryOperation,
} from "./query-tree/operations.js";

// ==================== Parser API ====================
// To be implemented

// export { parseQuery } from "./parser/parse-query.js";
// export { parseExpression } from "./parser/parse-expression.js";