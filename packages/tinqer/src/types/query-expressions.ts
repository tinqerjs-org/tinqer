/**
 * Query Expression Types
 * Represents the complete structure of a SELECT query
 */

import type { Expression } from "./expressions.js";

/**
 * Main query expression - represents a complete SELECT query
 */
export interface QueryExpression {
  type: "query";
  operation: "SELECT"; // Only SELECT supported
  from: SourceExpression;
  select?: Expression;
  where?: Expression;
  groupBy?: Expression;
  having?: Expression;
  orderBy?: OrderExpression[];
  joins?: JoinExpression[];
  limit?: Expression;
  offset?: Expression;
  distinct?: boolean;

  // Set operations (future)
  union?: QueryExpression;
  intersect?: QueryExpression;
  except?: QueryExpression;

  // CTEs (future)
  with?: CteExpression[];
}

/**
 * Source expression for FROM clause
 */
export interface SourceExpression {
  type: "source";
  source: TableExpression | QueryExpression | ValuesExpression;
  alias?: string;
}

/**
 * Table reference
 */
export interface TableExpression {
  type: "table";
  name: string;
  schema?: string;
}

/**
 * VALUES clause for inline data (future)
 */
export interface ValuesExpression {
  type: "values";
  rows: Expression[];
}

/**
 * JOIN expression - generic structure that can handle any condition
 */
export interface JoinExpression {
  type: "join";
  kind: "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS";
  table: string;
  on?: Expression; // Generic expression - can represent ANY condition
}

/**
 * ORDER BY expression with direction
 */
export interface OrderExpression {
  type: "order";
  expression: Expression;
  direction: "ASC" | "DESC";
}

/**
 * CTE (Common Table Expression) for WITH clause (future)
 */
export interface CteExpression {
  type: "cte";
  name: string;
  query: QueryExpression;
  columns?: string[];
}
