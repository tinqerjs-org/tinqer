/**
 * Better SQLite3 SQL generator for Tinqer
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

function normalizeSqliteParams(params: Record<string, unknown>): Record<string, unknown> {
  const converted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "boolean") {
      converted[key] = value ? 1 : 0;
    } else if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      const hours = String(value.getHours()).padStart(2, "0");
      const minutes = String(value.getMinutes()).padStart(2, "0");
      const seconds = String(value.getSeconds()).padStart(2, "0");
      converted[key] = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } else {
      converted[key] = value;
    }
  }

  return converted;
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
  let plan;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plan = defineSelect(schema, builder as any, options);
  } catch (error) {
    if (error instanceof Error && error.message === "Failed to parse select plan") {
      throw new Error("Failed to parse query");
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
 * Simpler API for generating SQL with auto-parameterization
 * @param queryable A Queryable or TerminalQuery object
 * @param options Parse options including cache control
 * @returns Object with text (SQL string), parameters, and preserved result type
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
 * Database interface for Better SQLite3 compatibility
 */
interface BetterSqlite3Database {
  prepare(sql: string): {
    all(params?: Record<string, unknown>): unknown[];
    get(params?: Record<string, unknown>): unknown;
    run(params?: Record<string, unknown>): { changes: number };
  };
}

/**
 * Execute a query with params and helpers
 */
export function executeSelect<
  TSchema,
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams, helpers: QueryHelpers) => TQuery,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never;

/**
 * Execute a query with params only (no helpers)
 */
export function executeSelect<
  TSchema,
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams) => TQuery,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never;

/**
 * Execute a query with query builder only (no params, no helpers)
 */
export function executeSelect<
  TSchema,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => TQuery,
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never;

// Implementation
export function executeSelect<
  TSchema,
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((queryBuilder: QueryBuilder<TSchema>, params: TParams, helpers: QueryHelpers) => TQuery)
    | ((queryBuilder: QueryBuilder<TSchema>, params: TParams) => TQuery)
    | ((queryBuilder: QueryBuilder<TSchema>) => TQuery),
  params?: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never {
  type ReturnType =
    TQuery extends Queryable<infer T>
      ? T[]
      : TQuery extends OrderedQueryable<infer T>
        ? T[]
        : TQuery extends TerminalQuery<infer T>
          ? T
          : never;

  let plan;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plan = defineSelect(schema, builder as any, options);
  } catch (error) {
    if (error instanceof Error && error.message === "Failed to parse select plan") {
      throw new Error("Failed to parse query");
    }
    throw error;
  }

  const normalizedParams = params || ({} as TParams);
  const { operation, sql, expandedParams } = materializePlan(plan, normalizedParams);

  const displayParams = expandedParams;
  if (options?.onSql) {
    options.onSql({ sql, params: displayParams });
  }

  const boundParams = normalizeSqliteParams(expandedParams);
  const stmt = db.prepare(sql);

  if (!isTerminalHandle(plan)) {
    return stmt.all(boundParams) as ReturnType;
  }

  const operationType = operation.operationType;

  switch (operationType) {
    case "first":
    case "firstOrDefault":
    case "single":
    case "singleOrDefault":
    case "last":
    case "lastOrDefault": {
      const rows = stmt.all(boundParams);
      if (rows.length === 0) {
        if (operationType.includes("OrDefault")) {
          return null as ReturnType;
        }
        throw new Error(`No elements found for ${operationType} operation`);
      }
      if (operationType.startsWith("single") && rows.length > 1) {
        throw new Error(`Multiple elements found for ${operationType} operation`);
      }
      if (operationType.startsWith("last")) {
        return rows[rows.length - 1] as ReturnType;
      }
      return rows[0] as ReturnType;
    }

    case "count":
    case "longCount": {
      const countRow = stmt.get(boundParams) as Record<string, unknown> | undefined;
      const value = countRow ? Number(extractFirstColumn(countRow)) : 0;
      return Number.isNaN(value) ? (0 as ReturnType) : (value as ReturnType);
    }

    case "sum":
    case "average":
    case "min":
    case "max": {
      const aggRow = stmt.get(boundParams) as Record<string, unknown> | undefined;
      return (aggRow ? (extractFirstColumn(aggRow) ?? null) : null) as ReturnType;
    }

    case "any":
    case "all": {
      const boolRow = stmt.get(boundParams) as Record<string, unknown> | undefined;
      return toBoolean(boolRow ? extractFirstColumn(boolRow) : undefined) as ReturnType;
    }

    default:
      return stmt.all(boundParams) as ReturnType;
  }
}

/**
 * Execute a query with no parameters
 * @param dbClient Better SQLite3 database instance
 * @param schema Database context with schema information
 * @param builder Function that builds the query using LINQ operations with DSL and helpers
 * @param options Optional execution options (e.g., SQL inspection callback)
 * @returns Query results, properly typed based on the query
 */
export function executeSelectSimple<
  TSchema,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  dbClient: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    _params: Record<string, never>,
    helpers: QueryHelpers,
  ) => TQuery,
  options: ExecuteOptions & ParseQueryOptions = {},
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never {
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
  let plan;
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
export function executeInsert<TSchema, TParams, TTable>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams) => Insertable<TTable>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): number;

/**
 * Execute INSERT with params and RETURNING (not supported by SQLite)
 */
export function executeInsert<TSchema, TParams, TTable, TReturning>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => InsertableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): never;

/**
 * Execute INSERT without params, return row count
 */
export function executeInsert<TSchema, TTable>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Insertable<TTable>,
): number;

/**
 * Execute INSERT without params, with RETURNING (not supported by SQLite)
 */
export function executeInsert<TSchema, TTable, TReturning>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => InsertableWithReturning<TTable, TReturning>,
): never;

// Implementation
export function executeInsert<TSchema, TParams, TTable, TReturning = never>(
  db: BetterSqlite3Database,
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
): number {
  const normalizedParams = params || ({} as TParams);

  let plan;
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
    throw new Error("SQLite adapter does not support INSERT ... RETURNING clauses");
  }

  const stmt = db.prepare(sql);
  const result = stmt.run(normalizeSqliteParams(expandedParams));
  return result.changes;
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
  let plan;
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

  const { sql, expandedParams } = materializePlan(plan, params || ({} as TParams));

  return {
    sql,
    params: expandedParams as TParams & Record<string, string | number | boolean | null>,
  };
}

/**
 * Execute UPDATE with params, return row count
 */
export function executeUpdate<TSchema, TParams, TTable>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): number;

/**
 * Execute UPDATE with params and RETURNING (not supported by SQLite)
 */
export function executeUpdate<TSchema, TParams, TTable, TReturning>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): never;

/**
 * Execute UPDATE without params, return row count
 */
export function executeUpdate<TSchema, TTable>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
): number;

/**
 * Execute UPDATE without params, with RETURNING (not supported by SQLite)
 */
export function executeUpdate<TSchema, TTable, TReturning>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => UpdatableWithReturning<TTable, TReturning>,
): never;

// Implementation
export function executeUpdate<TSchema, TParams, TTable, TReturning = never>(
  db: BetterSqlite3Database,
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
): number {
  const normalizedParams = params || ({} as TParams);

  let plan;
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
    throw new Error("SQLite adapter does not support UPDATE ... RETURNING clauses");
  }

  const stmt = db.prepare(sql);
  const result = stmt.run(normalizeSqliteParams(expandedParams));
  return result.changes;
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
  let plan;
  try {
    plan = defineDelete(schema, builder, options);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Failed to parse delete builder or not a delete operation"
    ) {
      throw new Error("Failed to parse DELETE query or not a delete operation");
    }
    throw error;
  }

  let planResult;
  try {
    planResult = plan.finalize(params || ({} as TParams));
  } catch (error) {
    if (error instanceof Error && error.message.includes("DELETE statement requires")) {
      throw new Error("DELETE requires a WHERE clause or explicit allowFullTableDelete");
    }
    throw error;
  }

  const sql = generateSql(planResult.operation, planResult.params);
  const expandedParams = expandArrayParams(planResult.params) as TParams &
    Record<string, string | number | boolean | null>;

  return { sql, params: expandedParams };
}

/**
 * Execute DELETE with params, return row count
 */
export function executeDelete<TSchema, TParams, TResult>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): number;

/**
 * Execute DELETE without params, return row count
 */
export function executeDelete<TSchema, TResult>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>,
): number;

// Implementation
export function executeDelete<TSchema, TParams, TResult>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Deletable<TResult> | DeletableComplete<TResult>)
    | ((queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>),
  params?: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): number {
  const normalizedParams = params || ({} as TParams);

  let plan;
  try {
    plan = defineDelete(schema, builder, options);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Failed to parse delete builder or not a delete operation"
    ) {
      throw new Error("Failed to parse DELETE query or not a delete operation");
    }
    throw error;
  }

  let planResult;
  try {
    planResult = plan.finalize(normalizedParams);
  } catch (error) {
    if (error instanceof Error && error.message.includes("DELETE statement requires")) {
      throw new Error("DELETE requires a WHERE clause or explicit allowFullTableDelete");
    }
    throw error;
  }

  const sql = generateSql(planResult.operation, planResult.params);
  const expandedParams = expandArrayParams(planResult.params);

  if (options?.onSql) {
    options.onSql({ sql, params: expandedParams });
  }

  const stmt = db.prepare(sql);
  const result = stmt.run(normalizeSqliteParams(expandedParams));
  return result.changes;
}

// Export types
export type { SqlResult, ExecuteOptions } from "./types.js";

function extractFirstColumn(row: Record<string, unknown> | undefined): unknown {
  if (!row) {
    return undefined;
  }
  const keys = Object.keys(row);
  if (keys.length === 0 || !keys[0]) {
    return undefined;
  }
  return row[keys[0]];
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    if (value === "0") {
      return false;
    }
    if (value === "1") {
      return true;
    }
    return value.length > 0;
  }
  return Boolean(value);
}
