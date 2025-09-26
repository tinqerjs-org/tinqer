/**
 * SUM operation visitor
 */

import type { SumOperation, QueryOperation } from "../../query-tree/operations.js";
import type { ColumnExpression, ValueExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  Expression as ASTExpression,
} from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { getParameterName, getReturnExpression } from "../visitor-utils.js";
import { visitValue } from "../shared/value-visitor.js";

export function visitSumOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _methodName: string,
  visitorContext: VisitorContext,
): { operation: SumOperation; autoParams: Record<string, unknown> } | null {
  let selector: string | undefined;
  const autoParams: Record<string, unknown> = {};

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);

      // Create a new context for this visitor
      const localTableParams = new Set(visitorContext.tableParams);
      const localQueryParams = new Set(visitorContext.queryParams);

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
        const result = visitValue(
          bodyExpr,
          localTableParams,
          localQueryParams,
          visitorContext.autoParams,
          visitorContext.autoParamCounter,
        );

        if (result.value) {
          const expr = result.value;
          // Store both selector (for backward compatibility) and full expression
          if (expr.type === "column") {
            selector = (expr as ColumnExpression).name;
          }
          // Store the full expression for complex cases
          Object.assign(autoParams, result.autoParams);
          visitorContext.autoParamCounter = result.counter;

          // Return with the expression
          return {
            operation: {
              type: "queryOperation",
              operationType: "sum",
              source,
              selector,
              selectorExpression: expr as ValueExpression,
            },
            autoParams,
          };
        }
      }
    }
  }

  return {
    operation: {
      type: "queryOperation",
      operationType: "sum",
      source,
      selector,
    },
    autoParams,
  };
}
