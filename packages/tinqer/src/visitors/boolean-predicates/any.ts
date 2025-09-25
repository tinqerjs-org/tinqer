/**
 * ANY operation visitor
 */

import type { AnyOperation, QueryOperation } from "../../query-tree/operations.js";
import type {
  BooleanExpression,
  ColumnExpression,
  BooleanColumnExpression,
} from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  Expression as ASTExpression,
} from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { getParameterName, getReturnExpression, isBooleanExpression } from "../visitor-utils.js";
import { visitExpression } from "../expression-visitor.js";

export function visitAnyOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _methodName: string,
  visitorContext: VisitorContext,
): { operation: AnyOperation; autoParams: Record<string, unknown> } | null {
  let predicate: BooleanExpression | undefined;
  let autoParams: Record<string, unknown> = {};

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
        // Convert autoParams to the format expected by visitExpression
        const existingAutoParams = new Map<string, { value: unknown }>();
        for (const [key, value] of visitorContext.autoParams) {
          existingAutoParams.set(key, { value });
        }

        const result = visitExpression(
          bodyExpr,
          localTableParams,
          localQueryParams,
          visitorContext.autoParamCounter,
          existingAutoParams,
        );
        if (result) {
          const expr = result.expression;
          if (expr) {
            if (isBooleanExpression(expr)) {
              predicate = expr as BooleanExpression;
            } else if (expr.type === "column") {
              // If we get a column expression in a predicate context,
              // treat it as a boolean column
              predicate = {
                type: "booleanColumn",
                name: (expr as ColumnExpression).name,
              } as BooleanColumnExpression;
            }
          }
          // Use result's autoParams which contains both old and new params
          autoParams = result.autoParams;
          visitorContext.autoParamCounter = result.counter;
        }
      }
    }
  }

  return {
    operation: {
      type: "queryOperation",
      operationType: "any",
      source,
      predicate,
    },
    autoParams,
  };
}
