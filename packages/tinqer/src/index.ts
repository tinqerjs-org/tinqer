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
export { DatabaseContext, createContext } from "./linq/database-context.js";
export {
  functions,
  createQueryHelpers,
  WindowBuilder,
  WindowBuilderWithPartition,
  WindowBuilderWithOrder,
  WINDOW_MARKER,
} from "./linq/functions.js";
export type { QueryHelpers, WindowFunctionType, WindowOrderSpec } from "./linq/functions.js";

// Data modification builders
export { insertInto } from "./linq/insert-into.js";
export { Insertable, InsertableWithReturning } from "./linq/insertable.js";
export { updateTable } from "./linq/update-table.js";
export {
  Updatable,
  UpdatableWithSet,
  UpdatableComplete,
  UpdatableWithReturning,
} from "./linq/updatable.js";
export { deleteFrom } from "./linq/delete-from.js";
export { Deletable, DeletableComplete } from "./linq/deletable.js";

// ==================== LINQ Interfaces ====================
// Type contracts

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
  AggregateExpression,
  WindowFunctionExpression,
  ReferenceExpression,
  AllColumnsExpression,

  // Boolean expressions
  ComparisonExpression,
  LogicalExpression,
  NotExpression,
  BooleanConstantExpression,
  BooleanColumnExpression,
  BooleanParameterExpression,
  BooleanMethodExpression,
  CaseInsensitiveFunctionExpression,
  InExpression,
  IsNullExpression,

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
  JoinOperation,
  GroupJoinOperation,
  SelectManyOperation,
  DefaultIfEmptyOperation,
  ResultShape,
  ShapeNode,
  ColumnShapeNode,
  ObjectShapeNode,
  ReferenceShapeNode,
  ArrayShapeNode,
  GroupByOperation,
  OrderByOperation,
  ThenByOperation,
  DistinctOperation,
  TakeOperation,
  SkipOperation,
  ReverseOperation,

  // Terminal operations
  FirstOperation,
  FirstOrDefaultOperation,
  SingleOperation,
  SingleOrDefaultOperation,
  LastOperation,
  LastOrDefaultOperation,
  ContainsOperation,
  AnyOperation,
  AllOperation,
  CountOperation,
  SumOperation,
  AverageOperation,
  MinOperation,
  MaxOperation,

  // Data modification operations
  InsertOperation,
  UpdateOperation,
  DeleteOperation,

  // Union types
  ChainableOperation,
  TerminalOperation,
  AnyQueryOperation,
} from "./query-tree/operations.js";

// ==================== Parser API ====================

export { parseQuery } from "./parser/parse-query.js";
export type { ParseResult } from "./parser/parse-query.js";
export { parseJavaScript } from "./parser/oxc-parser.js";
