/**
 * JOIN expression visitor
 * Handles expressions within JOIN context with parameter tracking
 */

import type { Expression } from "../../expressions/expression.js";
import type {
  Expression as ASTExpression,
  MemberExpression,
  Literal,
} from "../../parser/ast-types.js";
import type { JoinContext } from "./context.js";
import type {
  ShapeNode,
  ReferenceShapeNode,
  ColumnShapeNode,
  ObjectShapeNode,
} from "../../query-tree/operations.js";

/**
 * Visit expressions in JOIN context with parameter tracking
 */
export function visitJoinExpression(
  node: ASTExpression,
  context: JoinContext,
  startCounter: number,
): { value: Expression | null; autoParams: Record<string, unknown>; counter: number } {
  let currentCounter = startCounter;
  const autoParams: Record<string, unknown> = {};

  switch (node.type) {
    case "MemberExpression": {
      const member = node as MemberExpression;

      if (member.object.type === "Identifier" && member.property.type === "Identifier") {
        const objName = member.object.name;
        const propName = member.property.name;

        // Check if this is accessing a property from a previous JOIN's result
        if (context.joinResultParam === objName && context.currentResultShape) {
          // Look up the property in the result shape
          const resultShape = context.currentResultShape as {
            properties: Map<string, { type: string; columnName?: string; sourceTable?: number }>;
          };
          const shapeProp = resultShape.properties.get(propName);

          if (shapeProp) {
            if (shapeProp.type === "column") {
              // Return the actual column reference from the result shape
              return {
                value: {
                  type: "column",
                  name: shapeProp.columnName || propName,
                  source: { type: "joinParam", paramIndex: shapeProp.sourceTable || 0 },
                },
                autoParams,
                counter: currentCounter,
              };
            } else if (shapeProp.type === "reference") {
              // It's a table reference - return it as a reference
              return {
                value: {
                  type: "reference",
                  source: { type: "joinParam", paramIndex: shapeProp.sourceTable || 0 },
                },
                autoParams,
                counter: currentCounter,
              };
            }
          }
        }

        // Check if this is a JOIN parameter
        if (context.joinParams?.has(objName)) {
          const tableIndex = context.joinParams.get(objName);
          return {
            value: {
              type: "column",
              name: propName,
              source: { type: "joinParam", paramIndex: tableIndex || 0 },
            },
            autoParams,
            counter: currentCounter,
          };
        }

        // Regular table parameter
        if (context.tableParams.has(objName)) {
          return {
            value: {
              type: "column",
              name: propName,
              table: objName,
            },
            autoParams,
            counter: currentCounter,
          };
        }
      }
      break;
    }

    case "Identifier": {
      const ident = node as { name: string };
      const identName = ident.name;

      // FIRST check if this is the previous JOIN result parameter
      if (identName === context.joinResultParam && context.currentResultShape) {
        // This is the entire result from the previous JOIN
        // We need to preserve its structure
        // Convert the shape to an object expression that preserves the structure
        const convertShapeToExpression = (shape: ShapeNode): Expression => {
          if (shape.type === "reference") {
            const refShape = shape as ReferenceShapeNode;
            return {
              type: "reference",
              source: { type: "joinParam", paramIndex: refShape.sourceTable || 0 },
            };
          } else if (shape.type === "column") {
            const colShape = shape as ColumnShapeNode;
            return {
              type: "column",
              name: colShape.columnName,
              source: { type: "joinParam", paramIndex: colShape.sourceTable || 0 },
            };
          } else if (shape.type === "object") {
            const objShape = shape as ObjectShapeNode;
            const objExpr: Expression = {
              type: "object",
              properties: {},
            };
            for (const [key, node] of objShape.properties) {
              objExpr.properties[key] = convertShapeToExpression(node);
            }
            return objExpr;
          }
          // Default fallback for array or unknown types
          return { type: "constant", value: null, valueType: "null" };
        };

        // Convert the ResultShape to an object expression
        const resultShape: Expression = {
          type: "object",
          properties: {},
        };
        for (const [key, node] of context.currentResultShape.properties) {
          resultShape.properties[key] = convertShapeToExpression(node);
        }
        const shapeAsObject = resultShape;

        return {
          value: shapeAsObject,
          autoParams,
          counter: currentCounter,
        };
      }

      // Otherwise check if this is a JOIN parameter (u or d in the result selector)
      if (context.joinParams?.has(identName)) {
        // Return a reference to the entire table
        const tableIndex = context.joinParams.get(identName);
        return {
          value: {
            type: "reference",
            source: { type: "joinParam", paramIndex: tableIndex || 0 },
          },
          autoParams,
          counter: currentCounter,
        };
      }
      break;
    }

    case "Literal": {
      const lit = node as Literal;
      currentCounter++;
      const paramName = `__p${currentCounter}`;
      autoParams[paramName] = lit.value;

      return {
        value: {
          type: "param",
          param: paramName,
        },
        autoParams,
        counter: currentCounter,
      };
    }

    // Add more cases as needed
  }

  return { value: null, autoParams, counter: currentCounter };
}
