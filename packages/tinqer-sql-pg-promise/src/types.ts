/**
 * Types for SQL generation
 */

/**
 * Result of SQL generation
 */
export interface SqlResult<TParams> {
  sql: string;
  params: TParams;
}

/**
 * SQL generation context
 */
export interface SqlContext {
  tableAliases: Map<string, string>;
  aliasCounter: number;
  paramPrefix: string; // For pg-promise we use ":"
}

/**
 * SQL fragment for building queries
 */
export interface SqlFragment {
  sql: string;
  hasGroupBy?: boolean;
  hasOrderBy?: boolean;
  hasLimit?: boolean;
  hasOffset?: boolean;
}
