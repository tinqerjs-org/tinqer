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
} from "../../parser/ast-types.js";

/**
 * Visit SKIP operation
 */
export function visitSkipOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _tableParams: Set<string>,
  queryParams: Set<string>,
  _methodName: string
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
    const value = arg.type === "NumericLiteral"
      ? (arg as NumericLiteral).value
      : (arg as Literal).value as number;

    // Auto-parameterize the offset value
    const paramName = `__p${Object.keys(autoParams).length + 1}`;
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
      if (queryParams.has(objectName)) {
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
    if (queryParams.has(name)) {
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

  // Handle arithmetic expressions (e.g., skip(p.page * p.pageSize))
  // For now, we'll handle this later when we have expression visitors for arithmetic
  // TODO: Add support for arithmetic expressions in skip

  return null;
}