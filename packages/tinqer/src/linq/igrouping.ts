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
}
