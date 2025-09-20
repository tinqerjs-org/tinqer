/**
 * TAKE operation converter
 */

import type { TakeOperation, QueryOperation } from "../query-tree/operations.js";
import type {
  CallExpression as ASTCallExpression,
  NumericLiteral,
  Literal,
  MemberExpression as ASTMemberExpression,
  Identifier,
} from "../parser/ast-types.js";
import type { ConversionContext } from "./converter-utils.js";

export function convertTakeOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): TakeOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const arg = ast.arguments[0];
    if (!arg) return null;

    if (arg.type === "NumericLiteral") {
      return {
        type: "queryOperation",
        operationType: "take",
        source,
        count: (arg as NumericLiteral).value,
      };
    }
    if (arg.type === "Literal") {
      return {
        type: "queryOperation",
        operationType: "take",
        source,
        count: (arg as Literal).value as number,
      };
    }
    // Handle external parameter (e.g., p.limit)
    if (arg.type === "MemberExpression") {
      const memberExpr = arg as ASTMemberExpression;
      if (memberExpr.object.type === "Identifier" && memberExpr.property.type === "Identifier") {
        const objectName = (memberExpr.object as Identifier).name;
        const propertyName = (memberExpr.property as Identifier).name;
        if (context.queryParams.has(objectName)) {
          return {
            type: "queryOperation",
            operationType: "take",
            source,
            count: { type: "param", param: objectName, property: propertyName },
          };
        }
      }
    }
  }
  return null;
}
