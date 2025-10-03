/**
 * Insertable class for INSERT operations with type safety
 */

/**
 * Insertable provides type-safe INSERT query building
 */
export class Insertable<T> {
  constructor() {
    // Never actually instantiated - used only for type inference
  }

  /**
   * Specifies the values to insert
   * @param valuesSelector Function that returns an object mapping columns to values
   * @returns Insertable for further chaining
   */
  values(_valuesSelector: () => Partial<T>): Insertable<T> {
    return this;
  }

  /**
   * Specifies columns to return after insert (PostgreSQL only)
   * @param selector Function that returns the columns to return
   * @returns InsertableWithReturning for type inference
   */
  returning<TResult>(_selector: (_item: T) => TResult): InsertableWithReturning<TResult> {
    return new InsertableWithReturning<TResult>();
  }
}

/**
 * InsertableWithReturning represents an INSERT with RETURNING clause
 */
export class InsertableWithReturning<TResult> {
  constructor() {
    // Never actually instantiated - used only for type inference
    // Type parameter TResult is preserved for external type inference
  }

  // Force TypeScript to keep the type parameter
  _?: (_: TResult) => void;
}
