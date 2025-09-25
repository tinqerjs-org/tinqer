/**
 * JOIN result shape builder
 * Builds ResultShape from JOIN result selector expressions
 */

import type {
  ResultShape,
  ShapeNode,
  ColumnShapeNode,
  ObjectShapeNode,
  ReferenceShapeNode,
} from "../../query-tree/operations.js";
import type {
  Expression,
  ObjectExpression,
  ColumnExpression,
} from "../../expressions/expression.js";

/**
 * Build a ResultShape from a JOIN result selector expression
 * Preserves full nested structure for complete fidelity
 */
export function buildResultShape(
  expr: Expression | undefined,
  outerParam: string | null,
  innerParam: string | null,
): ResultShape | undefined {
  if (!expr || expr.type !== "object") {
    return undefined;
  }

  const rootNode = buildShapeNode(expr, outerParam, innerParam);
  if (rootNode && rootNode.type === "object") {
    return rootNode as ResultShape;
  }

  return undefined;
}

/**
 * Recursively build a ShapeNode from an expression
 */
export function buildShapeNode(
  expr: Expression,
  outerParam: string | null,
  innerParam: string | null,
): ShapeNode | undefined {
  switch (expr.type) {
    case "object": {
      const objExpr = expr as ObjectExpression;
      const properties = new Map<string, ShapeNode>();

      for (const [propName, propExpr] of Object.entries(objExpr.properties)) {
        const node = buildShapeNode(propExpr, outerParam, innerParam);
        if (node) {
          properties.set(propName, node);
        }
      }

      return {
        type: "object",
        properties,
      } as ObjectShapeNode;
    }

    case "param": {
      // Parameter expressions should not appear in JOIN result selectors
      // The visitor should have thrown an error before we get here
      // But if somehow we get here, we should not process it
      break;
    }

    case "column": {
      const colExpr = expr as ColumnExpression;

      // Check if this is a $param marker from JOIN context
      if (colExpr.table && colExpr.table.startsWith("$param")) {
        const paramIndex = parseInt(colExpr.table.substring(6), 10);

        // Otherwise it's a column from that table
        return {
          type: "column",
          sourceTable: paramIndex,
          columnName: colExpr.name,
        } as ColumnShapeNode;
      }
      // Check if this is a property access (e.g., u.name)
      else if (colExpr.table === outerParam && outerParam) {
        return {
          type: "column",
          sourceTable: 0,
          columnName: colExpr.name,
        } as ColumnShapeNode;
      } else if (colExpr.table === innerParam && innerParam) {
        return {
          type: "column",
          sourceTable: 1,
          columnName: colExpr.name,
        } as ColumnShapeNode;
      } else if (!colExpr.table) {
        // Direct parameter reference (e.g., { orderItem: oi })
        // Check both table and column name cases
        if (
          (colExpr.name === outerParam && outerParam) ||
          (colExpr.table === outerParam && outerParam)
        ) {
          return {
            type: "reference",
            sourceTable: 0,
          } as ReferenceShapeNode;
        } else if (
          (colExpr.name === innerParam && innerParam) ||
          (colExpr.table === innerParam && innerParam)
        ) {
          return {
            type: "reference",
            sourceTable: 1,
          } as ReferenceShapeNode;
        }
      }
      break;
    }

    // Add more cases as needed (arithmetic, concat, etc.)
  }

  return undefined;
}
