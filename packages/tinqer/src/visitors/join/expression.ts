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
                  table: `$param${shapeProp.sourceTable}`, // Use the original source table
                },
                autoParams,
                counter: currentCounter,
              };
            } else if (shapeProp.type === "reference") {
              // It's a table reference - return it as a reference
              return {
                value: {
                  type: "reference",
                  table: `$param${shapeProp.sourceTable}`,
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
              table: `$param${tableIndex}`, // Mark with table index
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
        const convertShapeToExpression = (shape: any): Expression => {
          if (shape.type === "reference") {
            return {
              type: "reference",
              table: `$param${shape.sourceTable}`,
            };
          } else if (shape.type === "column") {
            return {
              type: "column",
              name: shape.columnName,
              table: `$param${shape.sourceTable}`,
            };
          } else if (shape.type === "object") {
            const objExpr: Expression = {
              type: "object",
              properties: {},
            };
            for (const [key, node] of shape.properties) {
              objExpr.properties[key] = convertShapeToExpression(node);
            }
            return objExpr;
          }
          // Default fallback
          return { type: "constant", value: null, valueType: "null" };
        };

        const shapeAsObject = convertShapeToExpression(context.currentResultShape);

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
            table: `$param${tableIndex}`,
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
