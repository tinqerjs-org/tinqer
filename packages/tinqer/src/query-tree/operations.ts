/**
 * Simplified Query Operation Types for Runtime Parsing
 *
 * These types represent the parsed expression tree without complex generics.
 * They are used by the parser to build query structures from lambda expressions.
 */

import type {
  BooleanExpression,
  ValueExpression,
  ObjectExpression,
} from "../expressions/expression.js";

/**
 * Parameter reference for external parameters
 */
export interface ParamRef {
  type: "param";
  param: string;
  property?: string;
}

/**
 * Base query operation
 */
export interface QueryOperation {
  type: "queryOperation";
  operationType: string;
}

/**
 * FROM operation - the root of all query chains
 */
export interface FromOperation extends QueryOperation {
  operationType: "from";
  table: string;
  schema?: string;
}

/**
 * WHERE operation - filters the source
 */
export interface WhereOperation extends QueryOperation {
  operationType: "where";
  source: QueryOperation;
  predicate: BooleanExpression;
}

/**
 * SELECT operation - projects the source
 */
export interface SelectOperation extends QueryOperation {
  operationType: "select";
  source: QueryOperation;
  selector: ValueExpression | ObjectExpression;
}

/**
 * JOIN operation
 */
export interface JoinOperation extends QueryOperation {
  operationType: "join";
  source: QueryOperation;
  inner: QueryOperation;
  outerKey: string; // Simple column name
  innerKey: string; // Simple column name
}

/**
 * GROUP BY operation
 */
export interface GroupByOperation extends QueryOperation {
  operationType: "groupBy";
  source: QueryOperation;
  keySelector: string; // Only support simple column names
}

/**
 * ORDER BY operation
 */
export interface OrderByOperation extends QueryOperation {
  operationType: "orderBy";
  source: QueryOperation;
  keySelector: string | ValueExpression; // Support both simple columns and computed expressions
  descending: boolean;
}

/**
 * THEN BY operation - secondary ordering
 */
export interface ThenByOperation extends QueryOperation {
  operationType: "thenBy";
  source: QueryOperation; // Must be OrderByOperation or ThenByOperation
  keySelector: string | ValueExpression; // Support both simple columns and computed expressions
  descending: boolean;
}

/**
 * DISTINCT operation
 */
export interface DistinctOperation extends QueryOperation {
  operationType: "distinct";
  source: QueryOperation;
}

/**
 * TAKE operation (LIMIT)
 */
export interface TakeOperation extends QueryOperation {
  operationType: "take";
  source: QueryOperation;
  count: number | ParamRef;
}

/**
 * SKIP operation (OFFSET)
 */
export interface SkipOperation extends QueryOperation {
  operationType: "skip";
  source: QueryOperation;
  count: number | ParamRef;
}

/**
 * CONCAT operation
 */
export interface ConcatOperation extends QueryOperation {
  operationType: "concat";
  source: QueryOperation;
  second: QueryOperation;
}

/**
 * UNION operation
 */
export interface UnionOperation extends QueryOperation {
  operationType: "union";
  source: QueryOperation;
  second: QueryOperation;
}

/**
 * INTERSECT operation
 */
export interface IntersectOperation extends QueryOperation {
  operationType: "intersect";
  source: QueryOperation;
  second: QueryOperation;
}

/**
 * EXCEPT operation
 */
export interface ExceptOperation extends QueryOperation {
  operationType: "except";
  source: QueryOperation;
  second: QueryOperation;
}

/**
 * REVERSE operation
 */
export interface ReverseOperation extends QueryOperation {
  operationType: "reverse";
  source: QueryOperation;
}

/**
 * DEFAULT IF EMPTY operation
 */
export interface DefaultIfEmptyOperation extends QueryOperation {
  operationType: "defaultIfEmpty";
  source: QueryOperation;
  defaultValue?: ValueExpression;
}

/**
 * ZIP operation
 */
export interface ZipOperation extends QueryOperation {
  operationType: "zip";
  source: QueryOperation;
  second: QueryOperation;
  resultSelector: ObjectExpression;
}

/**
 * APPEND operation
 */
export interface AppendOperation extends QueryOperation {
  operationType: "append";
  source: QueryOperation;
  element: ValueExpression | ObjectExpression;
}

/**
 * PREPEND operation
 */
export interface PrependOperation extends QueryOperation {
  operationType: "prepend";
  source: QueryOperation;
  element: ValueExpression | ObjectExpression;
}

/**
 * HAVING operation - filters after grouping
 */
export interface HavingOperation extends QueryOperation {
  operationType: "having";
  source: QueryOperation; // Must be GroupByOperation
  predicate: BooleanExpression;
}

// ==================== Terminal Operations ====================

/**
 * FIRST operation
 */
export interface FirstOperation extends QueryOperation {
  operationType: "first";
  source: QueryOperation;
  predicate?: BooleanExpression;
}

/**
 * FIRST OR DEFAULT operation
 */
export interface FirstOrDefaultOperation extends QueryOperation {
  operationType: "firstOrDefault";
  source: QueryOperation;
  predicate?: BooleanExpression;
}

/**
 * SINGLE operation
 */
export interface SingleOperation extends QueryOperation {
  operationType: "single";
  source: QueryOperation;
  predicate?: BooleanExpression;
}

/**
 * SINGLE OR DEFAULT operation
 */
export interface SingleOrDefaultOperation extends QueryOperation {
  operationType: "singleOrDefault";
  source: QueryOperation;
  predicate?: BooleanExpression;
}

/**
 * LAST operation
 */
export interface LastOperation extends QueryOperation {
  operationType: "last";
  source: QueryOperation;
  predicate?: BooleanExpression;
}

/**
 * LAST OR DEFAULT operation
 */
export interface LastOrDefaultOperation extends QueryOperation {
  operationType: "lastOrDefault";
  source: QueryOperation;
  predicate?: BooleanExpression;
}

/**
 * ELEMENT AT operation
 */
export interface ElementAtOperation extends QueryOperation {
  operationType: "elementAt";
  source: QueryOperation;
  index: number | ParamRef;
}

/**
 * ELEMENT AT OR DEFAULT operation
 */
export interface ElementAtOrDefaultOperation extends QueryOperation {
  operationType: "elementAtOrDefault";
  source: QueryOperation;
  index: number | ParamRef;
}

/**
 * ANY operation
 */
export interface AnyOperation extends QueryOperation {
  operationType: "any";
  source: QueryOperation;
  predicate?: BooleanExpression;
}

/**
 * ALL operation
 */
export interface AllOperation extends QueryOperation {
  operationType: "all";
  source: QueryOperation;
  predicate: BooleanExpression; // Required for ALL
}

/**
 * CONTAINS operation
 */
export interface ContainsOperation extends QueryOperation {
  operationType: "contains";
  source: QueryOperation;
  value: ValueExpression;
}

/**
 * COUNT operation
 */
export interface CountOperation extends QueryOperation {
  operationType: "count";
  source: QueryOperation;
  predicate?: BooleanExpression;
}

/**
 * LONG COUNT operation
 */
export interface LongCountOperation extends QueryOperation {
  operationType: "longCount";
  source: QueryOperation;
  predicate?: BooleanExpression;
}

/**
 * SUM operation
 */
export interface SumOperation extends QueryOperation {
  operationType: "sum";
  source: QueryOperation;
  selector?: string; // Column name only
}

/**
 * AVERAGE operation
 */
export interface AverageOperation extends QueryOperation {
  operationType: "average";
  source: QueryOperation;
  selector?: string; // Column name only
}

/**
 * MIN operation
 */
export interface MinOperation extends QueryOperation {
  operationType: "min";
  source: QueryOperation;
  selector?: string; // Column name only
}

/**
 * MAX operation
 */
export interface MaxOperation extends QueryOperation {
  operationType: "max";
  source: QueryOperation;
  selector?: string; // Column name only
}

/**
 * AGGREGATE operation
 */
export interface AggregateOperation extends QueryOperation {
  operationType: "aggregate";
  source: QueryOperation;
  seed: ValueExpression;
  func: ObjectExpression; // Aggregate function
  resultSelector?: ObjectExpression;
}

/**
 * TO ARRAY operation
 */
export interface ToArrayOperation extends QueryOperation {
  operationType: "toArray";
  source: QueryOperation;
}

/**
 * TO LIST operation
 */
export interface ToListOperation extends QueryOperation {
  operationType: "toList";
  source: QueryOperation;
}

/**
 * TO DICTIONARY operation
 */
export interface ToDictionaryOperation extends QueryOperation {
  operationType: "toDictionary";
  source: QueryOperation;
  keySelector: string | ValueExpression;
  elementSelector?: ValueExpression | ObjectExpression;
}

/**
 * TO LOOKUP operation
 */
export interface ToLookupOperation extends QueryOperation {
  operationType: "toLookup";
  source: QueryOperation;
  keySelector: string | ValueExpression;
  elementSelector?: ValueExpression | ObjectExpression;
}

/**
 * Union type for all chainable operations
 */
export type ChainableOperation =
  | FromOperation
  | WhereOperation
  | SelectOperation
  | JoinOperation
  | GroupByOperation
  | OrderByOperation
  | ThenByOperation
  | DistinctOperation
  | TakeOperation
  | SkipOperation
  | UnionOperation
  | ReverseOperation;

/**
 * Union type for all terminal operations
 */
export type TerminalOperation =
  | FirstOperation
  | FirstOrDefaultOperation
  | SingleOperation
  | SingleOrDefaultOperation
  | LastOperation
  | LastOrDefaultOperation
  | ContainsOperation
  | CountOperation
  | SumOperation
  | AverageOperation
  | MinOperation
  | MaxOperation
  | ToArrayOperation;

/**
 * Union type for all operations
 */
export type AnyQueryOperation = ChainableOperation | TerminalOperation;
