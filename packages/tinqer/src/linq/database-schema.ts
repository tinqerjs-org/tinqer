/**
 * Type-safe database context for table schemas
 */

/**
 * Database context that provides type information for tables
 * @template TSchema The schema type defining all tables and their row types
 */
export class DatabaseSchema<TSchema> {
  // Phantom type to ensure TSchema is used in type checking
  private readonly _phantom?: TSchema;

  constructor() {
    // Context doesn't need runtime data, just provides type information
    // The _phantom field is never assigned, it's only for TypeScript type checking
    void this._phantom; // Mark as intentionally unused
  }
}

/**
 * Creates a typed database context
 * @template TSchema The schema type defining all tables and their row types
 * @returns A new DatabaseSchema instance
 */
export function createSchema<TSchema>(): DatabaseSchema<TSchema> {
  return new DatabaseSchema<TSchema>();
}
