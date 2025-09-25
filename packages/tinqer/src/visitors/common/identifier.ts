/**
 * Visitor for identifiers
 * Handles table parameters, query parameters, and unknown identifiers
 */

import type {
  Expression,
  ColumnExpression,
  ParameterExpression,
} from "../../expressions/expression.js";

import type { Identifier } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";

/**
 * Convert an identifier to an expression
 * Determines if it's a table param, query param, or error
 */
export function visitIdentifier(
  node: Identifier,
  context: VisitorContext
): Expression | null {
  const name = node.name;

  // Check if it's a table parameter (e.g., 'x' in x => x.name)
  if (context.tableParams.has(name)) {
    // In JOIN result selector context, treat as column reference with table mapping
    if (context.joinParams && context.joinParams.has(name)) {
      const tableIndex = context.joinParams.get(name);
      return {
        type: "column",
        name,
        table: `$param${tableIndex}`,
      } as ColumnExpression;
    }

    // Direct reference to table parameter (represents entire row)
    return {
      type: "column",
      name,
    } as ColumnExpression;
  }

  // Check if it's a query parameter (e.g., 'p' in (p) => p.minAge)
  if (context.queryParams.has(name)) {
    return {
      type: "param",
      param: name,
    } as ParameterExpression;
  }

  // Unknown identifier - this is an error
  throw new Error(
    `Unknown identifier '${name}'. Variables must be passed via params object or referenced as table parameters.`
  );
}