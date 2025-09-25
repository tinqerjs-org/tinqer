/**
 * COUNT operation visitor
 */

import type { CountOperation, QueryOperation } from "../../query-tree/operations.js";
import type { BooleanExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  Expression as ASTExpression,
} from "../../parser/ast-types.js";
import { getParameterName, getReturnExpression, isBooleanExpression } from "../visitor-utils.js";
import { visitExpression } from "../expression-visitor.js";

export function visitCountOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  tableParams: Set<string>,
  queryParams: Set<string>,
  _methodName: string,
): { operation: CountOperation; autoParams: Record<string, unknown> } | null {
  let predicate: BooleanExpression | undefined;
  const autoParams: Record<string, unknown> = {};

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);

      // Create a new context for this visitor
      const localTableParams = new Set(tableParams);
      const localQueryParams = new Set(queryParams);

      if (paramName) {
        localTableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const result = visitExpression(bodyExpr, localTableParams, localQueryParams);
        if (result) {
          const expr = result.expression;
          if (expr && isBooleanExpression(expr)) {
            predicate = expr as BooleanExpression;
          }
          Object.assign(autoParams, result.autoParams);
        }
      }
    }
  }

  return {
    operation: {
      type: "queryOperation",
      operationType: "count",
      source,
      predicate,
    },
    autoParams,
  };
}
