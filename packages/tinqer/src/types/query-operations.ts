/**
 * Query Operation Types with Full Type Preservation
 *
 * Expression tree representation of LINQ-style query operations
 * Each operation tracks its input and output types, preserving type information
 * throughout the entire query chain, matching .NET LINQ's approach.
 */

import type { IGrouping } from "./grouping.js";

/**
 * Base expression type
 */
export interface Expression {
  type: string;
}

/**
 * Parameter expression with origin tracking
 */
export interface ParameterExpression extends Expression {
  type: "parameter";
  name: string;
  origin: ParameterOrigin;
}

export type ParameterOrigin =
  | { type: "table"; ref: string }
  | { type: "external" }
  | { type: "joined" }
  | { type: "cte" }
  | { type: "subquery" };

/**
 * Lambda expression that preserves function signature type
 * Equivalent to .NET's Expression<Func<T, TResult>>
 */
export interface LambdaExpression<TFunc> extends Expression {
  type: "lambda";
  parameters: ParameterExpression[];
  body: Expression;
  _functionType?: TFunc; // Phantom type to preserve function signature
}

/**
 * Base query operation with input and output type tracking
 * Every operation knows what type it consumes and what type it produces
 */
export interface QueryOperation<TIn, TOut> {
  type: "queryOperation";
  operationType: string;
  _inputType?: TIn; // Phantom type for input
  _outputType?: TOut; // Phantom type for output
}

/**
 * FROM operation - the root of all query chains
 * No input, produces T
 */
export interface FromOperation<T> extends QueryOperation<never, T> {
  operationType: "from";
  table: string;
  schema?: string;
}

/**
 * WHERE operation - filters the source
 * T → T (preserves type)
 * Equivalent to LINQ: Where<TSource>(Expression<Func<TSource, bool>> predicate)
 * TSource preserves the complete source operation type
 */
export interface WhereOperation<TSource extends QueryOperation<any, T>, T>
  extends QueryOperation<T, T> {
  operationType: "where";
  source: TSource; // Preserve exact source type
  predicate: LambdaExpression<(source: T) => boolean>;
}

/**
 * SELECT operation - projects the source
 * T → TResult (transforms type)
 * Equivalent to LINQ: Select<TSource, TResult>(Expression<Func<TSource, TResult>> selector)
 * TSource preserves the complete source operation type
 */
export interface SelectOperation<TSource extends QueryOperation<any, T>, T, TResult>
  extends QueryOperation<T, TResult> {
  operationType: "select";
  source: TSource; // Preserve exact source type
  selector: LambdaExpression<(source: T) => TResult>;
}

/**
 * SELECT MANY operation - projects and flattens
 * T → TResult (flattens collections)
 * Equivalent to LINQ: SelectMany<TSource, TCollection, TResult>
 * TSource preserves the complete source operation type
 *
 * When resultSelector is omitted, TResult = TCollection
 */
export interface SelectManyOperation<
  TSource extends QueryOperation<any, T>,
  T,
  TCollection,
  TResult = TCollection,
> extends QueryOperation<T, TResult> {
  operationType: "selectMany";
  source: TSource; // Preserve exact source type
  collectionSelector: LambdaExpression<(source: T) => TCollection[]>;
  resultSelector?: LambdaExpression<(source: T, collection: TCollection) => TResult>;
}

/**
 * JOIN operation
 * TOuter → TResult (combines two sources)
 * Equivalent to LINQ: Join<TOuter, TInner, TKey, TResult>
 * TOuterSource and TInnerSource preserve complete source operation types
 */
export interface JoinOperation<
  TOuterSource extends QueryOperation<any, TOuter>,
  TInnerSource extends QueryOperation<any, TInner>,
  TOuter,
  TInner,
  TKey,
  TResult,
> extends QueryOperation<TOuter, TResult> {
  operationType: "join";
  source: TOuterSource; // Preserve exact outer source type
  inner: TInnerSource; // Preserve exact inner source type
  outerKeySelector: LambdaExpression<(outer: TOuter) => TKey>;
  innerKeySelector: LambdaExpression<(inner: TInner) => TKey>;
  resultSelector: LambdaExpression<(outer: TOuter, inner: TInner) => TResult>;
  joinType: "inner" | "left" | "right" | "full" | "cross";
}

/**
 * GROUP JOIN operation - left outer join with grouping
 * TOuter → TResult (groups inner elements)
 * Equivalent to LINQ: GroupJoin<TOuter, TInner, TKey, TResult>
 * TOuterSource and TInnerSource preserve complete source operation types
 */
export interface GroupJoinOperation<
  TOuterSource extends QueryOperation<any, TOuter>,
  TInnerSource extends QueryOperation<any, TInner>,
  TOuter,
  TInner,
  TKey,
  TResult,
> extends QueryOperation<TOuter, TResult> {
  operationType: "groupJoin";
  source: TOuterSource; // Preserve exact outer source type
  inner: TInnerSource; // Preserve exact inner source type
  outerKeySelector: LambdaExpression<(outer: TOuter) => TKey>;
  innerKeySelector: LambdaExpression<(inner: TInner) => TKey>;
  resultSelector: LambdaExpression<(outer: TOuter, inner: TInner[]) => TResult>;
}

/**
 * GROUP BY operation
 * T → IGrouping<TKey, TElement> (groups elements)
 * Equivalent to LINQ: GroupBy<TSource, TKey, TElement>
 * TSource preserves the complete source operation type
 */
export interface GroupByOperation<TSource extends QueryOperation<any, T>, T, TKey, TElement = T>
  extends QueryOperation<T, IGrouping<TKey, TElement>> {
  operationType: "groupBy";
  source: TSource; // Preserve exact source type
  keySelector: LambdaExpression<(source: T) => TKey>;
  elementSelector?: LambdaExpression<(source: T) => TElement>;
}

/**
 * GROUP BY with result selector operation
 * T → TResult (groups and transforms)
 * TSource preserves the complete source operation type
 */
export interface GroupByWithResultSelectorOperation<
  TSource extends QueryOperation<any, T>,
  T,
  TKey,
  TElement,
  TResult,
> extends QueryOperation<T, TResult> {
  operationType: "groupByWithResultSelector";
  source: TSource; // Preserve exact source type
  keySelector: LambdaExpression<(source: T) => TKey>;
  elementSelector?: LambdaExpression<(source: T) => TElement>;
  resultSelector: LambdaExpression<(key: TKey, group: IGrouping<TKey, TElement>) => TResult>;
}

/**
 * ORDER BY operation
 * T → T (preserves type but marks as ordered)
 * Equivalent to LINQ: OrderBy<TSource, TKey>
 * TSource preserves the complete source operation type
 */
export interface OrderByOperation<TSource extends QueryOperation<any, T>, T, TKey>
  extends QueryOperation<T, T> {
  operationType: "orderBy";
  source: TSource; // Preserve exact source type
  keySelector: LambdaExpression<(source: T) => TKey>;
  direction: "ascending" | "descending";
  _ordered: true; // Marks this as an ordered sequence
}

/**
 * THEN BY operation - secondary ordering
 * T → T (preserves type, maintains ordering)
 * Equivalent to LINQ: ThenBy<TSource, TKey>
 * TSource MUST be an ordered operation (OrderBy or ThenBy)
 */
export interface ThenByOperation<
  TSource extends OrderByOperation<any, T, any> | ThenByOperation<any, T, any>,
  T,
  TKey,
> extends QueryOperation<T, T> {
  operationType: "thenBy";
  source: TSource; // Must be ordered - compile-time enforced!
  keySelector: LambdaExpression<(source: T) => TKey>;
  direction: "ascending" | "descending";
  _ordered: true; // Maintains ordered marker
}

/**
 * DISTINCT operation
 * T → T (preserves type but removes duplicates)
 * Equivalent to LINQ: Distinct<TSource>()
 * TSource preserves the complete source operation type
 */
export interface DistinctOperation<TSource extends QueryOperation<any, T>, T>
  extends QueryOperation<T, T> {
  operationType: "distinct";
  source: TSource; // Preserve exact source type
}

/**
 * DISTINCT BY operation
 * T → T (preserves type but removes duplicates by key)
 * Equivalent to LINQ: DistinctBy<TSource, TKey>
 * TSource preserves the complete source operation type
 */
export interface DistinctByOperation<TSource extends QueryOperation<any, T>, T, TKey>
  extends QueryOperation<T, T> {
  operationType: "distinctBy";
  source: TSource; // Preserve exact source type
  keySelector: LambdaExpression<(source: T) => TKey>;
}

/**
 * TAKE operation (LIMIT)
 * T → T (preserves type but limits count)
 * Equivalent to LINQ: Take<TSource>(int count)
 * TSource preserves the complete source operation type
 */
export interface TakeOperation<TSource extends QueryOperation<any, T>, T>
  extends QueryOperation<T, T> {
  operationType: "take";
  source: TSource; // Preserve exact source type
  count: number | LambdaExpression<(params: any) => number>;
}

/**
 * TAKE WHILE operation
 * T → T (preserves type but limits by predicate)
 * Equivalent to LINQ: TakeWhile<TSource>
 * TSource preserves the complete source operation type
 */
export interface TakeWhileOperation<TSource extends QueryOperation<any, T>, T>
  extends QueryOperation<T, T> {
  operationType: "takeWhile";
  source: TSource; // Preserve exact source type
  predicate:
    | LambdaExpression<(source: T) => boolean>
    | LambdaExpression<(source: T, index: number) => boolean>;
}

/**
 * SKIP operation (OFFSET)
 * T → T (preserves type but skips elements)
 * Equivalent to LINQ: Skip<TSource>(int count)
 * TSource preserves the complete source operation type
 */
export interface SkipOperation<TSource extends QueryOperation<any, T>, T>
  extends QueryOperation<T, T> {
  operationType: "skip";
  source: TSource; // Preserve exact source type
  count: number | LambdaExpression<(params: any) => number>;
}

/**
 * SKIP WHILE operation
 * T → T (preserves type but skips by predicate)
 * Equivalent to LINQ: SkipWhile<TSource>
 * TSource preserves the complete source operation type
 */
export interface SkipWhileOperation<TSource extends QueryOperation<any, T>, T>
  extends QueryOperation<T, T> {
  operationType: "skipWhile";
  source: TSource; // Preserve exact source type
  predicate:
    | LambdaExpression<(source: T) => boolean>
    | LambdaExpression<(source: T, index: number) => boolean>;
}

/**
 * CONCAT operation
 * T → T (combines two sequences of same type)
 * Equivalent to LINQ: Concat<TSource>
 * TFirstSource and TSecondSource preserve complete source operation types
 */
export interface ConcatOperation<
  TFirstSource extends QueryOperation<any, T>,
  TSecondSource extends QueryOperation<any, T>,
  T,
> extends QueryOperation<T, T> {
  operationType: "concat";
  source: TFirstSource; // Preserve exact first source type
  second: TSecondSource; // Preserve exact second source type
}

/**
 * UNION operation
 * T → T (set union of two sequences)
 * Equivalent to LINQ: Union<TSource>
 * TFirstSource and TSecondSource preserve complete source operation types
 */
export interface UnionOperation<
  TFirstSource extends QueryOperation<any, T>,
  TSecondSource extends QueryOperation<any, T>,
  T,
> extends QueryOperation<T, T> {
  operationType: "union";
  source: TFirstSource; // Preserve exact first source type
  second: TSecondSource; // Preserve exact second source type
}

/**
 * INTERSECT operation
 * T → T (set intersection of two sequences)
 * Equivalent to LINQ: Intersect<TSource>
 * TFirstSource and TSecondSource preserve complete source operation types
 */
export interface IntersectOperation<
  TFirstSource extends QueryOperation<any, T>,
  TSecondSource extends QueryOperation<any, T>,
  T,
> extends QueryOperation<T, T> {
  operationType: "intersect";
  source: TFirstSource; // Preserve exact first source type
  second: TSecondSource; // Preserve exact second source type
}

/**
 * EXCEPT operation
 * T → T (set difference of two sequences)
 * Equivalent to LINQ: Except<TSource>
 * TFirstSource and TSecondSource preserve complete source operation types
 */
export interface ExceptOperation<
  TFirstSource extends QueryOperation<any, T>,
  TSecondSource extends QueryOperation<any, T>,
  T,
> extends QueryOperation<T, T> {
  operationType: "except";
  source: TFirstSource; // Preserve exact first source type
  second: TSecondSource; // Preserve exact second source type
}

/**
 * REVERSE operation
 * T → T (reverses order)
 * Equivalent to LINQ: Reverse<TSource>()
 * TSource preserves the complete source operation type
 */
export interface ReverseOperation<TSource extends QueryOperation<any, T>, T>
  extends QueryOperation<T, T> {
  operationType: "reverse";
  source: TSource; // Preserve exact source type
}

/**
 * DEFAULT IF EMPTY operation
 * T → T (provides default if empty)
 * Equivalent to LINQ: DefaultIfEmpty<TSource>
 * TSource preserves the complete source operation type
 */
export interface DefaultIfEmptyOperation<TSource extends QueryOperation<any, T>, T>
  extends QueryOperation<T, T> {
  operationType: "defaultIfEmpty";
  source: TSource; // Preserve exact source type
  defaultValue?: T;
}

/**
 * ZIP operation
 * T → TResult (combines two sequences element by element)
 * Equivalent to LINQ: Zip<TFirst, TSecond, TResult>
 * TFirstSource and TSecondSource preserve complete source operation types
 */
export interface ZipOperation<
  TFirstSource extends QueryOperation<any, TFirst>,
  TSecondSource extends QueryOperation<any, TSecond>,
  TFirst,
  TSecond,
  TResult,
> extends QueryOperation<TFirst, TResult> {
  operationType: "zip";
  source: TFirstSource; // Preserve exact first source type
  second: TSecondSource; // Preserve exact second source type
  resultSelector: LambdaExpression<(first: TFirst, second: TSecond) => TResult>;
}

/**
 * APPEND operation
 * T → T (adds element at end)
 * Equivalent to LINQ: Append<TSource>
 * TSource preserves the complete source operation type
 */
export interface AppendOperation<TSource extends QueryOperation<any, T>, T>
  extends QueryOperation<T, T> {
  operationType: "append";
  source: TSource; // Preserve exact source type
  element: T;
}

/**
 * PREPEND operation
 * T → T (adds element at start)
 * Equivalent to LINQ: Prepend<TSource>
 * TSource preserves the complete source operation type
 */
export interface PrependOperation<TSource extends QueryOperation<any, T>, T>
  extends QueryOperation<T, T> {
  operationType: "prepend";
  source: TSource; // Preserve exact source type
  element: T;
}

/**
 * HAVING operation - filters after grouping
 * IGrouping<TKey, TElement> → IGrouping<TKey, TElement>
 * SQL-specific, not in standard LINQ
 * TSource MUST be a GroupByOperation - compile-time enforced!
 */
export interface HavingOperation<
  TSource extends GroupByOperation<any, any, TKey, TElement>,
  TKey,
  TElement,
> extends QueryOperation<IGrouping<TKey, TElement>, IGrouping<TKey, TElement>> {
  operationType: "having";
  source: TSource; // Must be a group by - compile-time enforced!
  predicate: LambdaExpression<(group: IGrouping<TKey, TElement>) => boolean>;
}

/**
 * Terminal operation base with input and output types
 * Terminal operations consume a query and produce a final result
 * TSource preserves the complete source operation type
 */
export interface TerminalOperation<TSource extends QueryOperation<any, TIn>, TIn, TOut> {
  type: "terminalOperation";
  terminalType: string;
  source: TSource; // Preserve exact source type
  _resultType?: TOut; // Phantom type for result
}

/**
 * FIRST operation
 * T → T (returns single element)
 * Equivalent to LINQ: First<TSource>
 * TSource preserves the complete source operation type
 */
export interface FirstOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, T> {
  terminalType: "first";
  predicate?: LambdaExpression<(source: T) => boolean>;
}

/**
 * FIRST OR DEFAULT operation
 * T → T | undefined
 * Equivalent to LINQ: FirstOrDefault<TSource>
 * TSource preserves the complete source operation type
 */
export interface FirstOrDefaultOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, T | undefined> {
  terminalType: "firstOrDefault";
  predicate?: LambdaExpression<(source: T) => boolean>;
  defaultValue?: T;
}

/**
 * LAST operation
 * T → T
 * Equivalent to LINQ: Last<TSource>
 * TSource preserves the complete source operation type
 */
export interface LastOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, T> {
  terminalType: "last";
  predicate?: LambdaExpression<(source: T) => boolean>;
}

/**
 * LAST OR DEFAULT operation
 * T → T | undefined
 * Equivalent to LINQ: LastOrDefault<TSource>
 * TSource preserves the complete source operation type
 */
export interface LastOrDefaultOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, T | undefined> {
  terminalType: "lastOrDefault";
  predicate?: LambdaExpression<(source: T) => boolean>;
  defaultValue?: T;
}

/**
 * SINGLE operation
 * T → T (ensures exactly one element)
 * Equivalent to LINQ: Single<TSource>
 * TSource preserves the complete source operation type
 */
export interface SingleOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, T> {
  terminalType: "single";
  predicate?: LambdaExpression<(source: T) => boolean>;
}

/**
 * SINGLE OR DEFAULT operation
 * T → T | undefined
 * Equivalent to LINQ: SingleOrDefault<TSource>
 * TSource preserves the complete source operation type
 */
export interface SingleOrDefaultOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, T | undefined> {
  terminalType: "singleOrDefault";
  predicate?: LambdaExpression<(source: T) => boolean>;
  defaultValue?: T;
}

/**
 * ELEMENT AT operation
 * T → T
 * Equivalent to LINQ: ElementAt<TSource>
 * TSource preserves the complete source operation type
 */
export interface ElementAtOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, T> {
  terminalType: "elementAt";
  index: number;
}

/**
 * ELEMENT AT OR DEFAULT operation
 * T → T | undefined
 * Equivalent to LINQ: ElementAtOrDefault<TSource>
 * TSource preserves the complete source operation type
 */
export interface ElementAtOrDefaultOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, T | undefined> {
  terminalType: "elementAtOrDefault";
  index: number;
  defaultValue?: T;
}

/**
 * COUNT operation
 * T → number
 * Equivalent to LINQ: Count<TSource>
 * TSource preserves the complete source operation type
 */
export interface CountOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, number> {
  terminalType: "count";
  predicate?: LambdaExpression<(source: T) => boolean>;
}

/**
 * LONG COUNT operation
 * T → bigint
 * Equivalent to LINQ: LongCount<TSource>
 * TSource preserves the complete source operation type
 */
export interface LongCountOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, bigint> {
  terminalType: "longCount";
  predicate?: LambdaExpression<(source: T) => boolean>;
}

/**
 * ANY operation
 * T → boolean
 * Equivalent to LINQ: Any<TSource>
 * TSource preserves the complete source operation type
 */
export interface AnyOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, boolean> {
  terminalType: "any";
  predicate?: LambdaExpression<(source: T) => boolean>;
}

/**
 * ALL operation
 * T → boolean
 * Equivalent to LINQ: All<TSource>
 * TSource preserves the complete source operation type
 */
export interface AllOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, boolean> {
  terminalType: "all";
  predicate: LambdaExpression<(source: T) => boolean>; // Required
}

/**
 * CONTAINS operation
 * T → boolean
 * Equivalent to LINQ: Contains<TSource>
 * TSource preserves the complete source operation type
 */
export interface ContainsOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, boolean> {
  terminalType: "contains";
  value: T;
}

/**
 * SUM operation
 * T → number
 * Equivalent to LINQ: Sum<TSource>
 * TSource preserves the complete source operation type
 */
export interface SumOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, number> {
  terminalType: "sum";
  selector?: LambdaExpression<(source: T) => number>;
}

/**
 * AVERAGE operation
 * T → number
 * Equivalent to LINQ: Average<TSource>
 * TSource preserves the complete source operation type
 */
export interface AverageOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, number> {
  terminalType: "average";
  selector?: LambdaExpression<(source: T) => number>;
}

/**
 * MIN operation
 * T → TResult
 * Equivalent to LINQ: Min<TSource, TResult>
 * TSource preserves the complete source operation type
 */
export interface MinOperation<TSource extends QueryOperation<any, T>, T, TResult = T>
  extends TerminalOperation<TSource, T, TResult> {
  terminalType: "min";
  selector?: LambdaExpression<(source: T) => TResult>;
}

/**
 * MAX operation
 * T → TResult
 * Equivalent to LINQ: Max<TSource, TResult>
 * TSource preserves the complete source operation type
 */
export interface MaxOperation<TSource extends QueryOperation<any, T>, T, TResult = T>
  extends TerminalOperation<TSource, T, TResult> {
  terminalType: "max";
  selector?: LambdaExpression<(source: T) => TResult>;
}

/**
 * AGGREGATE operation
 * T → TResult
 * Equivalent to LINQ: Aggregate<TSource, TAccumulate, TResult>
 * TSource preserves the complete source operation type
 */
export interface AggregateOperation<
  TSource extends QueryOperation<any, T>,
  T,
  TAccumulate,
  TResult = TAccumulate,
> extends TerminalOperation<TSource, T, TResult> {
  terminalType: "aggregate";
  seed?: TAccumulate;
  func: LambdaExpression<(accumulate: TAccumulate, source: T) => TAccumulate>;
  resultSelector?: LambdaExpression<(accumulate: TAccumulate) => TResult>;
}

/**
 * SEQUENCE EQUAL operation
 * T → boolean
 * Equivalent to LINQ: SequenceEqual<TSource>
 * TSource and TSecondSource preserve complete source operation types
 */
export interface SequenceEqualOperation<
  TSource extends QueryOperation<any, T>,
  TSecondSource extends QueryOperation<any, T>,
  T,
> extends TerminalOperation<TSource, T, boolean> {
  terminalType: "sequenceEqual";
  second: TSecondSource; // Preserve exact second source type
}

/**
 * TO ARRAY operation
 * T → T[]
 * Equivalent to LINQ: ToArray<TSource>()
 * TSource preserves the complete source operation type
 */
export interface ToArrayOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, T[]> {
  terminalType: "toArray";
}

/**
 * TO LIST operation
 * T → T[]
 * Equivalent to LINQ: ToList<TSource>()
 * TSource preserves the complete source operation type
 */
export interface ToListOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, T[]> {
  terminalType: "toList";
}

/**
 * TO DICTIONARY operation
 * T → Map<TKey, TElement>
 * Equivalent to LINQ: ToDictionary<TSource, TKey, TElement>
 * TSource preserves the complete source operation type
 */
export interface ToDictionaryOperation<
  TSource extends QueryOperation<any, T>,
  T,
  TKey,
  TElement = T,
> extends TerminalOperation<TSource, T, Map<TKey, TElement>> {
  terminalType: "toDictionary";
  keySelector: LambdaExpression<(source: T) => TKey>;
  elementSelector?: LambdaExpression<(source: T) => TElement>;
}

/**
 * TO HASH SET operation
 * T → Set<T>
 * Equivalent to LINQ: ToHashSet<TSource>()
 * TSource preserves the complete source operation type
 */
export interface ToHashSetOperation<TSource extends QueryOperation<any, T>, T>
  extends TerminalOperation<TSource, T, Set<T>> {
  terminalType: "toHashSet";
}

/**
 * TO LOOKUP operation
 * T → Map<TKey, TElement[]>
 * Equivalent to LINQ: ToLookup<TSource, TKey, TElement>
 * TSource preserves the complete source operation type
 */
export interface ToLookupOperation<TSource extends QueryOperation<any, T>, T, TKey, TElement = T>
  extends TerminalOperation<TSource, T, Map<TKey, TElement[]>> {
  terminalType: "toLookup";
  keySelector: LambdaExpression<(source: T) => TKey>;
  elementSelector?: LambdaExpression<(source: T) => TElement>;
}

/**
 * CAST operation
 * T → TResult
 * Equivalent to LINQ: Cast<TResult>()
 * TSource preserves the complete source operation type
 */
export interface CastOperation<TSource extends QueryOperation<any, T>, T, TResult>
  extends TerminalOperation<TSource, T, TResult> {
  terminalType: "cast";
  _targetType?: TResult; // Phantom type for cast target
}

/**
 * OF TYPE operation
 * T → TResult
 * Equivalent to LINQ: OfType<TResult>()
 * TSource preserves the complete source operation type
 */
export interface OfTypeOperation<TSource extends QueryOperation<any, T>, T, TResult>
  extends TerminalOperation<TSource, T, TResult> {
  terminalType: "ofType";
  _targetType?: TResult; // Phantom type for filter type
}
