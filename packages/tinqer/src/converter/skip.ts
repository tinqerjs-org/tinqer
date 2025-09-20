/**
 * SKIP and SKIP WHILE operation converters
 */

import type {
  SkipOperation,
  SkipWhileOperation,
  QueryOperation,
  ParamRef,
} from "../query-tree/operations.js";
import type {
  BooleanExpression,
  ColumnExpression,
  ParameterExpression,
} from "../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  NumericLiteral,
  Literal,
  ArrowFunctionExpression,
  Expression as ASTExpression,
} from "../parser/ast-types.js";
import type { ConversionContext } from "./converter-utils.js";
import { getParameterName, getReturnExpression, isBooleanExpression } from "./converter-utils.js";
import { convertAstToExpression } from "./expressions.js";

export function convertSkipOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): SkipOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const arg = ast.arguments[0];
    if (!arg) return null;

    // Handle numeric literals
    if (arg.type === "NumericLiteral") {
      return {
        type: "queryOperation",
        operationType: "skip",
        source,
        count: (arg as NumericLiteral).value,
      };
    }
    if (arg.type === "Literal") {
      return {
        type: "queryOperation",
        operationType: "skip",
        source,
        count: (arg as Literal).value as number,
      };
    }

    // Handle any expression (including arithmetic, member access, etc.)
    const expr = convertAstToExpression(arg, context);
    if (expr) {
      // If it's a simple parameter reference, use it directly
      if (expr.type === "param") {
        return {
          type: "queryOperation",
          operationType: "skip",
          source,
          count: expr as ParameterExpression,
        };
      }

      // For other expressions (like arithmetic), use the expression directly
      // Note: This may be an arithmetic expression or other ValueExpression
      return {
        type: "queryOperation",
        operationType: "skip",
        source,
        count: expr as unknown as number | ParamRef, // Type assertion needed due to ValueExpression mismatch
      };
    }
  }
  return null;
}

export function convertSkipWhileOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): SkipWhileOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      // Add the lambda parameter to table params
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (!bodyExpr) return null;
      const predicate = convertAstToExpression(bodyExpr, context);

      // Convert column to booleanColumn if needed
      let finalPredicate = predicate;
      if (predicate && predicate.type === "column") {
        finalPredicate = {
          type: "booleanColumn",
          name: (predicate as ColumnExpression).name,
        };
      }

      if (finalPredicate && isBooleanExpression(finalPredicate)) {
        return {
          type: "queryOperation",
          operationType: "skipWhile",
          source,
          predicate: finalPredicate as BooleanExpression,
        };
      }
    }
  }
  return null;
}