/**
 * Types for SQL generation
 */

import type { Expression } from "@webpods/tinqer";

/**
 * Result of SQL generation
 */
export interface SqlResult<TParams> {
  sql: string;
  params: TParams;
}

/**
 * Represents a reference to a source column in the database
 */
export interface SourceReference {
  tableAlias: string; // The SQL table alias (e.g., "t0", "t1")
  columnName: string; // The actual column name in the table
  expression?: any; // For computed columns (e.g., u.price * 0.9)
}

/**
 * Symbol table that maps projected property names to their source columns
 * Handles both flat (userName) and nested (user.name) property paths
 */
export interface SymbolTable {
  entries: Map<string, SourceReference>; // propertyPath -> source
}

/**
 * SQL generation context
 */
export interface SqlContext {
  tableAliases: Map<string, string>;
  aliasCounter: number;
  formatParameter: (paramName: string) => string; // Format parameter for SQL dialect
  groupByKey?: Expression; // Store the GROUP BY key selector expression for transforming g.key references
  symbolTable?: SymbolTable; // Maps projected properties to their source columns
  currentShape?: any; // The current shape of the query result (after JOINs)
  currentAlias?: string; // Current table alias for resolving column references
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
