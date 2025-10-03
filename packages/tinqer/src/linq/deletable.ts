/**
 * Deletable class for DELETE operations with type safety
 */

/**
 * Deletable provides type-safe DELETE query building
 */
export class Deletable<T> {
  private _hasWhereOrAllow = false;

  constructor() {
    // Never actually instantiated - used only for type inference
  }

  /**
   * Specifies the WHERE condition for the delete
   * @param predicate Function that returns a boolean condition
   * @returns DeletableComplete
   */
  where(_predicate: (_item: T) => boolean): DeletableComplete<T> {
    if (this._hasWhereOrAllow) {
      throw new Error("Cannot call where() after allowFullTableDelete()");
    }
    this._hasWhereOrAllow = true;
    return new DeletableComplete<T>();
  }

  /**
   * Explicitly allows a full table delete without WHERE clause
   * DANGEROUS: This will delete ALL rows in the table
   * @returns DeletableComplete
   */
  allowFullTableDelete(): DeletableComplete<T> {
    if (this._hasWhereOrAllow) {
      throw new Error("Cannot call allowFullTableDelete() after where()");
    }
    this._hasWhereOrAllow = true;
    return new DeletableComplete<T>();
  }
}

/**
 * DeletableComplete represents a complete DELETE query
 */
export class DeletableComplete<T> {
  constructor() {
    // Never actually instantiated - used only for type inference
    // Type parameter T is preserved for external type inference
  }

  // Force TypeScript to keep the type parameter
  _?: (_: T) => void;
}
