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
}