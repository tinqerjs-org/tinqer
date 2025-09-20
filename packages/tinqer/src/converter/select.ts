/**
 * SELECT operation converter
 */

import type { SelectOperation, QueryOperation } from "../query-tree/operations.js";
import type {
  ValueExpression,
  ObjectExpression,
} from "../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
} from "../parser/ast-types.js";
import type { ConversionContext } from "./converter-utils.js";
import { getParameterName, isValueExpression, isObjectExpression } from "./converter-utils.js";
import { convertAstToExpression } from "./expressions.js";

export function convertSelectOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): SelectOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      // Add the lambda parameter to table params
      const paramName = getParameterName(lambdaAst as ArrowFunctionExpression);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const body = (lambdaAst as ArrowFunctionExpression).body;
      const selector =
        body.type === "BlockStatement" ? null : convertAstToExpression(body, context);
      if (selector && (isValueExpression(selector) || isObjectExpression(selector))) {
        return {
          type: "queryOperation",
          operationType: "select",
          source,
          selector: selector as ValueExpression | ObjectExpression,
        };
      }
    }
  }
  return null;
}