/**
 * INTERSECT operation converter
 */

import type { IntersectOperation, QueryOperation } from "../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../parser/ast-types.js";
import type { ConversionContext } from "./converter-utils.js";
import { convertAstToQueryOperation } from "./ast-converter.js";

export function convertIntersectOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _context: ConversionContext,
): IntersectOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const secondArg = ast.arguments[0];
    if (secondArg) {
      const secondSource = convertAstToQueryOperation(secondArg);
      if (secondSource) {
        return {
          type: "queryOperation",
          operationType: "intersect",
          source,
          second: secondSource,
        };
      }
    }
  }
  return null;
}
