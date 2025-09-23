/**
 * EXCEPT operation converter
 */

import type { ExceptOperation, QueryOperation } from "../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../parser/ast-types.js";
import type { ConversionContext } from "./converter-utils.js";
import { convertAstToQueryOperation } from "./ast-converter.js";

export function convertExceptOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _context: ConversionContext,
): ExceptOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const secondArg = ast.arguments[0];
    if (secondArg) {
      const secondSource = convertAstToQueryOperation(secondArg);
      if (secondSource) {
        return {
          type: "queryOperation",
          operationType: "except",
          source,
          second: secondSource,
        };
      }
    }
  }
  return null;
}
