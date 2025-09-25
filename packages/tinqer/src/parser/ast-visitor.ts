/**
 * AST to QueryOperation visitor
 * Main entry point for the visitor-based parsing system
 */

import type { QueryOperation } from "../query-tree/operations.js";
import type {
  Expression as ASTExpression,
  CallExpression as ASTCallExpression,
  MemberExpression as ASTMemberExpression,
  ArrowFunctionExpression,
  Identifier,
} from "./ast-types.js";

// Import operation visitors
import { visitFromOperation } from "../visitors/from/index.js";
import { visitWhereOperation } from "../visitors/where/index.js";
import { visitSelectOperation } from "../visitors/select/index.js";
import { visitOrderByOperation } from "../visitors/orderby/index.js";
import { visitTakeOperation } from "../visitors/take-skip/take.js";
import { visitSkipOperation } from "../visitors/take-skip/skip.js";
import { visitDistinctOperation } from "../visitors/distinct/index.js";
import { visitJoinOperation } from "../visitors/join/index.js";
import { visitGroupByOperation } from "../visitors/groupby/index.js";
import { visitCountOperation } from "../visitors/count/index.js";
import { visitSumOperation } from "../visitors/aggregates/sum.js";
import { visitAverageOperation } from "../visitors/aggregates/average.js";
import { visitMinOperation } from "../visitors/aggregates/min.js";
import { visitMaxOperation } from "../visitors/aggregates/max.js";
import { visitFirstOperation } from "../visitors/predicates/first.js";
import { visitSingleOperation } from "../visitors/predicates/single.js";
import { visitLastOperation } from "../visitors/predicates/last.js";
import { visitAnyOperation } from "../visitors/boolean-predicates/any.js";
import { visitAllOperation } from "../visitors/boolean-predicates/all.js";
import { visitContainsOperation } from "../visitors/contains/index.js";
import { visitReverseOperation } from "../visitors/reverse/index.js";
import { visitToArrayOperation } from "../visitors/toarray/index.js";

/**
 * Parse result with operation and auto-params
 */
export interface VisitorParseResult {
  operation: QueryOperation | null;
  autoParams: Record<string, unknown>;
  tableParams: Set<string>;
  queryParams: Set<string>;
  ast: ASTExpression;
}

/**
 * Convert AST to QueryOperation using visitor pattern
 */
export function convertAstToQueryOperationWithParams(
  ast: ASTExpression
): {
  operation: QueryOperation | null;
  autoParams: Record<string, unknown>;
  autoParamInfos?: Record<string, unknown>;
} {
  // Extract parameter info from the lambda
  const { tableParams, queryParams } = extractParameters(ast);

  // Track all auto-params across visitors
  const allAutoParams: Record<string, unknown> = {};

  // Visit the query chain
  const operation = visitQueryChain(ast, tableParams, queryParams, allAutoParams);

  return {
    operation,
    autoParams: allAutoParams,
  };
}

/**
 * Extract table and query parameters from the root lambda
 */
function extractParameters(ast: ASTExpression): {
  tableParams: Set<string>;
  queryParams: Set<string>;
} {
  const tableParams = new Set<string>();
  const queryParams = new Set<string>();

  // Check if the root is an arrow function with params (query params)
  // For queries like: () => from(...).where(...)
  // Or: (p) => from(...).where(x => x.id == p.minId)
  if (ast.type === "ArrowFunctionExpression") {
    const arrow = ast as ArrowFunctionExpression;
    if (arrow.params && arrow.params.length > 0) {
      // If there are params, they're query params
      const firstParam = arrow.params[0];
      if (firstParam && firstParam.type === "Identifier") {
        queryParams.add((firstParam as Identifier).name);
      }
    }
    // For parameterless lambdas, no query params
  }

  return { tableParams, queryParams };
}

/**
 * Visit a query chain and build the operation tree
 */
function visitQueryChain(
  ast: ASTExpression,
  tableParams: Set<string>,
  queryParams: Set<string>,
  autoParams: Record<string, unknown>
): QueryOperation | null {
  // If it's an arrow function, visit its body
  if (ast.type === "ArrowFunctionExpression") {
    const arrow = ast as ArrowFunctionExpression;
    const body = arrow.body;

    // Handle block statement body
    if (body.type === "BlockStatement") {
      // Look for return statement
      const returnStmt = body.body.find(
        (stmt: unknown) => (stmt as { type?: string }).type === "ReturnStatement"
      );
      if (returnStmt) {
        const returnExpr = (returnStmt as { argument?: ASTExpression }).argument;
        if (returnExpr) {
          return visitQueryChain(returnExpr, tableParams, queryParams, autoParams);
        }
      }
    } else {
      // Expression body
      return visitQueryChain(body, tableParams, queryParams, autoParams);
    }
  }

  // Handle call expressions (method calls)
  if (ast.type === "CallExpression") {
    return visitCallExpression(ast as ASTCallExpression, tableParams, queryParams, autoParams);
  }

  return null;
}

/**
 * Visit a call expression (method call)
 */
function visitCallExpression(
  ast: ASTCallExpression,
  tableParams: Set<string>,
  queryParams: Set<string>,
  autoParams: Record<string, unknown>
): QueryOperation | null {
  const methodName = getMethodName(ast);
  if (!methodName) return null;

  // Handle FROM (root operation)
  if (methodName === "from") {
    const operation = visitFromOperation(ast);
    // FROM doesn't have auto-params
    return operation;
  }

  // For chained operations, first process the source
  if (ast.callee.type === "MemberExpression") {
    const memberExpr = ast.callee as ASTMemberExpression;
    const source = visitQueryChain(memberExpr.object, tableParams, queryParams, autoParams);

    if (!source) return null;

    // Visit specific operation based on method name
    switch (methodName) {
      case "where": {
        const result = visitWhereOperation(ast, source, tableParams, queryParams);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "select":
      case "selectMany": {
        const result = visitSelectOperation(ast, source, tableParams, queryParams);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "orderBy":
      case "orderByDescending": {
        const result = visitOrderByOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "take": {
        const result = visitTakeOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "skip": {
        const result = visitSkipOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "distinct": {
        const result = visitDistinctOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "join": {
        const result = visitJoinOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "groupBy": {
        const result = visitGroupByOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "count": {
        const result = visitCountOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "sum": {
        const result = visitSumOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "average":
      case "avg": {
        const result = visitAverageOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "min": {
        const result = visitMinOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "max": {
        const result = visitMaxOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "first":
      case "firstOrDefault": {
        const result = visitFirstOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "single":
      case "singleOrDefault": {
        const result = visitSingleOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "last":
      case "lastOrDefault": {
        const result = visitLastOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "any": {
        const result = visitAnyOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "all": {
        const result = visitAllOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "contains": {
        const result = visitContainsOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "reverse": {
        const result = visitReverseOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      case "toArray":
      case "toList": {
        const result = visitToArrayOperation(ast, source, tableParams, queryParams, methodName);
        if (result) {
          Object.assign(autoParams, result.autoParams);
          return result.operation;
        }
        return null;
      }

      default:
        console.warn(`Unknown query method: ${methodName}`);
        return null;
    }
  }

  return null;
}

/**
 * Get method name from call expression
 */
function getMethodName(ast: ASTCallExpression): string | null {
  if (ast.callee.type === "Identifier") {
    return (ast.callee as Identifier).name;
  }

  if (ast.callee.type === "MemberExpression") {
    const memberExpr = ast.callee as ASTMemberExpression;
    if (memberExpr.property.type === "Identifier") {
      return (memberExpr.property as Identifier).name;
    }
  }

  return null;
}