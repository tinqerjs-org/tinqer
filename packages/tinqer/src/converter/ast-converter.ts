/**
 * AST to Expression/QueryOperation converter
 * Main orchestrator that imports and uses all converter modules
 */

import type { QueryOperation } from "../query-tree/operations.js";
import type {
  Program,
  ExpressionStatement,
  Expression as ASTExpression,
  CallExpression as ASTCallExpression,
} from "../parser/ast-types.js";

import { findArrowFunction, getParameterName, getMethodName } from "./converter-utils.js";
import type { ConversionContext } from "./converter-utils.js";

// Re-export ConversionContext for external use
export type { ConversionContext } from "./converter-utils.js";

// Import operation converters
import { convertFromOperation } from "./from.js";
import { convertWhereOperation } from "./where.js";
import { convertSelectOperation } from "./select.js";
import { convertOrderByOperation, convertThenByOperation } from "./orderby.js";
import { convertTakeOperation } from "./take.js";
import { convertSkipOperation } from "./skip.js";
import { convertGroupByOperation } from "./groupby.js";
import { convertDistinctOperation } from "./distinct.js";
import { convertCountOperation } from "./count.js";
import { convertSumOperation } from "./sum.js";
import { convertFirstOperation, convertFirstOrDefaultOperation } from "./first.js";
import { convertJoinOperation } from "./join.js";
import { convertAverageOperation } from "./average.js";
import { convertMinOperation } from "./min.js";
import { convertMaxOperation } from "./max.js";
import { convertSingleOperation } from "./single.js";
import { convertLastOperation } from "./last.js";
import { convertContainsOperation } from "./contains.js";
import { convertUnionOperation } from "./union.js";
import { convertReverseOperation } from "./reverse.js";
import { convertToArrayOperation } from "./toarray.js";

// Export the expression converter for use by operation converters
export { convertAstToExpression } from "./expressions.js";

/**
 * Converts an OXC AST to a QueryOperation tree
 * This handles the method chain: from().where().select() etc.
 */
export function convertAstToQueryOperation(ast: unknown): QueryOperation | null {
  try {
    if (!ast || typeof ast !== "object" || !("type" in ast)) {
      return null;
    }

    // Handle Program nodes from OXC parser
    let actualAst: ASTExpression;
    const typedAst = ast as { type: string };

    if (typedAst.type === "Program") {
      const program = ast as Program;
      if (program.body && program.body.length > 0) {
        const firstStatement = program.body[0];
        if (firstStatement && firstStatement.type === "ExpressionStatement") {
          const exprStmt = firstStatement as ExpressionStatement;
          actualAst = exprStmt.expression;
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      actualAst = ast as ASTExpression;
    }

    // The AST should be an arrow function
    // Extract the body which should be a method chain
    const arrowFunc = findArrowFunction(actualAst);
    if (!arrowFunc) {
      return null;
    }

    // Get the parameter name (e.g., "p" in (p) => ...)
    const paramName = getParameterName(arrowFunc);

    // Create context
    const context: ConversionContext = {
      tableParams: new Set(),
      queryParams: paramName ? new Set([paramName]) : new Set(),
      tableAliases: new Map(),
    };

    // Convert the body (should be a method chain)
    // Handle both Expression body and BlockStatement body
    if (arrowFunc.body.type === "BlockStatement") {
      // For block statements, look for a return statement
      const returnExpr = getReturnExpression(arrowFunc.body.body);
      if (returnExpr) {
        return convertMethodChain(returnExpr, context);
      }
      return null;
    } else {
      return convertMethodChain(arrowFunc.body, context);
    }
  } catch (error) {
    console.error("Failed to convert AST to QueryOperation:", error);
    return null;
  }
}

/**
 * Helper function to extract return expression from block body
 */
function getReturnExpression(blockBody: unknown): ASTExpression | null {
  const statements = blockBody as Array<{ type: string; argument?: ASTExpression }>;
  const firstStatement = statements && statements.length > 0 ? statements[0] : null;
  if (firstStatement && firstStatement.type === "ReturnStatement") {
    return firstStatement.argument || null;
  }
  return null;
}

/**
 * Convert method chain to QueryOperation
 */
export function convertMethodChain(
  ast: ASTExpression,
  context: ConversionContext,
): QueryOperation | null {
  if (!ast) return null;

  // Handle call expressions (method calls)
  if (ast.type === "CallExpression") {
    const callAst = ast as ASTCallExpression;
    const methodName = getMethodName(callAst);

    // Check if this is a from() call
    if (methodName === "from") {
      return convertFromOperation(callAst, context);
    }

    // Otherwise, it's a chained method call
    if (callAst.callee && callAst.callee.type === "MemberExpression") {
      const source = convertMethodChain(callAst.callee.object, context);
      if (!source) return null;

      switch (methodName) {
        case "where":
          return convertWhereOperation(callAst, source, context);
        case "select":
          return convertSelectOperation(callAst, source, context);
        case "orderBy":
        case "orderByDescending":
          return convertOrderByOperation(callAst, source, context, methodName);
        case "take":
          return convertTakeOperation(callAst, source, context);
        case "skip":
          return convertSkipOperation(callAst, source, context);
        case "first":
          return convertFirstOperation(callAst, source, context, false);
        case "firstOrDefault":
          return convertFirstOrDefaultOperation(callAst, source, context);
        case "count":
          return convertCountOperation(callAst, source, context);
        case "toArray":
          return convertToArrayOperation(source);
        case "groupBy":
          return convertGroupByOperation(callAst, source, context);
        case "join":
          return convertJoinOperation(callAst, source, context);
        case "distinct":
          return convertDistinctOperation(callAst, source, context);
        case "thenBy":
        case "thenByDescending":
          return convertThenByOperation(callAst, source, context, methodName);
        case "sum":
          return convertSumOperation(callAst, source, context);
        case "average":
          return convertAverageOperation(callAst, source, context);
        case "min":
          return convertMinOperation(callAst, source, context);
        case "max":
          return convertMaxOperation(callAst, source, context);
        case "single":
        case "singleOrDefault":
          return convertSingleOperation(callAst, source, context, methodName);
        case "last":
        case "lastOrDefault":
          return convertLastOperation(callAst, source, context, methodName);
        case "contains":
          return convertContainsOperation(callAst, source, context);
        case "union":
          return convertUnionOperation(callAst, source, context);
        case "reverse":
          return convertReverseOperation(source);
        // Add more operations as needed
      }
    }
  }

  return null;
}
