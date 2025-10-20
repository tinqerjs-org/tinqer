/**
 * PostgreSQL SQL generator for Tinqer using pg-promise format
 */

import {
  parseQuery,
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
  // Plan API imports for parallel implementation
  defineSelect,
  defineInsert,
  defineUpdate,
  defineDelete,
  isTerminalHandle,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let plan;
  try {
    plan = defineSelect(schema, builder as any, options);
  } catch (error) {
    // Maintain backward compatibility with error messages
    if (error instanceof Error && error.message === "Failed to parse select plan") {
      throw new Error("Failed to parse query");
    }
    throw error;
  }

  // Get operation and merged params from plan
  const { operation, params: mergedParams } = plan.toSql(params || ({} as TParams));

  // Generate SQL string using existing generator
  const sql = generateSql(operation, mergedParams);

  // Expand array parameters for pg-promise
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return { sql, params: finalParams };
}

/**
 * PARALLEL IMPLEMENTATION USING PLAN API
 * Generate INSERT SQL from a builder function using the plan API
 */
export function insertStatementWithPlan<TSchema, TParams, TTable, TReturning = never>(
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

export function insertStatementWithPlan<TSchema, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
): SqlResult<
  Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

// Implementation
export function insertStatementWithPlan<TSchema, TParams, TTable, TReturning = never>(
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
  // Parse the builder to get the table name
  // For insert, we need to extract the table from the builder
  const parseResult = parseQuery(builder, options || {});
  if (!parseResult || parseResult.operation.operationType !== "insert") {
    throw new Error("Failed to parse INSERT query or not an insert operation");
  }

  const insertOp = parseResult.operation as unknown as { table: string };
  const tableName = insertOp.table as keyof TSchema;

  // TODO: Use plan API properly once it supports builder functions
  // const plan = defineInsert(schema, tableName, options);
  // For now, use parseQuery result directly
  void defineInsert(schema, tableName, options); // Placeholder to demonstrate we'll use it

  // Apply the values and returning operations
  // Since the plan API doesn't directly take a builder, we need to extract values from parseResult
  // For now, we'll use the parseQuery approach and merge with plan
  const mergedParams = { ...parseResult.autoParams, ...(params || {}) };

  // Generate SQL string using existing generator
  const sql = generateSql(parseResult.operation, mergedParams);

  // Expand array parameters for pg-promise
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return { sql, params: finalParams };
}

/**
 * PARALLEL IMPLEMENTATION USING PLAN API
 * Generate UPDATE SQL from a builder function using the plan API
 */
export function updateStatementWithPlan<TSchema, TParams, TTable, TReturning = never>(
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

export function updateStatementWithPlan<TSchema, TTable, TReturning = never>(
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
export function updateStatementWithPlan<TSchema, TParams, TTable, TReturning = never>(
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
  // Parse the builder to get the table name
  const parseResult = parseQuery(builder, options || {});
  if (!parseResult || parseResult.operation.operationType !== "update") {
    throw new Error("Failed to parse UPDATE query or not an update operation");
  }

  const updateOp = parseResult.operation as unknown as { table: string };
  const tableName = updateOp.table as keyof TSchema;

  // TODO: Use plan API properly once it supports builder functions
  // const plan = defineUpdate(schema, tableName, options);
  // For now, use parseQuery result directly
  void defineUpdate(schema, tableName, options); // Placeholder to demonstrate we'll use it

  // For now, use the parseQuery result directly
  const mergedParams = { ...parseResult.autoParams, ...(params || {}) };

  // Generate SQL string using existing generator
  const sql = generateSql(parseResult.operation, mergedParams);

  // Expand array parameters for pg-promise
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return { sql, params: finalParams };
}

/**
 * PARALLEL IMPLEMENTATION USING PLAN API
 * Generate DELETE SQL from a builder function using the plan API
 */
export function deleteStatementWithPlan<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, void>;

export function deleteStatementWithPlan<TSchema, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>,
): SqlResult<Record<string, string | number | boolean | null>, void>;

// Implementation
export function deleteStatementWithPlan<TSchema, TParams, TResult>(
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
  // Parse the builder to get the table name
  const parseResult = parseQuery(builder, options || {});
  if (!parseResult || parseResult.operation.operationType !== "delete") {
    throw new Error("Failed to parse DELETE query or not a delete operation");
  }

  const deleteOp = parseResult.operation as unknown as { table: string };
  const tableName = deleteOp.table as keyof TSchema;

  // TODO: Use plan API properly once it supports builder functions
  // const plan = defineDelete(schema, tableName, options);
  // For now, use parseQuery result directly
  void defineDelete(schema, tableName, options); // Placeholder to demonstrate we'll use it

  // For now, use the parseQuery result directly
  const mergedParams = { ...parseResult.autoParams, ...(params || {}) };

  // Generate SQL string using existing generator
  const sql = generateSql(parseResult.operation, mergedParams);

  // Expand array parameters for pg-promise
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return { sql, params: finalParams };
}

/**
 * Simpler API for generating SQL with auto-parameterization
 * @param queryable A Queryable or TerminalQuery object
 * @param options Parse options including cache control
 * @returns Object with text (SQL string) and parameters
 */
export function toSql<T>(
  queryable: Queryable<T> | OrderedQueryable<T> | TerminalQuery<T>,
  options: ParseQueryOptions = {},
): {
  text: string;
  parameters: Record<string, unknown>;
} {
  // Create a dummy function that returns the queryable
  const queryBuilder = () => queryable;

  // Parse and generate SQL
  const parseResult = parseQuery(queryBuilder, options);

  if (!parseResult) {
    throw new Error("Failed to parse query");
  }

  // Generate SQL with auto-parameters
  const sql = generateSql(parseResult.operation, parseResult.autoParams);

  return {
    text: sql,
    parameters: parseResult.autoParams,
  };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let plan;
  try {
    plan = defineSelect(schema, builder as any, options);
  } catch (error) {
    // Maintain backward compatibility with error messages
    if (error instanceof Error && error.message === "Failed to parse select plan") {
      throw new Error("Failed to parse query");
    }
    throw error;
  }

  // Get operation and merged params from plan
  const { operation, params: mergedParams } = plan.toSql(params || ({} as TParams));

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
  // Create plan using defineInsert with builder function
  const plan = defineInsert(schema, builder, options);

  // Get operation and merged params from plan
  const { operation, params: mergedParams } = plan.toSql(params || ({} as TParams));

  // Generate SQL string using existing generator
  const sql = generateSql(operation, mergedParams);

  // Expand array parameters for pg-promise
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return { sql, params: finalParams };
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
  // Call insertStatement with appropriate arguments based on whether params provided
  const { sql, params: sqlParams } =
    params !== undefined
      ? insertStatement(schema, builder, params, options)
      : insertStatement(
          schema,
          builder as (
            q: QueryBuilder<TSchema>,
          ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
        );

  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  const parseResult = parseQuery(builder, options || {});
  if (!parseResult) {
    throw new Error("Failed to parse INSERT query");
  }

  // Check if RETURNING clause is present
  const hasReturning =
    parseResult.operation.operationType === "insert" &&
    (parseResult.operation as { returning?: unknown }).returning;

  if (hasReturning) {
    return (await db.any(sql, sqlParams)) as TReturning[];
  } else {
    const result = await db.result(sql, sqlParams);
    return result.rowCount;
  }
}

/**
 * PARALLEL IMPLEMENTATION USING PLAN API
 * Execute INSERT with plan API
 */
export async function executeInsertWithPlan<TSchema, TParams, TTable>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams) => Insertable<TTable>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<number>;

export async function executeInsertWithPlan<TSchema, TParams, TTable, TReturning>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => InsertableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<TReturning[]>;

export async function executeInsertWithPlan<TSchema, TTable>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Insertable<TTable>,
): Promise<number>;

export async function executeInsertWithPlan<TSchema, TTable, TReturning>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => InsertableWithReturning<TTable, TReturning>,
): Promise<TReturning[]>;

// Implementation
export async function executeInsertWithPlan<TSchema, TParams, TTable, TReturning = never>(
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
  // Parse the builder to get the insert operation
  const parseResult = parseQuery(builder, options || {});
  if (!parseResult || parseResult.operation.operationType !== "insert") {
    throw new Error("Failed to parse INSERT query or not an insert operation");
  }

  const insertOp = parseResult.operation as unknown as { table: string; returning?: unknown };
  const tableName = insertOp.table as keyof TSchema;

  // TODO: Use plan API properly once it supports builder functions
  // const plan = defineInsert(schema, tableName, options);
  // For now, use parseQuery result directly
  void defineInsert(schema, tableName, options); // Placeholder to demonstrate we'll use it

  // Merge params
  const mergedParams = { ...parseResult.autoParams, ...(params || {}) };

  // Generate SQL string using existing generator
  const sql = generateSql(parseResult.operation, mergedParams);

  // Expand array parameters for pg-promise
  const sqlParams = expandArrayParams(mergedParams);

  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  // Check if RETURNING clause is present
  const hasReturning = !!insertOp.returning;

  if (hasReturning) {
    return (await db.any(sql, sqlParams)) as TReturning[];
  } else {
    const result = await db.result(sql, sqlParams);
    return result.rowCount;
  }
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
  const { operation, params: mergedParams } = plan.toSql(params || ({} as TParams));

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
  // Call updateStatement with appropriate arguments based on whether params provided
  const { sql, params: sqlParams } =
    params !== undefined
      ? updateStatement(schema, builder, params, options)
      : updateStatement(
          schema,
          builder as (
            q: QueryBuilder<TSchema>,
          ) =>
            | UpdatableWithSet<TTable>
            | UpdatableComplete<TTable>
            | UpdatableWithReturning<TTable, TReturning>,
        );

  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  const parseResult = parseQuery(builder, options || {});
  if (!parseResult) {
    throw new Error("Failed to parse UPDATE query");
  }

  // Check if RETURNING clause is present
  const hasReturning =
    parseResult.operation.operationType === "update" &&
    (parseResult.operation as { returning?: unknown }).returning;

  if (hasReturning) {
    return (await db.any(sql, sqlParams)) as TReturning[];
  } else {
    const result = await db.result(sql, sqlParams);
    return result.rowCount;
  }
}

/**
 * PARALLEL IMPLEMENTATION USING PLAN API
 * Execute UPDATE with plan API
 */
export async function executeUpdateWithPlan<TSchema, TParams, TTable>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<number>;

export async function executeUpdateWithPlan<TSchema, TParams, TTable, TReturning>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<TReturning[]>;

export async function executeUpdateWithPlan<TSchema, TTable>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
): Promise<number>;

export async function executeUpdateWithPlan<TSchema, TTable, TReturning>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => UpdatableWithReturning<TTable, TReturning>,
): Promise<TReturning[]>;

// Implementation
export async function executeUpdateWithPlan<TSchema, TParams, TTable, TReturning = never>(
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
  // Parse the builder to get the update operation
  const parseResult = parseQuery(builder, options || {});
  if (!parseResult || parseResult.operation.operationType !== "update") {
    throw new Error("Failed to parse UPDATE query or not an update operation");
  }

  const updateOp = parseResult.operation as unknown as { table: string; returning?: unknown };
  const tableName = updateOp.table as keyof TSchema;

  // TODO: Use plan API properly once it supports builder functions
  // const plan = defineUpdate(schema, tableName, options);
  // For now, use parseQuery result directly
  void defineUpdate(schema, tableName, options); // Placeholder to demonstrate we'll use it

  // Merge params
  const mergedParams = { ...parseResult.autoParams, ...(params || {}) };

  // Generate SQL string using existing generator
  const sql = generateSql(parseResult.operation, mergedParams);

  // Expand array parameters for pg-promise
  const sqlParams = expandArrayParams(mergedParams);

  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  // Check if RETURNING clause is present
  const hasReturning = !!updateOp.returning;

  if (hasReturning) {
    return (await db.any(sql, sqlParams)) as TReturning[];
  } else {
    const result = await db.result(sql, sqlParams);
    return result.rowCount;
  }
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
    const result = plan.toSql(params || ({} as TParams));
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

/**
 * PARALLEL IMPLEMENTATION USING PLAN API
 * Execute DELETE with plan API
 */
export async function executeDeleteWithPlan<TSchema, TParams, TResult>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): Promise<number>;

export async function executeDeleteWithPlan<TSchema, TResult>(
  db: PgDatabase,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>,
): Promise<number>;

// Implementation
export async function executeDeleteWithPlan<TSchema, TParams, TResult>(
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
  // Parse the builder to get the delete operation
  const parseResult = parseQuery(builder, options || {});
  if (!parseResult || parseResult.operation.operationType !== "delete") {
    throw new Error("Failed to parse DELETE query or not a delete operation");
  }

  const deleteOp = parseResult.operation as unknown as { table: string };
  const tableName = deleteOp.table as keyof TSchema;

  // TODO: Use plan API properly once it supports builder functions
  // const plan = defineDelete(schema, tableName, options);
  // For now, use parseQuery result directly
  void defineDelete(schema, tableName, options); // Placeholder to demonstrate we'll use it

  // Merge params
  const mergedParams = { ...parseResult.autoParams, ...(params || {}) };

  // Generate SQL string using existing generator
  const sql = generateSql(parseResult.operation, mergedParams);

  // Expand array parameters for pg-promise
  const sqlParams = expandArrayParams(mergedParams);

  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  const result = await db.result(sql, sqlParams);
  return result.rowCount;
}

// Export types
export type { SqlResult, ExecuteOptions } from "./types.js";
