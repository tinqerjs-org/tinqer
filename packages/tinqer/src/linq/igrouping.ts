/**
 * IGrouping<TKey, TElement> Interface
 * Represents a collection of objects that have a common key
 * Matches .NET LINQ IGrouping interface
 */

/**
 * Represents a collection of objects that have a common key
 */
export interface IGrouping<TKey, TElement> extends Iterable<TElement> {
  /**
   * Gets the key of the IGrouping<TKey, TElement>
   */
  readonly key: TKey;

  /**
   * Aggregate methods available in SELECT projections after GROUP BY
   * These are handled specially by the SQL generator
   */

  /**
   * Returns the number of elements in the group
   */
  count(): number;

  /**
   * Computes the sum of the selected values
   */
  sum(selector: (element: TElement) => number): number;

  /**
   * Computes the average of the selected values
   */
  avg(selector: (element: TElement) => number): number;
  average(selector: (element: TElement) => number): number;

  /**
   * Returns the minimum value
   */
  min<TResult>(selector: (element: TElement) => TResult): TResult;

  /**
   * Returns the maximum value
   */
  max<TResult>(selector: (element: TElement) => TResult): TResult;

  /**
   * Returns the elements of the group, or a default value if the group is empty
   */
  defaultIfEmpty(defaultValue?: TElement): Iterable<TElement>;
}
