/**
 * TAKE operation visitor
 * Handles .take() and .limit() operations
 */

import type { TakeOperation, QueryOperation, ParamRef } from "../../query-tree/operations.js";
import type {
  CallExpression as ASTCallExpression,
  NumericLiteral,
  Literal,
  MemberExpression,
  Identifier,
} from "../../parser/ast-types.js";

/**
 * Visit TAKE operation
 */
export function visitTakeOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _tableParams: Set<string>,
  queryParams: Set<string>,
  _methodName: string,
): { operation: TakeOperation; autoParams: Record<string, unknown> } | null {
  // TAKE expects a numeric argument: take(10) or take(p.limit)
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

    // Auto-parameterize the limit value
    const paramName = `__p${Object.keys(autoParams).length + 1}`;
    autoParams[paramName] = value;

    return {
      operation: {
        type: "queryOperation",
        operationType: "take",
        source,
        count: { type: "param", param: paramName },
      },
      autoParams,
    };
  }

  // Handle external parameter (e.g., p.limit)
  if (arg.type === "MemberExpression") {
    const memberExpr = arg as MemberExpression;
    if (memberExpr.object.type === "Identifier" && memberExpr.property.type === "Identifier") {
      const objectName = (memberExpr.object as Identifier).name;
      const propertyName = (memberExpr.property as Identifier).name;

      // Check if it's a query parameter
      if (queryParams.has(objectName)) {
        return {
          operation: {
            type: "queryOperation",
            operationType: "take",
            source,
            count: { type: "param", param: objectName, property: propertyName } as ParamRef,
          },
          autoParams: {},
        };
      }
    }
  }

  // Handle direct identifier (e.g., limit)
  if (arg.type === "Identifier") {
    const name = (arg as Identifier).name;

    // Check if it's a query parameter
    if (queryParams.has(name)) {
      return {
        operation: {
          type: "queryOperation",
          operationType: "take",
          source,
          count: { type: "param", param: name } as ParamRef,
        },
        autoParams: {},
      };
    }
  }

  return null;
}
