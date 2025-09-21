/**
 * JOIN operation converter
 */

import type { JoinOperation, QueryOperation } from "../query-tree/operations.js";
import type { ColumnExpression } from "../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  Expression as ASTExpression,
} from "../parser/ast-types.js";
import type { ConversionContext } from "./converter-utils.js";
import { getParameterName, getReturnExpression } from "./converter-utils.js";
import { convertAstToExpression } from "./expressions.js";
import { convertMethodChain } from "./ast-converter.js";

export function convertJoinOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): JoinOperation | null {
  if (ast.arguments && ast.arguments.length >= 4) {
    // join(inner, outerKeySelector, innerKeySelector, resultSelector)
    const firstArg = ast.arguments[0];
    const innerSource = firstArg ? convertMethodChain(firstArg as ASTExpression, context) : null;
    const outerKeySelectorAst = ast.arguments[1];
    const innerKeySelectorAst = ast.arguments[2];

    let outerKey: string | null = null;
    let innerKey: string | null = null;

    // Only support simple column selectors
    if (outerKeySelectorAst && outerKeySelectorAst.type === "ArrowFunctionExpression") {
      const outerArrow = outerKeySelectorAst as ArrowFunctionExpression;
      const paramName = getParameterName(outerArrow);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (outerArrow.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(outerArrow.body.body);
      } else {
        bodyExpr = outerArrow.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && expr.type === "column") {
          outerKey = (expr as ColumnExpression).name;
        }
      }
    }

    if (innerKeySelectorAst && innerKeySelectorAst.type === "ArrowFunctionExpression") {
      const innerArrow = innerKeySelectorAst as ArrowFunctionExpression;
      const paramName = getParameterName(innerArrow);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (innerArrow.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(innerArrow.body.body);
      } else {
        bodyExpr = innerArrow.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && expr.type === "column") {
          innerKey = (expr as ColumnExpression).name;
        }
      }
    }

    if (innerSource && outerKey && innerKey) {
      return {
        type: "queryOperation",
        operationType: "join",
        source,
        inner: innerSource,
        outerKey,
        innerKey,
      };
    }
  }
  return null;
}
