/**
 * Simplified Query Operation Types for Runtime Parsing
 *
 * These types represent the parsed expression tree without complex generics.
 * They are used by the parser to build query structures from lambda expressions.
 */

import type { IGrouping } from "../linq/igrouping.js";
import type {
  BooleanExpression,
  ValueExpression,
  ObjectExpression,
  ArrayExpression
} from "../expressions/expression.js";

/**
 * Parameter reference for external parameters
 */
export interface ParamRef {
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
 * SELECT MANY operation - projects and flattens
 */
export interface SelectManyOperation extends QueryOperation {
  operationType: "selectMany";
  source: QueryOperation;
  collectionSelector: ValueExpression | ArrayExpression;
  resultSelector?: ObjectExpression;
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
  resultSelector: ObjectExpression;
  joinType: "inner" | "left" | "right" | "full" | "cross";
}

/**
 * GROUP JOIN operation - left outer join with grouping
 */
export interface GroupJoinOperation extends QueryOperation {
  operationType: "groupJoin";
  source: QueryOperation;
  inner: QueryOperation;
  outerKey: string;
  innerKey: string;
  resultSelector: ObjectExpression;
}

/**
 * GROUP BY operation
 */
export interface GroupByOperation extends QueryOperation {
  operationType: "groupBy";
  source: QueryOperation;
  keySelector: string | ValueExpression;
  elementSelector?: ValueExpression | ObjectExpression;
}

/**
 * GROUP BY with result selector
 */
export interface GroupByWithResultSelectorOperation extends QueryOperation {
  operationType: "groupByWithResultSelector";
  source: QueryOperation;
  keySelector: string | ValueExpression;
  elementSelector?: ValueExpression | ObjectExpression;
  resultSelector: ObjectExpression;
}

/**
 * ORDER BY operation
 */
export interface OrderByOperation extends QueryOperation {
  operationType: "orderBy";
  source: QueryOperation;
  keySelector: string | ValueExpression;
  direction: "ascending" | "descending";
}

/**
 * THEN BY operation - secondary ordering
 */
export interface ThenByOperation extends QueryOperation {
  operationType: "thenBy";
  source: QueryOperation; // Must be OrderByOperation or ThenByOperation
  keySelector: string | ValueExpression;
  direction: "ascending" | "descending";
}

/**
 * DISTINCT operation
 */
export interface DistinctOperation extends QueryOperation {
  operationType: "distinct";
  source: QueryOperation;
}

/**
 * DISTINCT BY operation
 */
export interface DistinctByOperation extends QueryOperation {
  operationType: "distinctBy";
  source: QueryOperation;
  keySelector: string | ValueExpression;
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
 * TAKE WHILE operation
 */
export interface TakeWhileOperation extends QueryOperation {
  operationType: "takeWhile";
  source: QueryOperation;
  predicate: BooleanExpression;
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
 * SKIP WHILE operation
 */
export interface SkipWhileOperation extends QueryOperation {
  operationType: "skipWhile";
  source: QueryOperation;
  predicate: BooleanExpression;
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
  selector: ValueExpression;
}

/**
 * AVERAGE operation
 */
export interface AverageOperation extends QueryOperation {
  operationType: "average";
  source: QueryOperation;
  selector: ValueExpression;
}

/**
 * MIN operation
 */
export interface MinOperation extends QueryOperation {
  operationType: "min";
  source: QueryOperation;
  selector?: ValueExpression;
}

/**
 * MAX operation
 */
export interface MaxOperation extends QueryOperation {
  operationType: "max";
  source: QueryOperation;
  selector?: ValueExpression;
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
  | SelectManyOperation
  | JoinOperation
  | GroupJoinOperation
  | GroupByOperation
  | GroupByWithResultSelectorOperation
  | OrderByOperation
  | ThenByOperation
  | DistinctOperation
  | DistinctByOperation
  | TakeOperation
  | TakeWhileOperation
  | SkipOperation
  | SkipWhileOperation
  | ConcatOperation
  | UnionOperation
  | IntersectOperation
  | ExceptOperation
  | ReverseOperation
  | DefaultIfEmptyOperation
  | ZipOperation
  | AppendOperation
  | PrependOperation
  | HavingOperation;

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
  | ElementAtOperation
  | ElementAtOrDefaultOperation
  | AnyOperation
  | AllOperation
  | ContainsOperation
  | CountOperation
  | LongCountOperation
  | SumOperation
  | AverageOperation
  | MinOperation
  | MaxOperation
  | AggregateOperation
  | ToArrayOperation
  | ToListOperation
  | ToDictionaryOperation
  | ToLookupOperation;

/**
 * Union type for all operations
 */
export type AnyQueryOperation = ChainableOperation | TerminalOperation;