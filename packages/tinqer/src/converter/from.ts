/**
 * FROM operation converter
 */

import type { FromOperation } from "../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../parser/ast-types.js";
import type { StringLiteral, Literal } from "../parser/ast-types.js";
import type { ConversionContext } from "./converter-utils.js";

export function convertFromOperation(
  ast: ASTCallExpression,
  context: ConversionContext,
): FromOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const arg = ast.arguments[0];
    if (arg && (arg.type === "StringLiteral" || arg.type === "Literal")) {
      const tableName = (arg as StringLiteral | Literal).value as string;
      context.currentTable = tableName;
      return {
        type: "queryOperation",
        operationType: "from",
        table: tableName,
      };
    }
  }
  return null;
}