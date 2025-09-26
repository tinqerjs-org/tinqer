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
  node: MemberExpression | { type: string; expression?: MemberExpression },
  context: WhereContext,
): ColumnExpression | null {
  // Handle optional chaining
  if (node.type === "ChainExpression") {
    if (node.expression && node.expression.type === "MemberExpression") {
      return visitColumnAccess(node.expression, context);
    }
    return null;
  }

  // After handling ChainExpression, node is definitely MemberExpression
  const memberNode = node as MemberExpression;

  if (!memberNode.computed && memberNode.property.type === "Identifier") {
    const propertyName = (memberNode.property as Identifier).name;

    // Simple member access: x.name
    if (memberNode.object.type === "Identifier") {
      const objectName = (memberNode.object as Identifier).name;

      // Check if this is accessing a JOIN result property
      if (context.joinResultParam === objectName && context.currentResultShape) {
        const resultShape = context.currentResultShape as {
          properties: Map<string, { type: string; columnName?: string; sourceTable?: number }>;
        };
        const shapeProp = resultShape.properties.get(propertyName);
        if (shapeProp) {
          if (shapeProp.type === "column") {
            // Direct column from JOIN result
            return {
              type: "column",
              name: shapeProp.columnName || propertyName,
              source: { type: "joinResult", tableIndex: shapeProp.sourceTable || 0 },
            };
          }
        }
      }

      if (context.tableParams.has(objectName)) {
        return {
          type: "column",
          name: propertyName,
        };
      }
    }

    // Nested member access: x.address.city
    if (memberNode.object.type === "MemberExpression") {
      const innerColumn = visitColumnAccess(memberNode.object as MemberExpression, context);
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
