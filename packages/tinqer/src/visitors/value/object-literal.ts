/**
 * Visitor for object literal expressions
 * Used primarily in SELECT projections
 */

import type {
  ObjectExpression,
  Expression,
  ColumnExpression,
} from "../../expressions/expression.js";

import type {
  ObjectExpression as ASTObjectExpression,
  Identifier,
  Literal,
  StringLiteral,
} from "../../parser/ast-types.js";

import type { VisitorContext } from "../types.js";
import type {
  ObjectShapeNode,
  ColumnShapeNode,
  ReferenceShapeNode,
} from "../../query-tree/operations.js";

/**
 * Visit an object literal expression
 */
export function visitObject(
  node: ASTObjectExpression,
  context: VisitorContext,
  visitExpression: (node: unknown, ctx: VisitorContext) => Expression | null,
): ObjectExpression | null {
  const properties: Record<string, Expression> = {};

  for (const prop of node.properties) {
    // Handle spread operator
    if ("type" in prop && (prop as { type: string }).type === "SpreadElement") {
      handleSpreadElement(prop, context, properties);
      continue;
    }

    // Handle regular properties
    const key = extractPropertyKey(prop);
    if (key) {
      const value = visitExpression(prop.value, context);
      if (!value) {
        continue; // Skip null values instead of returning null for entire object
      }
      properties[key] = value;
    }
  }

  return {
    type: "object",
    properties,
  };
}

/**
 * Handle spread element in object literal
 */
function handleSpreadElement(
  prop: unknown,
  context: VisitorContext,
  properties: Record<string, Expression>,
): void {
  const spreadProp = prop as {
    type: string;
    argument: { type: string; name: string };
  };

  const spreadArg = spreadProp.argument;
  if (spreadArg.type === "Identifier") {
    const spreadName = spreadArg.name;

    // Check if spreading JOIN result with known shape
    if (context.joinResultParam === spreadName && context.currentResultShape) {
      flattenShape(context.currentResultShape, properties);
    } else {
      throw new Error(
        `Spread operator used without shape information. ` +
          `This typically occurs when spreading a parameter '${spreadName}' that isn't from a JOIN result. ` +
          `Spread is only supported for JOIN result parameters with known shapes.`,
      );
    }
  }
}

/**
 * Recursively flatten shape into properties
 */
function flattenShape(
  shape: ObjectShapeNode,
  properties: Record<string, Expression>,
  prefix: string = "",
): void {
  for (const [propName, shapeProp] of shape.properties) {
    const fullName = prefix ? `${prefix}.${propName}` : propName;

    if (shapeProp.type === "column") {
      // Direct column reference
      const colNode = shapeProp as ColumnShapeNode;
      properties[fullName] = {
        type: "column",
        name: colNode.columnName,
        table: `$spread${colNode.sourceTable}`,
      } as ColumnExpression;
    } else if (shapeProp.type === "object") {
      // Nested object - recursively flatten
      flattenShape(shapeProp as ObjectShapeNode, properties, fullName);
    } else if (shapeProp.type === "reference") {
      // Reference to entire table
      const refNode = shapeProp as ReferenceShapeNode;
      properties[fullName] = {
        type: "column",
        name: fullName,
        table: `$spread${refNode.sourceTable}`,
      } as ColumnExpression;
    }
  }
}

/**
 * Extract property key from property node
 */
function extractPropertyKey(prop: unknown): string | null {
  if (!prop) return null;

  const p = prop as { key?: unknown; value?: unknown };
  if (!p.key) return null;

  const key = p.key as { type?: string; name?: string; value?: unknown };

  if (key.type === "Identifier") {
    return (key as Identifier).name;
  }
  if (key.type === "Literal" || key.type === "StringLiteral") {
    return String((key as Literal | StringLiteral).value);
  }

  return null;
}
