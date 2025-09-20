/**
 * LINQ-Compatible Interfaces
 * Core interfaces that match .NET LINQ System.Linq namespace
 */

import type { IGrouping } from "./igrouping.js";

/**
 * IOrderedQueryable<T> - Represents the result of a sorting operation
 */
export interface IOrderedQueryable<T> extends IQueryable<T> {
  /**
   * Performs a subsequent ordering of elements in ascending order
   */
  thenBy<TKey>(keySelector: (source: T) => TKey): IOrderedQueryable<T>;

  /**
   * Performs a subsequent ordering of elements in descending order
   */
  thenByDescending<TKey>(keySelector: (source: T) => TKey): IOrderedQueryable<T>;
}

/**
 * IQueryable<T> - Provides functionality to evaluate queries
 */
export interface IQueryable<T> {
  /**
   * Filters a sequence of values based on a predicate
   */
  where(predicate: (source: T) => boolean): IQueryable<T>;

  /**
   * Projects each element of a sequence into a new form
   */
  select<TResult>(selector: (source: T) => TResult): IQueryable<TResult>;

  /**
   * Projects each element to an IEnumerable<T> and flattens the resulting sequences
   */
  selectMany<TResult>(selector: (source: T) => TResult[]): IQueryable<TResult>;
  selectMany<TCollection, TResult>(
    collectionSelector: (source: T) => TCollection[],
    resultSelector: (source: T, collection: TCollection) => TResult,
  ): IQueryable<TResult>;

  /**
   * Correlates the elements of two sequences based on matching keys
   */
  join<TInner, TKey, TResult>(
    inner: IQueryable<TInner>,
    outerKeySelector: (outer: T) => TKey,
    innerKeySelector: (inner: TInner) => TKey,
    resultSelector: (outer: T, inner: TInner) => TResult,
  ): IQueryable<TResult>;

  /**
   * Correlates the elements of two sequences and groups the results
   */
  groupJoin<TInner, TKey, TResult>(
    inner: IQueryable<TInner>,
    outerKeySelector: (outer: T) => TKey,
    innerKeySelector: (inner: TInner) => TKey,
    resultSelector: (outer: T, inner: TInner[]) => TResult,
  ): IQueryable<TResult>;

  /**
   * Groups the elements of a sequence
   */
  groupBy<TKey>(keySelector: (source: T) => TKey): IQueryable<IGrouping<TKey, T>>;
  groupBy<TKey, TElement>(
    keySelector: (source: T) => TKey,
    elementSelector: (source: T) => TElement,
  ): IQueryable<IGrouping<TKey, TElement>>;
  groupBy<TKey, TResult>(
    keySelector: (source: T) => TKey,
    resultSelector: (key: TKey, group: IGrouping<TKey, T>) => TResult,
  ): IQueryable<TResult>;
  groupBy<TKey, TElement, TResult>(
    keySelector: (source: T) => TKey,
    elementSelector: (source: T) => TElement,
    resultSelector: (key: TKey, group: IGrouping<TKey, TElement>) => TResult,
  ): IQueryable<TResult>;

  /**
   * Sorts the elements of a sequence in ascending order
   */
  orderBy<TKey>(keySelector: (source: T) => TKey): IOrderedQueryable<T>;

  /**
   * Sorts the elements of a sequence in descending order
   */
  orderByDescending<TKey>(keySelector: (source: T) => TKey): IOrderedQueryable<T>;

  /**
   * Returns distinct elements from a sequence
   */
  distinct(): IQueryable<T>;

  /**
   * Returns distinct elements from a sequence by using a specified key selector
   */
  distinctBy<TKey>(keySelector: (source: T) => TKey): IQueryable<T>;

  /**
   * Returns a specified number of contiguous elements from the start
   */
  take(count: number): IQueryable<T>;

  /**
   * Bypasses a specified number of elements and returns the remaining
   */
  skip(count: number): IQueryable<T>;

  /**
   * Concatenates two sequences
   */
  concat(second: IQueryable<T>): IQueryable<T>;

  /**
   * Produces the set union of two sequences
   */
  union(second: IQueryable<T>): IQueryable<T>;

  /**
   * Produces the set intersection of two sequences
   */
  intersect(second: IQueryable<T>): IQueryable<T>;

  /**
   * Produces the set difference of two sequences
   */
  except(second: IQueryable<T>): IQueryable<T>;

  /**
   * Inverts the order of elements in a sequence
   */
  reverse(): IQueryable<T>;

  /**
   * Returns the elements of the specified sequence or default value if empty
   */
  defaultIfEmpty(defaultValue?: T): IQueryable<T>;

  /**
   * Applies an accumulator function over a sequence
   */
  aggregate<TAccumulate>(
    seed: TAccumulate,
    func: (accumulate: TAccumulate, source: T) => TAccumulate,
  ): TAccumulate;
  aggregate<TAccumulate, TResult>(
    seed: TAccumulate,
    func: (accumulate: TAccumulate, source: T) => TAccumulate,
    resultSelector: (accumulate: TAccumulate) => TResult,
  ): TResult;

  /**
   * Terminal Operations - these return values, not IQueryable
   */

  /**
   * Returns the first element of a sequence
   */
  first(predicate?: (source: T) => boolean): T;

  /**
   * Returns the first element or default if empty
   */
  firstOrDefault(predicate?: (source: T) => boolean, defaultValue?: T): T | undefined;

  /**
   * Returns the last element of a sequence
   */
  last(predicate?: (source: T) => boolean): T;

  /**
   * Returns the last element or default if empty
   */
  lastOrDefault(predicate?: (source: T) => boolean, defaultValue?: T): T | undefined;

  /**
   * Returns the only element of a sequence
   */
  single(predicate?: (source: T) => boolean): T;

  /**
   * Returns the only element or default if empty
   */
  singleOrDefault(predicate?: (source: T) => boolean, defaultValue?: T): T | undefined;

  /**
   * Returns the element at a specified index
   */
  elementAt(index: number): T;

  /**
   * Returns the element at a specified index or default if out of range
   */
  elementAtOrDefault(index: number, defaultValue?: T): T | undefined;

  /**
   * Determines whether any element satisfies a condition
   */
  any(predicate?: (source: T) => boolean): boolean;

  /**
   * Determines whether all elements satisfy a condition
   */
  all(predicate: (source: T) => boolean): boolean;

  /**
   * Determines whether a sequence contains a specified element
   */
  contains(value: T): boolean;

  /**
   * Returns the number of elements in a sequence
   */
  count(predicate?: (source: T) => boolean): number;

  /**
   * Returns a long representing the number of elements
   */
  longCount(predicate?: (source: T) => boolean): bigint;

  /**
   * Computes the sum of a sequence of numeric values
   */
  sum(selector?: (source: T) => number): number;

  /**
   * Computes the average of a sequence of numeric values
   */
  average(selector?: (source: T) => number): number;

  /**
   * Returns the minimum value in a sequence
   */
  min<TResult = T>(selector?: (source: T) => TResult): TResult;

  /**
   * Returns the maximum value in a sequence
   */
  max<TResult = T>(selector?: (source: T) => TResult): TResult;

  /**
   * Converts the sequence to an array
   */
  toArray(): T[];

  /**
   * Converts the sequence to a List<T>
   */
  toList(): T[];

  /**
   * Creates a Dictionary from an IQueryable<T>
   */
  toDictionary<TKey>(keySelector: (source: T) => TKey): Map<TKey, T>;
  toDictionary<TKey, TElement>(
    keySelector: (source: T) => TKey,
    elementSelector: (source: T) => TElement,
  ): Map<TKey, TElement>;

  /**
   * Creates a HashSet from an IQueryable<T>
   */
  toHashSet(): Set<T>;

  /**
   * Creates a Lookup from an IQueryable<T>
   */
  toLookup<TKey>(keySelector: (source: T) => TKey): Map<TKey, T[]>;
  toLookup<TKey, TElement>(
    keySelector: (source: T) => TKey,
    elementSelector: (source: T) => TElement,
  ): Map<TKey, TElement[]>;

  /**
   * Determines whether two sequences are equal
   */
  sequenceEqual(second: IQueryable<T>): boolean;

  /**
   * Casts the elements to the specified type
   */
  cast<TResult>(): IQueryable<TResult>;

  /**
   * Filters the elements based on a specified type
   */
  ofType<TResult>(): IQueryable<TResult>;
}

/**
 * ILookup<TKey, TElement> - Represents a collection of keys each mapped to one or more values
 */
export interface ILookup<TKey, TElement> extends Iterable<IGrouping<TKey, TElement>> {
  /**
   * Gets the number of key/value collection pairs
   */
  readonly count: number;

  /**
   * Gets the collection of values indexed by the specified key
   */
  get(key: TKey): TElement[];

  /**
   * Determines whether a specified key exists
   */
  contains(key: TKey): boolean;
}
