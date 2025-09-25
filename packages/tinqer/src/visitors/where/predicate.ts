/**
 * WHERE predicate visitor
 * Converts AST expressions to BooleanExpression for WHERE clauses
 */

import type {
  BooleanExpression,
  ColumnExpression,
  ValueExpression,
  ParameterExpression,
} from "../../expressions/expression.js";

import type {
  Expression as ASTExpression,
  BinaryExpression,
  LogicalExpression as ASTLogicalExpression,
  UnaryExpression,
  MemberExpression,
  Identifier,
  Literal,
  CallExpression,
} from "../../parser/ast-types.js";

import type { WhereContext } from "./context.js";
import { createAutoParam } from "./context.js";
import { visitComparison } from "./comparison.js";
import { visitLogical } from "./logical.js";

/**
 * Visit a predicate expression in WHERE context
 * Returns BooleanExpression or null
 */
export function visitPredicate(
  node: ASTExpression,
  context: WhereContext,
): BooleanExpression | null {
  if (!node) return null;

  switch (node.type) {
    case "BinaryExpression": {
      const binary = node as BinaryExpression;
      // Check if it's a comparison
      if (["==", "===", "!=", "!==", ">", ">=", "<", "<="].includes(binary.operator)) {
        return visitComparison(binary, context);
      }
      return null;
    }

    case "LogicalExpression": {
      return visitLogical(node as ASTLogicalExpression, context);
    }

    case "UnaryExpression": {
      const unary = node as UnaryExpression;
      if (unary.operator === "!") {
        const inner = visitPredicate(unary.argument, context);
        if (inner) {
          return {
            type: "not",
            expression: inner,
          };
        }
      }
      return null;
    }

    case "MemberExpression": {
      // Boolean column (e.g., x.isActive)
      const column = visitColumnAccess(node as MemberExpression, context);
      if (column) {
        return {
          type: "booleanColumn",
          name: column.name,
          ...(column.table && { table: column.table }),
        };
      }
      return null;
    }

    case "CallExpression": {
      // Boolean methods like x.name.startsWith("John")
      return visitBooleanMethod(node as CallExpression, context);
    }

    case "Identifier": {
      // Direct boolean column reference
      const id = node as Identifier;
      if (context.tableParams.has(id.name)) {
        // This is a table parameter used as boolean
        return {
          type: "booleanColumn",
          name: id.name,
        };
      }
      return null;
    }

    case "Literal":
    case "BooleanLiteral": {
      // Boolean constant
      const lit = node as Literal;
      if (typeof lit.value === "boolean") {
        return {
          type: "booleanConstant",
          value: lit.value,
        };
      }
      return null;
    }

    case "ParenthesizedExpression": {
      // Unwrap parentheses
      const paren = node as { expression: ASTExpression };
      return visitPredicate(paren.expression, context);
    }

    default:
      return null;
  }
}

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

/**
 * Visit value expression (for comparison operands)
 */
export function visitValue(node: ASTExpression, context: WhereContext): ValueExpression | null {
  switch (node.type) {
    case "MemberExpression": {
      // Column reference
      const column = visitColumnAccess(node as MemberExpression, context);
      return column;
    }

    case "Literal":
    case "NumericLiteral":
    case "StringLiteral":
    case "BooleanLiteral":
    case "NullLiteral": {
      const lit = node as Literal;
      // NULL is special - not parameterized
      if (lit.value === null) {
        return {
          type: "constant",
          value: null,
          valueType: "null",
        };
      }
      // Auto-parameterize other literals
      const paramName = createAutoParam(context, lit.value);
      return {
        type: "param",
        param: paramName,
      } as ParameterExpression;
    }

    case "Identifier": {
      const id = node as Identifier;
      // Query parameter reference
      if (context.queryParams.has(id.name)) {
        return {
          type: "param",
          param: id.name,
        } as ParameterExpression;
      }
      return null;
    }

    case "UnaryExpression": {
      const unary = node as UnaryExpression;
      // Negative number
      if (
        unary.operator === "-" &&
        (unary.argument.type === "NumericLiteral" || unary.argument.type === "Literal")
      ) {
        const lit = unary.argument as Literal;
        if (typeof lit.value === "number") {
          const value = -lit.value;
          const paramName = createAutoParam(context, value);
          return {
            type: "param",
            param: paramName,
          } as ParameterExpression;
        }
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Visit boolean method calls
 */
function visitBooleanMethod(node: CallExpression, context: WhereContext): BooleanExpression | null {
  if (node.callee.type !== "MemberExpression") return null;

  const memberCallee = node.callee as MemberExpression;
  if (memberCallee.property.type !== "Identifier") return null;

  const methodName = (memberCallee.property as Identifier).name;

  // String boolean methods
  if (["startsWith", "endsWith", "includes", "contains"].includes(methodName)) {
    const obj = visitValue(memberCallee.object, context);
    if (!obj) return null;

    const args: ValueExpression[] = [];
    for (const arg of node.arguments) {
      const value = visitValue(arg as ASTExpression, context);
      if (value) args.push(value);
    }

    return {
      type: "booleanMethod",
      object: obj,
      method: methodName as "startsWith" | "endsWith" | "includes" | "contains",
      arguments: args,
    };
  }

  return null;
}
