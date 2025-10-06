/**
 * Query DSL interface for type-safe query building
 */

import type { DatabaseSchema } from "./database-context.js";
import type { Queryable } from "./queryable.js";
import type { Insertable } from "./insertable.js";
import type { Updatable } from "./updatable.js";
import type { Deletable } from "./deletable.js";
import { from } from "./from.js";
import { insertInto } from "./insert-into.js";
import { update } from "./update.js";
import { deleteFrom } from "./delete-from.js";

/**
 * Query DSL interface providing type-safe query builders
 */
export interface QueryBuilder<TSchema> {
  from<K extends keyof TSchema & string>(table: K): Queryable<TSchema[K]>;
  insertInto<K extends keyof TSchema & string>(table: K): Insertable<TSchema[K]>;
  update<K extends keyof TSchema & string>(table: K): Updatable<TSchema[K]>;
  deleteFrom<K extends keyof TSchema & string>(table: K): Deletable<TSchema[K]>;
}

/**
 * Creates a query DSL object bound to a database context
 * @param context The database context with schema information
 * @returns A QueryBuilder instance with type-safe query builders
 */
export function createQueryBuilder<TSchema>(
  context: DatabaseSchema<TSchema>,
): QueryBuilder<TSchema> {
  return {
    from: (table) => from(context, table),
    insertInto: (table) => insertInto(context, table),
    update: (table) => update(context, table),
    deleteFrom: (table) => deleteFrom(context, table),
  };
}
