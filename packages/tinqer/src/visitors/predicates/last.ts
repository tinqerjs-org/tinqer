/**
 * LAST and LAST OR DEFAULT operation visitors
 */

import type {
  LastOperation,
  LastOrDefaultOperation,
  QueryOperation,
} from "../../query-tree/operations.js";
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
import { getParameterName, getReturnExpression, isBooleanExpression } from "../visitor-utils.js";
import { visitExpression } from "../expression-visitor.js";

export function visitLastOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  tableParams: Set<string>,
  queryParams: Set<string>,
  methodName: string
): { operation: LastOperation | LastOrDefaultOperation; autoParams: Record<string, unknown> } | null {
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
          Object.assign(autoParams, result.autoParams);
        }
      }
    }
  }

  const operation: LastOperation | LastOrDefaultOperation = {
    type: "queryOperation",
    operationType: methodName === "lastOrDefault" ? "lastOrDefault" : "last",
    source,
    predicate,
  };
  return {
    operation,
    autoParams
  };
}