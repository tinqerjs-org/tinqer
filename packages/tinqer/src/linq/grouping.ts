/**
 * Concrete implementation of IGrouping
 */

import type { IGrouping } from "./igrouping.js";

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

  /**
   * Aggregate methods - these are placeholders for type safety
   * The SQL generator handles these specially and they're never actually called
   */

  count(): number {
    throw new Error("IGrouping.count() is handled by SQL generator");
  }

  sum(_selector: (element: TElement) => number): number {
    throw new Error("IGrouping.sum() is handled by SQL generator");
  }

  avg(_selector: (element: TElement) => number): number {
    throw new Error("IGrouping.avg() is handled by SQL generator");
  }

  average(selector: (element: TElement) => number): number {
    return this.avg(selector);
  }

  min<TResult>(_selector: (element: TElement) => TResult): TResult {
    throw new Error("IGrouping.min() is handled by SQL generator");
  }

  max<TResult>(_selector: (element: TElement) => TResult): TResult {
    throw new Error("IGrouping.max() is handled by SQL generator");
  }
}
