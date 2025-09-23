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
  formatParameter: (paramName: string) => string; // Format parameter for SQL dialect
  groupByKey?: any; // Store the GROUP BY key selector for transforming g.key references
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
