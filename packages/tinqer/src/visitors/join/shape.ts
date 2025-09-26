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

  // The root node should be an object shape
  if (rootNode && rootNode.type === "object") {
    return rootNode as ResultShape;
  }

  // If we got here but expr was an object, create an empty shape
  // This is a fallback for when we can't fully process the shape
  if (expr.type === "object") {
    return {
      type: "object",
      properties: new Map(),
    } as ResultShape;
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

      const result = {
        type: "object",
        properties,
      } as ObjectShapeNode;
      return result;
    }

    case "param": {
      // Parameter expressions should not appear in JOIN result selectors
      // The visitor should have thrown an error before we get here
      // But if somehow we get here, we should not process it
      break;
    }

    case "reference": {
      // Handle table references (e.g., { u, d } in JOIN result selector)
      const refExpr = expr as { type: "reference"; table: string };

      // Check if this is a $param marker from JOIN context
      if (refExpr.table && refExpr.table.startsWith("$param")) {
        const paramIndex = parseInt(refExpr.table.substring(6), 10);
        return {
          type: "reference",
          sourceTable: paramIndex,
        } as ReferenceShapeNode;
      }

      // Fallback: Check parameter names
      if (outerParam && refExpr.table === outerParam) {
        return {
          type: "reference",
          sourceTable: 0,
        } as ReferenceShapeNode;
      }

      if (innerParam && refExpr.table === innerParam) {
        return {
          type: "reference",
          sourceTable: 1,
        } as ReferenceShapeNode;
      }

      return undefined;
    }

    case "column": {
      const colExpr = expr as ColumnExpression;

      // Check if this is a $param marker from JOIN context
      // This is the primary way we identify source tables in JOIN result selectors
      if (colExpr.table && colExpr.table.startsWith("$param")) {
        const paramIndex = parseInt(colExpr.table.substring(6), 10);

        // It's a column from that table
        return {
          type: "column",
          sourceTable: paramIndex,
          columnName: colExpr.name,
        } as ColumnShapeNode;
      }

      // Fallback: Check if this is a property access using parameter names (e.g., u.name)
      // This is a secondary check for cases where parameter names are provided
      if (outerParam && colExpr.table === outerParam) {
        return {
          type: "column",
          sourceTable: 0,
          columnName: colExpr.name,
        } as ColumnShapeNode;
      }

      if (innerParam && colExpr.table === innerParam) {
        return {
          type: "column",
          sourceTable: 1,
          columnName: colExpr.name,
        } as ColumnShapeNode;
      }

      // Direct parameter reference without table qualifier (e.g., { orderItem: oi })
      if (!colExpr.table) {
        if (outerParam && colExpr.name === outerParam) {
          return {
            type: "reference",
            sourceTable: 0,
          } as ReferenceShapeNode;
        }

        if (innerParam && colExpr.name === innerParam) {
          return {
            type: "reference",
            sourceTable: 1,
          } as ReferenceShapeNode;
        }
      }

      return undefined;
    }

    // Add more cases as needed (arithmetic, concat, etc.)
  }

  return undefined;
}
