/**
 * Represents a collection of objects that have a common key
 * Matches .NET LINQ Grouping pattern
 */
export class Grouping<TKey, TElement> implements Iterable<TElement> {
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

  /**
   * Aggregate methods - these are placeholders for type safety
   * The SQL generator handles these specially and they're never actually called
   */

  count(): number {
    throw new Error("Grouping.count() is handled by SQL generator");
  }

  sum(_selector: (element: TElement) => number): number {
    throw new Error("Grouping.sum() is handled by SQL generator");
  }

  avg(_selector: (element: TElement) => number): number {
    throw new Error("Grouping.avg() is handled by SQL generator");
  }

  average(selector: (element: TElement) => number): number {
    return this.avg(selector);
  }

  min<TResult>(_selector: (element: TElement) => TResult): TResult {
    throw new Error("Grouping.min() is handled by SQL generator");
  }

  max<TResult>(_selector: (element: TElement) => TResult): TResult {
    throw new Error("Grouping.max() is handled by SQL generator");
  }

  defaultIfEmpty(_defaultValue?: TElement): Iterable<TElement> {
    throw new Error("Grouping.defaultIfEmpty() is handled by SQL generator");
  }
}
