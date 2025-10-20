/**
 * PostgreSQL SQL generator for Tinqer using pg-promise format
 */

import {
  type Queryable,
  type OrderedQueryable,
  type TerminalQuery,
  type QueryHelpers,
  type QueryBuilder,
  type DatabaseSchema,
  type Insertable,
  type InsertableWithReturning,
  type UpdatableWithSet,
  type UpdatableComplete,
  type UpdatableWithReturning,
  type Deletable,
  type DeletableComplete,
  type ParseQueryOptions,
  defineSelect,
  defineInsert,
  defineUpdate,
  defineDelete,
  isTerminalHandle,
  type QueryOperation,
  type InsertOperation,
  type UpdateOperation,
  SelectPlanHandle,
  SelectTerminalHandle,
  InsertPlanHandleWithValues,
  InsertPlanHandleWithReturning,
  UpdatePlanHandleComplete,
  UpdatePlanHandleWithReturning,
  DeletePlanHandleComplete,
} from "@webpods/tinqer";
import { generateSql } from "./sql-generator.js";
import type { SqlResult, ExecuteOptions } from "./types.js";

/**
 * Helper function to expand array parameters into indexed parameters
 * e.g., { ids: [1, 2, 3] } becomes { ids: [1, 2, 3], "ids_0": 1, "ids_1": 2, "ids_2": 3 }
 */
function expandArrayParams(params: Record<string, unknown>): Record<string, unknown> {
  const expanded: Record<string, unknown> = { ...params };

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        expanded[`${key}_${index}`] = item;
      });
    }
  }

  return expanded;
}

function materializePlan<TParams>(
  plan: {
    finalize(params: TParams): {
      operation: QueryOperation;
      params: Record<string, unknown>;
    };
  },
  params: TParams,
): {
  operation: QueryOperation;
  mergedParams: Record<string, unknown>;
  sql: string;
  expandedParams: Record<string, unknown>;
} {
  const { operation, params: mergedParams } = plan.finalize(params);
  const sql = generateSql(operation, mergedParams);
  const expandedParams = expandArrayParams(mergedParams);
  return { operation, mergedParams, sql, expandedParams };
}

/**
 * Generate SQL from a query builder function (with params and helpers)
 */
export function selectStatement<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, TResult>;

/**
 * Generate SQL from a query builder function (with params only, no helpers)
 */
export function selectStatement<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, TResult>;

/**
 * Generate SQL from a query builder function (query builder only, no params or helpers)
 */
export function selectStatement<TSchema, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>,
): SqlResult<Record<string, string | number | boolean | null>, TResult>;

// Implementation
export function selectStatement<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
        helpers: QueryHelpers,
      ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
      ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>),
  params?: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, TResult> {
  // Create plan using defineSelect
  // Type assertion needed due to complex overload resolution between
  // the builder's union return type and defineSelect's overloads
  let plan;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plan = defineSelect(schema, builder as any, options);
  } catch (error) {
    // Maintain backward compatibility with error messages
    if (error instanceof Error && error.message === "Failed to parse select plan") {
      throw new Error("Failed to parse query");
    }
    throw error;
  }

  // Get operation and merged params from plan
  const { operation, params: mergedParams } = plan.finalize(params || ({} as TParams));

  // Generate SQL string using existing generator
  const sql = generateSql(operation, mergedParams);

  // Expand array parameters for pg-promise
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return { sql, params: finalParams };
}

/**
 * Convert a SELECT plan to SQL string with parameters
 */
export function toSql<TRecord, TParams>(
  plan: SelectPlanHandle<TRecord, TParams>,
  params: TParams,
): { sql: string; params: Record<string, unknown> };

/**
 * Convert a SELECT terminal plan to SQL string with parameters
 */
export function toSql<TResult, TParams>(
  plan: SelectTerminalHandle<TResult, TParams>,
  params: TParams,
): { sql: string; params: Record<string, unknown> };

/**
 * Convert an INSERT plan to SQL string with parameters
 */
export function toSql<TRecord, TParams>(
  plan: InsertPlanHandleWithValues<TRecord, TParams>,
  params: TParams,
): { sql: string; params: Record<string, unknown> };

/**
 * Convert an INSERT plan with RETURNING to SQL string with parameters
 */
export function toSql<TResult, TParams>(
  plan: InsertPlanHandleWithReturning<TResult, TParams>,
  params: TParams,
): { sql: string; params: Record<string, unknown> };

/**
 * Convert an UPDATE plan to SQL string with parameters
 */
export function toSql<TRecord, TParams>(
  plan: UpdatePlanHandleComplete<TRecord, TParams>,
  params: TParams,
): { sql: string; params: Record<string, unknown> };

/**
 * Convert an UPDATE plan with RETURNING to SQL string with parameters
 */
export function toSql<TResult, TParams>(
  plan: UpdatePlanHandleWithReturning<TResult, TParams>,
  params: TParams,
): { sql: string; params: Record<string, unknown> };

/**
 * Convert a DELETE plan to SQL string with parameters
 */
export function toSql<TParams>(
  plan: DeletePlanHandleComplete<unknown, TParams>,
  params: TParams,
): { sql: string; params: Record<string, unknown> };

/**
 * Convert any plan to SQL string with parameters
 * Handles pg-promise specific array parameter expansion
 */
export function toSql<TParams>(
  plan:
    | SelectPlanHandle<unknown, TParams>
    | SelectTerminalHandle<unknown, TParams>
    | InsertPlanHandleWithValues<unknown, TParams>
    | InsertPlanHandleWithReturning<unknown, TParams>
    | UpdatePlanHandleComplete<unknown, TParams>
    | UpdatePlanHandleWithReturning<unknown, TParams>
    | DeletePlanHandleComplete<unknown, TParams>,
  params: TParams,
): { sql: string; params: Record<string, unknown> } {
  const { operation, params: mergedParams } = plan.finalize(params);
  const sql = generateSql(operation, mergedParams);
  const expandedParams = expandArrayParams(mergedParams);
  return { sql, params: expandedParams };
}

/**
 * Simpler API for generating SQL with auto-parameterization
 * @param queryable A Queryable or TerminalQuery object
 * @param options Parse options including cache control
 * @returns Object with text (SQL string) and parameters
 */
export function finalize<TParams = Record<string, never>>(
  plan: {
    finalize(params: TParams): {
      operation: QueryOperation;
      params: Record<string, unknown>;
    };
  },
  params?: TParams,
): {
  text: string;
  parameters: Record<string, unknown>;
} {
  const normalizedParams = params ?? ({} as TParams);
  const { operation, params: mergedParams } = plan.finalize(normalizedParams);
  const text = generateSql(operation, mergedParams);
  return { text, parameters: mergedParams };
}

/**
 * Database interface for pg-promise compatibility
 */
interface PgDatabase {
  any(sql: string, params?: unknown): Promise<unknown[]>;
  one(sql: string, params?: unknown): Promise<unknown>;
  result(sql: string, params?: unknown): Promise<{ rowCount: number }>;
}

/**
 * Execute a query with params and helpers
 */
export async function executeSelect<
  TSchema,
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams, helpers: QueryHelpers) => TQuery,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<
  TQuery extends Queryable<infer T>
    ? T[]
    : TQuery extends OrderedQueryable<infer T>
      ? T[]
      : TQuery extends TerminalQuery<infer T>
        ? T
        : never
>;

/**
 * Execute a query with params only (no helpers)
 */
export async function executeSelect<
  TSchema,
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams) => TQuery,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<
  TQuery extends Queryable<infer T>
    ? T[]
    : TQuery extends OrderedQueryable<infer T>
      ? T[]
      : TQuery extends TerminalQuery<infer T>
        ? T
        : never
>;

// Implementation
export async function executeSelect<
  TSchema,
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((queryBuilder: QueryBuilder<TSchema>, params: TParams, helpers: QueryHelpers) => TQuery)
    | ((queryBuilder: QueryBuilder<TSchema>, params: TParams) => TQuery)
    | ((queryBuilder: QueryBuilder<TSchema>) => TQuery),
  params?: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<
  TQuery extends Queryable<infer T>
    ? T[]
    : TQuery extends OrderedQueryable<infer T>
      ? T[]
      : TQuery extends TerminalQuery<infer T>
        ? T
        : never
> {
  type ReturnType =
    TQuery extends Queryable<infer T>
      ? T[]
      : TQuery extends OrderedQueryable<infer T>
        ? T[]
        : TQuery extends TerminalQuery<infer T>
          ? T
          : never;

  // Create plan using defineSelect
  // Type assertion needed due to complex overload resolution between
  // the builder's union return type and defineSelect's overloads
  let plan;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plan = defineSelect(schema, builder as any, options);
  } catch (error) {
    // Maintain backward compatibility with error messages
    if (error instanceof Error && error.message === "Failed to parse select plan") {
      throw new Error("Failed to parse query");
    }
    throw error;
  }

  // Get operation and merged params from plan
  const { operation, params: mergedParams } = plan.finalize(params || ({} as TParams));

  // Generate SQL string using existing generator
  const sql = generateSql(operation, mergedParams);

  // Expand array parameters for pg-promise
  const sqlParams = expandArrayParams(mergedParams);

  // Call onSql callback if provided
  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  // Check if this is a terminal handle
  const isTerminal = isTerminalHandle(plan);

  // For terminal operations, check the operation type
  const operationType = operation.operationType;

  // Handle different terminal operations
  if (isTerminal) {
    switch (operationType) {
      case "first":
      case "firstOrDefault":
      case "single":
      case "singleOrDefault":
      case "last":
      case "lastOrDefault": {
        // These return a single item
        const rows = await db.any(sql, sqlParams);
        if (rows.length === 0) {
          if (operationType.includes("OrDefault")) {
            return null as ReturnType;
          }
          throw new Error(`No elements found for ${operationType} operation`);
        }
        if (operationType.startsWith("single") && rows.length > 1) {
          throw new Error(`Multiple elements found for ${operationType} operation`);
        }
        return rows[0] as ReturnType;
      }

      case "count":
      case "longCount": {
        // These return a number - SQL is: SELECT COUNT(*) FROM ...
        const countResult = (await db.one(sql, sqlParams)) as { count: string };
        return parseInt(countResult.count, 10) as ReturnType;
      }

      case "sum":
      case "average":
      case "min":
      case "max": {
        // These return a single aggregate value
        const aggResult = (await db.one(sql, sqlParams)) as Record<string, unknown>;
        const keys = Object.keys(aggResult);
        if (keys.length > 0 && keys[0]) {
          return aggResult[keys[0]] as ReturnType;
        }
        return null as ReturnType;
      }

      case "any": {
        // Returns boolean
        const anyResult = (await db.one(sql, sqlParams)) as Record<string, unknown>;
        const anyKeys = Object.keys(anyResult);
        if (anyKeys.length > 0 && anyKeys[0]) {
          return (anyResult[anyKeys[0]] === 1) as ReturnType;
        }
        return false as ReturnType;
      }

      case "all": {
        // Returns boolean
        const allResult = (await db.one(sql, sqlParams)) as Record<string, unknown>;
        const allKeys = Object.keys(allResult);
        if (allKeys.length > 0 && allKeys[0]) {
          return (allResult[allKeys[0]] === 1) as ReturnType;
        }
        return false as ReturnType;
      }
    }
  }

  // Regular query that returns an array
  return (await db.any(sql, sqlParams)) as ReturnType;
}

/**
 * Execute a query with no parameters
 * @param dbClient pg-promise database instance
 * @param schema Database context with schema information
 * @param builder Function that builds the query using LINQ operations with DSL and helpers
 * @param options Optional execution options (e.g., SQL inspection callback)
 * @returns Promise with query results, properly typed based on the query
 */
export async function executeSelectSimple<
  TSchema,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  dbClient: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    _params: Record<string, never>,
    helpers: QueryHelpers,
  ) => TQuery,
  options: ExecuteOptions & ParseQueryOptions = {},
): Promise<
  TQuery extends Queryable<infer T>
    ? T[]
    : TQuery extends OrderedQueryable<infer T>
      ? T[]
      : TQuery extends TerminalQuery<infer T>
        ? T
        : never
> {
  return executeSelect(dbClient, schema, builder, {}, options);
}

// ==================== INSERT Statement & Execution ====================

/**
 * Generate INSERT SQL statement (with params)
 */
export function insertStatement<TSchema, TParams, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

/**
 * Generate INSERT SQL statement (without params)
 */
export function insertStatement<TSchema, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
): SqlResult<
  Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

// Implementation
export function insertStatement<TSchema, TParams, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
      ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>),
  params?: TParams,
  options?: ParseQueryOptions,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
> {
  let plan: ReturnType<typeof defineInsert>;
  try {
    plan = defineInsert(schema, builder, options);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Failed to parse insert builder or not an insert operation"
    ) {
      throw new Error("Failed to parse INSERT query or not an insert operation");
    }
    throw error;
  }

  const { sql, expandedParams } = materializePlan(plan, params || ({} as TParams));

  return {
    sql,
    params: expandedParams as TParams & Record<string, string | number | boolean | null>,
  };
}

/**
 * Execute INSERT with params, return row count
 */
export async function executeInsert<TSchema, TParams, TTable>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams) => Insertable<TTable>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<number>;

/**
 * Execute INSERT with params and RETURNING
 */
export async function executeInsert<TSchema, TParams, TTable, TReturning>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => InsertableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<TReturning[]>;

/**
 * Execute INSERT without params, return row count
 */
export async function executeInsert<TSchema, TTable>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Insertable<TTable>,
): Promise<number>;

/**
 * Execute INSERT without params, with RETURNING
 */
export async function executeInsert<TSchema, TTable, TReturning>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => InsertableWithReturning<TTable, TReturning>,
): Promise<TReturning[]>;

// Implementation
export async function executeInsert<TSchema, TParams, TTable, TReturning = never>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
      ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>),
  params?: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<number | TReturning[]> {
  const normalizedParams = params || ({} as TParams);

  let plan: ReturnType<typeof defineInsert>;
  try {
    plan = defineInsert(schema, builder, options);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Failed to parse insert builder or not an insert operation"
    ) {
      throw new Error("Failed to parse INSERT query or not an insert operation");
    }
    throw error;
  }

  const { operation, sql, expandedParams } = materializePlan(plan, normalizedParams);

  if (options?.onSql) {
    options.onSql({ sql, params: expandedParams });
  }

  const insertOperation = operation as InsertOperation;

  if (insertOperation.returning) {
    const rows = await db.any(sql, expandedParams);
    return rows as TReturning[];
  }

  const result = await db.result(sql, expandedParams);
  return result.rowCount;
}

// ==================== UPDATE Statement & Execution ====================

/**
 * Generate UPDATE SQL statement (with params)
 */
export function updateStatement<TSchema, TParams, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) =>
    | UpdatableWithSet<TTable>
    | UpdatableComplete<TTable>
    | UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

/**
 * Generate UPDATE SQL statement (without params)
 */
export function updateStatement<TSchema, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) =>
    | UpdatableWithSet<TTable>
    | UpdatableComplete<TTable>
    | UpdatableWithReturning<TTable, TReturning>,
): SqlResult<
  Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

// Implementation
export function updateStatement<TSchema, TParams, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) =>
        | UpdatableWithSet<TTable>
        | UpdatableComplete<TTable>
        | UpdatableWithReturning<TTable, TReturning>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
      ) =>
        | UpdatableWithSet<TTable>
        | UpdatableComplete<TTable>
        | UpdatableWithReturning<TTable, TReturning>),
  params?: TParams,
  options?: ParseQueryOptions,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
> {
  // Create plan using defineUpdate with builder function
  const plan = defineUpdate(schema, builder, options);

  // Get operation and merged params from plan
  const { operation, params: mergedParams } = plan.finalize(params || ({} as TParams));

  // Generate SQL string using existing generator
  const sql = generateSql(operation, mergedParams);

  // Expand array parameters for pg-promise
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return { sql, params: finalParams };
}

/**
 * Execute UPDATE with params, return row count
 */
export async function executeUpdate<TSchema, TParams, TTable>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<number>;

/**
 * Execute UPDATE with params and RETURNING
 */
export async function executeUpdate<TSchema, TParams, TTable, TReturning>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<TReturning[]>;

/**
 * Execute UPDATE without params, return row count
 */
export async function executeUpdate<TSchema, TTable>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
): Promise<number>;

/**
 * Execute UPDATE without params, with RETURNING
 */
export async function executeUpdate<TSchema, TTable, TReturning>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => UpdatableWithReturning<TTable, TReturning>,
): Promise<TReturning[]>;

// Implementation
export async function executeUpdate<TSchema, TParams, TTable, TReturning = never>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) =>
        | UpdatableWithSet<TTable>
        | UpdatableComplete<TTable>
        | UpdatableWithReturning<TTable, TReturning>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
      ) =>
        | UpdatableWithSet<TTable>
        | UpdatableComplete<TTable>
        | UpdatableWithReturning<TTable, TReturning>),
  params?: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<number | TReturning[]> {
  const normalizedParams = params || ({} as TParams);

  let plan: ReturnType<typeof defineUpdate>;
  try {
    plan = defineUpdate(schema, builder, options);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Failed to parse update builder or not an update operation"
    ) {
      throw new Error("Failed to parse UPDATE query or not an update operation");
    }
    throw error;
  }

  const { operation, sql, expandedParams } = materializePlan(plan, normalizedParams);

  if (options?.onSql) {
    options.onSql({ sql, params: expandedParams });
  }

  const updateOperation = operation as UpdateOperation;

  if (updateOperation.returning) {
    const rows = await db.any(sql, expandedParams);
    return rows as TReturning[];
  }

  const result = await db.result(sql, expandedParams);
  return result.rowCount;
}

// ==================== DELETE Statement & Execution ====================

/**
 * Generate DELETE SQL statement (with params)
 */
export function deleteStatement<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, void>;

/**
 * Generate DELETE SQL statement (without params)
 */
export function deleteStatement<TSchema, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>,
): SqlResult<Record<string, string | number | boolean | null>, void>;

// Implementation
export function deleteStatement<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Deletable<TResult> | DeletableComplete<TResult>)
    | ((queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>),
  params?: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, void> {
  // Create plan using defineDelete with builder function
  const plan = defineDelete(schema, builder, options);

  // Get operation and merged params from plan
  let operation, mergedParams;
  try {
    const result = plan.finalize(params || ({} as TParams));
    operation = result.operation;
    mergedParams = result.params;
  } catch (error) {
    // Maintain backward compatibility with error messages for DELETE
    if (error instanceof Error && error.message.includes("DELETE statement requires")) {
      throw new Error("DELETE requires a WHERE clause or explicit allowFullTableDelete");
    }
    throw error;
  }

  // Generate SQL string using existing generator
  const sql = generateSql(operation, mergedParams);

  // Expand array parameters for pg-promise
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return { sql, params: finalParams };
}

/**
 * Execute DELETE with params, return row count
 */
export async function executeDelete<TSchema, TParams, TResult>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<number>;

/**
 * Execute DELETE without params, return row count
 */
export async function executeDelete<TSchema, TResult>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>,
): Promise<number>;

// Implementation
export async function executeDelete<TSchema, TParams, TResult>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Deletable<TResult> | DeletableComplete<TResult>)
    | ((queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>),
  params?: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<number> {
  // Call deleteStatement with appropriate arguments based on whether params provided
  const { sql, params: sqlParams } =
    params !== undefined
      ? deleteStatement(schema, builder, params, options)
      : deleteStatement(
          schema,
          builder as (q: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>,
        );

  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  const result = await db.result(sql, sqlParams);
  return result.rowCount;
}

// Export types
export type { SqlResult, ExecuteOptions } from "./types.js";
