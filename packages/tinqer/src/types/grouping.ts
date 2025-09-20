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

/**
 * Concrete implementation of IGrouping
 */
export class Grouping<TKey, TElement> implements IGrouping<TKey, TElement> {
  constructor(
    public readonly key: TKey,
    private readonly elements: TElement[],
  ) {}

  *[Symbol.iterator](): Iterator<TElement> {
    for (const element of this.elements) {
      yield element;
    }
  }

  /**
   * Convert to array (convenience method)
   */
  toArray(): TElement[] {
    return [...this.elements];
  }
}
