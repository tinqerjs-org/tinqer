/**
 * SELECT projection visitor
 * Converts AST expressions to projection expressions (columns, objects, values)
 */

import type {
  Expression,
  ObjectExpression,
  ValueExpression,
  ColumnExpression,
  ParameterExpression,
  ArithmeticExpression,
  ConcatExpression,
} from "../../expressions/expression.js";

import type {
  Expression as ASTExpression,
  ObjectExpression as ASTObjectExpression,
  MemberExpression,
  Identifier,
  Literal,
  BinaryExpression,
  CallExpression,
  UnaryExpression,
} from "../../parser/ast-types.js";

import type { SelectContext } from "./context.js";
import { createAutoParam } from "./context.js";

/**
 * Visit a projection expression in SELECT context
 * Returns Expression (ValueExpression or ObjectExpression)
 */
export function visitProjection(
  node: ASTExpression,
  context: SelectContext
): Expression | null {
  if (!node) return null;

  switch (node.type) {
    case "ObjectExpression": {
      // Object projection: { id: x.id, name: x.name }
      return visitObjectProjection(node as ASTObjectExpression, context);
    }

    case "MemberExpression": {
      // Column projection: x.name
      return visitColumnProjection(node as MemberExpression, context);
    }

    case "Identifier": {
      // Direct identifier (could be table param or query param)
      return visitIdentifierProjection(node as Identifier, context);
    }

    case "Literal":
    case "NumericLiteral":
    case "StringLiteral":
    case "BooleanLiteral":
    case "NullLiteral": {
      // Literal value projection
      return visitLiteralProjection(node as Literal, context);
    }

    case "BinaryExpression": {
      // Arithmetic or concatenation
      return visitBinaryProjection(node as BinaryExpression, context);
    }

    case "CallExpression": {
      // Method calls (string methods, etc.)
      return visitMethodProjection(node as CallExpression, context);
    }

    case "UnaryExpression": {
      // Unary operations (negation, etc.)
      return visitUnaryProjection(node as UnaryExpression, context);
    }

    case "ConditionalExpression": {
      // Ternary operator (CASE WHEN)
      return visitConditionalProjection(node, context);
    }

    case "ParenthesizedExpression": {
      // Unwrap parentheses
      const paren = node as { expression: ASTExpression };
      return visitProjection(paren.expression, context);
    }

    default:
      return null;
  }
}

/**
 * Visit object projection
 */
function visitObjectProjection(
  node: ASTObjectExpression,
  context: SelectContext
): ObjectExpression | null {
  const properties: Record<string, Expression> = {};

  for (const prop of node.properties) {
    // Handle spread operator
    if ("type" in prop && (prop as { type: string }).type === "SpreadElement") {
      // Spread is complex - would need shape information
      // For now, skip spread in SELECT
      continue;
    }

    // Extract property key
    let key: string | null = null;
    if (prop.key?.type === "Identifier") {
      key = (prop.key as Identifier).name;
    } else if (prop.key?.type === "Literal" || prop.key?.type === "StringLiteral") {
      key = String((prop.key as Literal).value);
    }

    if (key && prop.value) {
      const value = visitProjection(prop.value, context);
      if (value) {
        properties[key] = value;
      }
    }
  }

  return {
    type: "object",
    properties,
  };
}

/**
 * Visit column projection
 */
function visitColumnProjection(
  node: MemberExpression,
  context: SelectContext
): ColumnExpression | ParameterExpression | null {
  if (!node.computed && node.property.type === "Identifier") {
    const propertyName = (node.property as Identifier).name;

    // Simple member access: x.name
    if (node.object.type === "Identifier") {
      const objectName = (node.object as Identifier).name;

      // Table parameter column
      if (context.tableParams.has(objectName)) {
        return {
          type: "column",
          name: propertyName,
        };
      }

      // Query parameter property
      if (context.queryParams.has(objectName)) {
        return {
          type: "param",
          param: objectName,
          property: propertyName,
        };
      }
    }

    // Nested member access: x.address.city
    if (node.object.type === "MemberExpression") {
      const innerColumn = visitColumnProjection(node.object as MemberExpression, context);
      if (innerColumn && innerColumn.type === "column") {
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
 * Visit identifier projection
 */
function visitIdentifierProjection(
  node: Identifier,
  context: SelectContext
): Expression | null {
  const name = node.name;

  // Table parameter (entire row)
  if (context.tableParams.has(name)) {
    return {
      type: "column",
      name,
    };
  }

  // Query parameter
  if (context.queryParams.has(name)) {
    return {
      type: "param",
      param: name,
    };
  }

  return null;
}

/**
 * Visit literal projection
 */
function visitLiteralProjection(
  node: Literal,
  context: SelectContext
): ValueExpression {
  // NULL is special - not parameterized
  if (node.value === null) {
    return {
      type: "constant",
      value: null,
      valueType: "null",
    };
  }

  // Auto-parameterize other literals
  const paramName = createAutoParam(context, node.value);
  return {
    type: "param",
    param: paramName,
  };
}

/**
 * Visit binary expression in projection
 */
function visitBinaryProjection(
  node: BinaryExpression,
  context: SelectContext
): Expression | null {
  // Arithmetic operators
  if (["+", "-", "*", "/", "%"].includes(node.operator)) {
    const left = visitProjection(node.left, context);
    const right = visitProjection(node.right, context);

    if (!left || !right) return null;

    // Check for string concatenation (+)
    if (node.operator === "+" && (isStringExpression(left) || isStringExpression(right))) {
      return {
        type: "concat",
        left: left as ValueExpression,
        right: right as ValueExpression,
      } as ConcatExpression;
    }

    // Regular arithmetic
    return {
      type: "arithmetic",
      operator: node.operator as "+" | "-" | "*" | "/" | "%",
      left: left as ValueExpression,
      right: right as ValueExpression,
    } as ArithmeticExpression;
  }

  return null;
}

/**
 * Visit method call in projection
 */
function visitMethodProjection(
  node: CallExpression,
  context: SelectContext
): Expression | null {
  if (node.callee.type !== "MemberExpression") return null;

  const memberCallee = node.callee as MemberExpression;
  if (memberCallee.property.type !== "Identifier") return null;

  const methodName = (memberCallee.property as Identifier).name;

  // String methods
  if (["toLowerCase", "toUpperCase"].includes(methodName)) {
    const obj = visitProjection(memberCallee.object, context);
    if (!obj) return null;

    return {
      type: "stringMethod",
      object: obj as ValueExpression,
      method: methodName as "toLowerCase" | "toUpperCase",
    };
  }

  return null;
}

/**
 * Visit unary expression in projection
 */
function visitUnaryProjection(
  node: UnaryExpression,
  context: SelectContext
): Expression | null {
  // Unary minus
  if (node.operator === "-") {
    if (node.argument.type === "NumericLiteral" || node.argument.type === "Literal") {
      const lit = node.argument as Literal;
      if (typeof lit.value === "number") {
        const value = -lit.value;
        const paramName = createAutoParam(context, value);
        return {
          type: "param",
          param: paramName,
        };
      }
    }

    // Negate other expressions
    const arg = visitProjection(node.argument, context);
    if (arg) {
      return {
        type: "arithmetic",
        operator: "*",
        left: { type: "constant", value: -1 },
        right: arg as ValueExpression,
      } as ArithmeticExpression;
    }
  }

  // Unary plus (pass through)
  if (node.operator === "+") {
    return visitProjection(node.argument, context);
  }

  return null;
}

/**
 * Visit conditional (ternary) expression
 */
function visitConditionalProjection(
  node: unknown,
  context: SelectContext
): Expression | null {
  // TODO: Implement CASE WHEN for ternary operator
  return null;
}

/**
 * Check if expression is likely a string
 */
function isStringExpression(expr: Expression): boolean {
  if (expr.type === "constant") {
    return typeof (expr as { value: unknown }).value === "string";
  }
  if (expr.type === "concat") {
    return true;
  }
  if (expr.type === "column") {
    const name = (expr as ColumnExpression).name.toLowerCase();
    return name.includes("name") || name.includes("title") || name.includes("description");
  }
  return false;
}