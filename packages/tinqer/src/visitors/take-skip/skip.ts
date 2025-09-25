/**
 * SKIP operation visitor
 * Handles .skip() and .offset() operations
 */

import type { SkipOperation, QueryOperation, ParamRef } from "../../query-tree/operations.js";
import type {
  CallExpression as ASTCallExpression,
  NumericLiteral,
  Literal,
  MemberExpression,
  Identifier,
  BinaryExpression,
  Expression,
} from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { createAutoParam } from "../types.js";
import type { ValueExpression, ArithmeticExpression } from "../../expressions/expression.js";

/**
 * Visit SKIP operation
 */
export function visitSkipOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _methodName: string,
  visitorContext: VisitorContext,
): { operation: SkipOperation; autoParams: Record<string, unknown> } | null {
  // SKIP expects a numeric argument: skip(10) or skip(p.offset)
  if (!ast.arguments || ast.arguments.length === 0) {
    return null;
  }

  const arg = ast.arguments[0];
  if (!arg) return null;

  const autoParams: Record<string, unknown> = {};

  // Handle numeric literal
  if (arg.type === "NumericLiteral" || arg.type === "Literal") {
    const value =
      arg.type === "NumericLiteral"
        ? (arg as NumericLiteral).value
        : ((arg as Literal).value as number);

    // Auto-parameterize the offset value with field context
    const paramName = createAutoParam(visitorContext, value, {
      fieldName: "OFFSET",
    });
    autoParams[paramName] = value;

    return {
      operation: {
        type: "queryOperation",
        operationType: "skip",
        source,
        count: { type: "param", param: paramName },
      },
      autoParams,
    };
  }

  // Handle external parameter (e.g., p.offset)
  if (arg.type === "MemberExpression") {
    const memberExpr = arg as MemberExpression;
    if (memberExpr.object.type === "Identifier" && memberExpr.property.type === "Identifier") {
      const objectName = (memberExpr.object as Identifier).name;
      const propertyName = (memberExpr.property as Identifier).name;

      // Check if it's a query parameter
      if (visitorContext.queryParams.has(objectName)) {
        return {
          operation: {
            type: "queryOperation",
            operationType: "skip",
            source,
            count: { type: "param", param: objectName, property: propertyName } as ParamRef,
          },
          autoParams: {},
        };
      }
    }
  }

  // Handle direct identifier (e.g., offset)
  if (arg.type === "Identifier") {
    const name = (arg as Identifier).name;

    // Check if it's a query parameter
    if (visitorContext.queryParams.has(name)) {
      return {
        operation: {
          type: "queryOperation",
          operationType: "skip",
          source,
          count: { type: "param", param: name } as ParamRef,
        },
        autoParams: {},
      };
    }
  }

  // Handle arithmetic expressions (e.g., skip((p.page - 1) * p.pageSize))
  // Also handle parenthesized expressions
  if (arg.type === "BinaryExpression" || arg.type === "ParenthesizedExpression") {
    const result = visitValueExpression(arg, visitorContext);
    if (result && result.value) {
      // Merge any auto-params created
      for (const [key, value] of Object.entries(result.autoParams)) {
        autoParams[key] = value;
      }

      return {
        operation: {
          type: "queryOperation",
          operationType: "skip",
          source,
          count: result.value,
        },
        autoParams,
      };
    }
  }

  return null;
}

/**
 * Visit a value expression for SKIP/TAKE context
 * Returns the expression and any auto-params created
 */
function visitValueExpression(
  node: Expression,
  context: VisitorContext,
): { value: ValueExpression | null; autoParams: Record<string, unknown> } | null {
  const autoParams: Record<string, unknown> = {};

  switch (node.type) {
    case "BinaryExpression": {
      const binary = node as BinaryExpression;
      // Arithmetic expression
      if (["+", "-", "*", "/", "%"].includes(binary.operator)) {
        // Recursively visit left and right
        const leftResult = visitValueExpression(binary.left, context);
        const rightResult = visitValueExpression(binary.right, context);

        if (!leftResult?.value || !rightResult?.value) return null;

        // Merge auto-params
        Object.assign(autoParams, leftResult.autoParams, rightResult.autoParams);

        return {
          value: {
            type: "arithmetic",
            operator: binary.operator as "+" | "-" | "*" | "/" | "%",
            left: leftResult.value,
            right: rightResult.value,
          } as ArithmeticExpression,
          autoParams,
        };
      }
      return null;
    }

    case "MemberExpression": {
      const memberExpr = node as MemberExpression;
      if (memberExpr.object.type === "Identifier" && memberExpr.property.type === "Identifier") {
        const objectName = (memberExpr.object as Identifier).name;
        const propertyName = (memberExpr.property as Identifier).name;

        // Check if it's a query parameter
        if (context.queryParams.has(objectName)) {
          return {
            value: {
              type: "param",
              param: objectName,
              property: propertyName,
            },
            autoParams: {},
          };
        }
      }
      return null;
    }

    case "NumericLiteral":
    case "Literal": {
      const value = node.type === "NumericLiteral"
        ? (node as NumericLiteral).value
        : ((node as Literal).value as number);

      // Auto-parameterize with OFFSET context
      const paramName = createAutoParam(context, value, {
        fieldName: "OFFSET",
      });
      autoParams[paramName] = value;

      return {
        value: {
          type: "param",
          param: paramName,
        },
        autoParams,
      };
    }

    case "Identifier": {
      const name = (node as Identifier).name;
      // Check if it's a query parameter
      if (context.queryParams.has(name)) {
        return {
          value: {
            type: "param",
            param: name,
          },
          autoParams: {},
        };
      }
      return null;
    }

    case "ParenthesizedExpression": {
      // Unwrap parentheses
      const paren = node as { expression: Expression };
      return visitValueExpression(paren.expression, context);
    }

    case "UnaryExpression": {
      const unary = node as { operator: string; argument: Expression };
      // Handle negative numbers
      if (unary.operator === "-" && (unary.argument.type === "NumericLiteral" || unary.argument.type === "Literal")) {
        const lit = unary.argument as Literal;
        if (typeof lit.value === "number") {
          const value = -lit.value;
          const paramName = createAutoParam(context, value, {
            fieldName: "OFFSET",
          });
          autoParams[paramName] = value;

          return {
            value: {
              type: "param",
              param: paramName,
            },
            autoParams,
          };
        }
      }
      return null;
    }

    default:
      return null;
  }
}
