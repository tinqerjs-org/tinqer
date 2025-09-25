/**
 * AST to QueryOperation visitor
 * Main entry point for the visitor-based parsing system
 */

import type { QueryOperation, JoinOperation, ResultShape } from "../query-tree/operations.js";
import type {
  Expression as ASTExpression,
  CallExpression as ASTCallExpression,
  MemberExpression as ASTMemberExpression,
  ArrowFunctionExpression,
  Identifier,
} from "./ast-types.js";
import type { VisitorContext } from "../visitors/types.js";

// Import operation visitors
import { visitFromOperation } from "../visitors/from/index.js";
import { visitWhereOperation } from "../visitors/where/index.js";
import { visitSelectOperation } from "../visitors/select/index.js";
import { visitOrderByOperation, visitThenByOperation } from "../visitors/orderby/index.js";
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
  ast: ASTExpression,
  startCounter?: number,
  existingAutoParams?: Map<string, unknown>,
): {
  operation: QueryOperation | null;
  autoParams: Record<string, unknown>;
  autoParamInfos?: Record<
    string,
    { value: unknown; fieldName?: string; tableName?: string; sourceTable?: number }
  >;
} {
  // Extract parameter info from the lambda
  const { tableParams, queryParams } = extractParameters(ast);

  // Create shared visitor context
  const visitorContext: VisitorContext = {
    tableParams: new Set(tableParams),
    queryParams: new Set(queryParams),
    autoParams: existingAutoParams || new Map(),
    autoParamCounter: startCounter || 0,
    autoParamInfos: new Map(), // Initialize enhanced field context tracking
  };

  // Visit the query chain
  const operation = visitQueryChain(ast, visitorContext);

  // Extract auto-params for return
  const allAutoParams: Record<string, unknown> = Object.fromEntries(visitorContext.autoParams);

  // Extract enhanced parameter info if available
  const autoParamInfos = visitorContext.autoParamInfos
    ? Object.fromEntries(visitorContext.autoParamInfos)
    : undefined;

  return {
    operation,
    autoParams: allAutoParams,
    autoParamInfos,
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
  visitorContext: VisitorContext,
): QueryOperation | null {
  // If it's an arrow function, visit its body
  if (ast.type === "ArrowFunctionExpression") {
    const arrow = ast as ArrowFunctionExpression;
    const body = arrow.body;

    // Handle block statement body
    if (body.type === "BlockStatement") {
      // Look for return statement
      const returnStmt = body.body.find(
        (stmt: unknown) => (stmt as { type?: string }).type === "ReturnStatement",
      );
      if (returnStmt) {
        const returnExpr = (returnStmt as { argument?: ASTExpression }).argument;
        if (returnExpr) {
          return visitQueryChain(returnExpr, visitorContext);
        }
      }
    } else {
      // Expression body
      return visitQueryChain(body, visitorContext);
    }
  }

  // Handle call expressions (method calls)
  if (ast.type === "CallExpression") {
    return visitCallExpression(ast as ASTCallExpression, visitorContext);
  }

  return null;
}

/**
 * Visit a call expression (method call)
 */
function visitCallExpression(
  ast: ASTCallExpression,
  visitorContext: VisitorContext,
): QueryOperation | null {
  const methodName = getMethodName(ast);
  if (!methodName) return null;

  // Handle FROM (root operation)
  if (methodName === "from") {
    const operation = visitFromOperation(ast);
    // Set current table in context for field tracking
    if (operation) {
      visitorContext.currentTable = operation.table;
    }
    // FROM doesn't have auto-params
    return operation;
  }

  // For chained operations, first process the source
  if (ast.callee.type === "MemberExpression") {
    const memberExpr = ast.callee as ASTMemberExpression;
    const source = visitQueryChain(memberExpr.object, visitorContext);

    if (!source) return null;

    // Visit specific operation based on method name
    switch (methodName) {
      case "where": {
        const result = visitWhereOperation(ast, source, visitorContext);
        if (result) {
          // Merge auto-params back into context
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "select":
      case "selectMany": {
        const result = visitSelectOperation(ast, source, visitorContext);
        if (result) {
          // Merge auto-params back into context
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "orderBy":
      case "orderByDescending": {
        const result = visitOrderByOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "thenBy":
      case "thenByDescending": {
        const result = visitThenByOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "take": {
        const result = visitTakeOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "skip": {
        const result = visitSkipOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "distinct": {
        const result = visitDistinctOperation(ast, source, methodName, visitorContext);
        if (result) {
          // No auto-params for distinct
          return result.operation;
        }
        return null;
      }

      case "join": {
        const result = visitJoinOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }

          // Update context with JOIN result shape for subsequent operations
          const joinOp = result.operation as JoinOperation & { resultShape?: ResultShape };
          if (joinOp.resultShape) {
            visitorContext.currentResultShape = joinOp.resultShape;
            // Create a virtual table parameter for the JOIN result
            visitorContext.joinResultParam = "$joinResult";
            visitorContext.tableParams.add("$joinResult");
          }

          return result.operation;
        }
        return null;
      }

      case "groupBy": {
        const result = visitGroupByOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "count": {
        const result = visitCountOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "sum": {
        const result = visitSumOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "average":
      case "avg": {
        const result = visitAverageOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "min": {
        const result = visitMinOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "max": {
        const result = visitMaxOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "first":
      case "firstOrDefault": {
        const result = visitFirstOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "single":
      case "singleOrDefault": {
        const result = visitSingleOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "last":
      case "lastOrDefault": {
        const result = visitLastOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "any": {
        const result = visitAnyOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "all": {
        const result = visitAllOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context if any
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "contains": {
        const result = visitContainsOperation(ast, source, methodName, visitorContext);
        if (result) {
          // Merge auto-params back into context
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "reverse": {
        const result = visitReverseOperation(ast, source, methodName, visitorContext);
        if (result) {
          // No auto-params for reverse
          return result.operation;
        }
        return null;
      }

      case "toArray":
      case "toList": {
        const result = visitToArrayOperation(ast, source, methodName, visitorContext);
        if (result) {
          // No auto-params for toArray
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
