/**
 * Column access visitor for WHERE clauses
 */

import type { ColumnExpression } from "../../expressions/expression.js";
import type { MemberExpression, Identifier } from "../../parser/ast-types.js";
import type { WhereContext } from "./context.js";

/**
 * Visit column access (e.g., x.name, x.address.city)
 */
export function visitColumnAccess(
  node: MemberExpression,
  context: WhereContext,
): ColumnExpression | null {
  if (!node.computed && node.property.type === "Identifier") {
    const propertyName = (node.property as Identifier).name;

    // Simple member access: x.name
    if (node.object.type === "Identifier") {
      const objectName = (node.object as Identifier).name;

      if (context.tableParams.has(objectName)) {
        return {
          type: "column",
          name: propertyName,
        };
      }
    }

    // Nested member access: x.address.city
    if (node.object.type === "MemberExpression") {
      const innerColumn = visitColumnAccess(node.object as MemberExpression, context);
      if (innerColumn) {
        return {
          type: "column",
          name: `${innerColumn.name}.${propertyName}`,
        };
      }
    }
  }

  return null;
}
