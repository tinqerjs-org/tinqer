/**
 * SELECT projection visitor
 * Converts AST expressions to projection expressions (columns, objects, values)
 */

import type {
  Expression,
  ObjectExpression,
  ValueExpression,
  ColumnExpression,
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
  ArrowFunctionExpression,
} from "../../parser/ast-types.js";

import type { SelectContext } from "./context.js";
import { createAutoParam } from "./context.js";

/**
 * Visit a projection expression in SELECT context
 * Returns Expression (ValueExpression or ObjectExpression)
 */
export function visitProjection(node: ASTExpression, context: SelectContext): Expression | null {
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

    case "LogicalExpression": {
      // Null coalescing operator (??)
      const logical = node as any;
      if (logical.operator === "??") {
        const left = visitProjection(logical.left, context);
        const right = visitProjection(logical.right, context);

        if (left && right) {
          return {
            type: "coalesce",
            expressions: [left, right],
          } as any;
        }
      }
      return null;
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
  context: SelectContext,
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
function visitColumnProjection(node: MemberExpression, context: SelectContext): Expression | null {
  if (!node.computed && node.property.type === "Identifier") {
    const propertyName = (node.property as Identifier).name;

    // Simple member access: x.name
    if (node.object.type === "Identifier") {
      const objectName = (node.object as Identifier).name;

      // Grouping parameter access (g.key, g.count(), etc.)
      if (context.groupingParams.has(objectName)) {
        if (propertyName === "key") {
          // g.key refers to the GROUP BY key expression
          return context.groupKeyExpression || null;
        }
        // Other properties on grouping params will be handled by method calls
        return null;
      }

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

    // Nested member access: x.address.city or g.key.category
    if (node.object.type === "MemberExpression") {
      const innerExpr = visitColumnProjection(node.object as MemberExpression, context);

      // If inner expression is an object (like g.key returning a composite key)
      if (innerExpr && innerExpr.type === "object") {
        const objExpr = innerExpr as ObjectExpression;
        // Extract the specific property from the object
        if (objExpr.properties[propertyName]) {
          return objExpr.properties[propertyName];
        }
      }

      // Regular nested column access
      if (innerExpr && innerExpr.type === "column") {
        return {
          type: "column",
          name: `${(innerExpr as ColumnExpression).name}.${propertyName}`,
        };
      }
    }
  }

  return null;
}

/**
 * Visit identifier projection
 */
function visitIdentifierProjection(node: Identifier, context: SelectContext): Expression | null {
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
function visitLiteralProjection(node: Literal, context: SelectContext): ValueExpression {
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
function visitBinaryProjection(node: BinaryExpression, context: SelectContext): Expression | null {
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
function visitMethodProjection(node: CallExpression, context: SelectContext): Expression | null {
  if (node.callee.type !== "MemberExpression") return null;

  const memberCallee = node.callee as MemberExpression;
  if (memberCallee.property.type !== "Identifier") return null;

  const methodName = (memberCallee.property as Identifier).name;

  // Check if this is a method call on a grouping parameter (e.g., g.count())
  if (memberCallee.object.type === "Identifier") {
    const objectName = (memberCallee.object as Identifier).name;

    if (context.groupingParams.has(objectName)) {
      // Handle aggregate methods on grouping parameter
      if (methodName === "count") {
        return {
          type: "aggregate",
          function: "count",
        } as any;
      } else if (methodName === "sum") {
        // sum() requires a selector argument
        if (node.arguments && node.arguments.length > 0) {
          const arg = node.arguments[0];
          if (arg && arg.type === "ArrowFunctionExpression") {
            const lambda = arg as ArrowFunctionExpression;
            // Parse the selector lambda
            const selector = parseSelectorLambda(lambda, context);
            if (selector && selector.type === "column") {
              return {
                type: "aggregate",
                function: "sum",
                expression: selector,
              } as any;
            }
          }
        }
      } else if (["avg", "average", "min", "max"].includes(methodName)) {
        // Similar handling for other aggregates
        if (node.arguments && node.arguments.length > 0) {
          const arg = node.arguments[0];
          if (arg && arg.type === "ArrowFunctionExpression") {
            const lambda = arg as ArrowFunctionExpression;
            const selector = parseSelectorLambda(lambda, context);
            if (selector && selector.type === "column") {
              // Map "average" to "avg" for SQL
              const functionName = methodName === "average" ? "avg" : methodName;
              return {
                type: "aggregate",
                function: functionName,
                expression: selector,
              } as any;
            }
          }
        }
      }
    }
  }

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
 * Helper to parse selector lambda in aggregate functions
 */
function parseSelectorLambda(
  lambda: ArrowFunctionExpression,
  context: SelectContext,
): Expression | null {
  // Get the lambda body
  let bodyExpr: ASTExpression | null = null;
  if (lambda.body.type === "BlockStatement") {
    const returnStmt = lambda.body.body.find(
      (stmt: unknown) => (stmt as { type?: string }).type === "ReturnStatement",
    );
    if (returnStmt) {
      bodyExpr = (returnStmt as { argument?: ASTExpression }).argument || null;
    }
  } else {
    bodyExpr = lambda.body;
  }

  if (!bodyExpr) return null;

  // Add lambda parameter to table params temporarily
  const tempContext = { ...context };
  tempContext.tableParams = new Set(context.tableParams);

  if (lambda.params && lambda.params.length > 0) {
    const firstParam = lambda.params[0];
    if (firstParam && firstParam.type === "Identifier") {
      tempContext.tableParams.add((firstParam as Identifier).name);
    }
  }

  return visitProjection(bodyExpr, tempContext);
}

/**
 * Visit unary expression in projection
 */
function visitUnaryProjection(node: UnaryExpression, context: SelectContext): Expression | null {
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
function visitConditionalProjection(node: any, context: SelectContext): Expression | null {
  // Ternary operator: condition ? thenExpr : elseExpr
  // Converts to SQL: CASE WHEN condition THEN thenExpr ELSE elseExpr END

  if (!node.test || !node.consequent || !node.alternate) {
    return null;
  }

  // Parse the condition (this should produce a boolean expression)
  // We need to convert it from AST to our expression format
  // For now, we'll handle simple comparisons
  const condition = visitBooleanCondition(node.test, context);
  if (!condition) {
    return null;
  }

  // Parse the then branch
  const thenExpr = visitProjection(node.consequent, context);
  if (!thenExpr) {
    return null;
  }

  // Parse the else branch
  const elseExpr = visitProjection(node.alternate, context);
  if (!elseExpr) {
    return null;
  }

  return {
    type: "case",
    condition,
    then: thenExpr,
    else: elseExpr,
  } as any;
}

/**
 * Helper to convert AST boolean expressions for CASE WHEN
 */
function visitBooleanCondition(node: any, context: SelectContext): any {
  if (!node) return null;

  switch (node.type) {
    case "BinaryExpression": {
      // Comparison operators
      if (["==", "===", "!=", "!==", ">", ">=", "<", "<="].includes(node.operator)) {
        const left = visitProjection(node.left, context);
        const right = visitProjection(node.right, context);

        if (left && right) {
          const op =
            node.operator === "===" ? "==" : node.operator === "!==" ? "!=" : node.operator;
          return {
            type: "comparison",
            operator: op,
            left,
            right,
          };
        }
      }
      break;
    }

    case "LogicalExpression": {
      // AND/OR operators
      if (["&&", "||"].includes(node.operator)) {
        const left = visitBooleanCondition(node.left, context);
        const right = visitBooleanCondition(node.right, context);

        if (left && right) {
          return {
            type: "logical",
            operator: node.operator === "&&" ? "and" : "or",
            left,
            right,
          };
        }
      }
      break;
    }

    case "UnaryExpression": {
      // NOT operator
      if (node.operator === "!") {
        const inner = visitBooleanCondition(node.argument, context);
        if (inner) {
          return {
            type: "not",
            expression: inner,
          };
        }
      }
      break;
    }

    case "Identifier": {
      // Direct boolean column
      return visitProjection(node, context);
    }

    case "MemberExpression": {
      // Boolean property access
      return visitProjection(node, context);
    }
  }

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
