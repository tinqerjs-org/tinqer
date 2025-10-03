/**
 * AST to QueryOperation visitor
 * Main entry point for the visitor-based parsing system
 */

import type {
  QueryOperation,
  JoinOperation,
  ResultShape,
  InsertOperation,
  UpdateOperation,
  DeleteOperation,
} from "../query-tree/operations.js";
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

// Data modification visitors
import { visitInsertOperation } from "../visitors/insert/index.js";
import { visitValuesOperation } from "../visitors/insert/values.js";
import { visitReturningOperation } from "../visitors/insert/returning.js";
import { visitUpdateOperation } from "../visitors/update/index.js";
import { visitSetOperation } from "../visitors/update/set.js";
import { visitWhereUpdateOperation } from "../visitors/update/where-update.js";
import { visitAllowFullUpdateOperation } from "../visitors/update/allow-full-update.js";
import { visitReturningUpdateOperation } from "../visitors/update/returning-update.js";
import { visitDeleteOperation } from "../visitors/delete/index.js";
import { visitWhereDeleteOperation } from "../visitors/delete/where-delete.js";
import { visitAllowFullDeleteOperation } from "../visitors/delete/allow-full-delete.js";

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
  const { tableParams, queryParams, helpersParam } = extractParameters(ast);

  // Create shared visitor context
  const visitorContext: VisitorContext = {
    tableParams: new Set(tableParams),
    queryParams: new Set(queryParams),
    helpersParam,
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
 * Extract table, query, and helpers parameters from the root lambda
 */
function extractParameters(ast: ASTExpression): {
  tableParams: Set<string>;
  queryParams: Set<string>;
  helpersParam?: string;
} {
  const tableParams = new Set<string>();
  const queryParams = new Set<string>();
  let helpersParam: string | undefined;

  // Check if the root is an arrow function with params
  // For queries like: () => from(...).where(...)
  // Or: (p) => from(...).where(x => x.id == p.minId)
  // Or: (p, _) => from(...).where(x => _.functions.iequals(x.name, "john"))
  if (ast.type === "ArrowFunctionExpression") {
    const arrow = ast as ArrowFunctionExpression;
    if (arrow.params && arrow.params.length > 0) {
      // First param is query params
      const firstParam = arrow.params[0];
      if (firstParam && firstParam.type === "Identifier") {
        queryParams.add((firstParam as Identifier).name);
      }

      // Second param is helpers
      if (arrow.params.length > 1) {
        const secondParam = arrow.params[1];
        if (secondParam && secondParam.type === "Identifier") {
          helpersParam = (secondParam as Identifier).name;
        }
      }
    }
    // For parameterless lambdas, no query params or helpers
  }

  return { tableParams, queryParams, helpersParam };
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

  // Handle root operations
  if (methodName === "from") {
    const operation = visitFromOperation(ast);
    // Set current table in context for field tracking
    if (operation) {
      visitorContext.currentTable = operation.table;
    }
    // FROM doesn't have auto-params
    return operation;
  }

  if (methodName === "insertInto") {
    const operation = visitInsertOperation(ast);
    // Set current table in context for field tracking
    if (operation) {
      visitorContext.currentTable = operation.table;
    }
    return operation;
  }

  if (methodName === "updateTable") {
    const operation = visitUpdateOperation(ast);
    // Set current table in context for field tracking
    if (operation) {
      visitorContext.currentTable = operation.table;
    }
    return operation;
  }

  if (methodName === "deleteFrom") {
    const operation = visitDeleteOperation(ast);
    // Set current table in context for field tracking
    if (operation) {
      visitorContext.currentTable = operation.table;
    }
    return operation;
  }

  // For chained operations, first process the source
  if (ast.callee.type === "MemberExpression") {
    const memberExpr = ast.callee as ASTMemberExpression;
    const source = visitQueryChain(memberExpr.object, visitorContext);

    if (!source) {
      return null;
    }

    // Visit specific operation based on method name
    switch (methodName) {
      case "where": {
        // Handle WHERE for UPDATE and DELETE operations differently
        if (source.operationType === "update") {
          const result = visitWhereUpdateOperation(ast, source as UpdateOperation, visitorContext);
          if (result) {
            for (const [key, value] of Object.entries(result.autoParams)) {
              visitorContext.autoParams.set(key, value);
            }
            return result.operation;
          }
          return null;
        } else if (source.operationType === "delete") {
          const result = visitWhereDeleteOperation(ast, source as DeleteOperation, visitorContext);
          if (result) {
            for (const [key, value] of Object.entries(result.autoParams)) {
              visitorContext.autoParams.set(key, value);
            }
            return result.operation;
          }
          return null;
        }

        // Regular WHERE for SELECT operations
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

      // INSERT operations
      case "values": {
        if (source.operationType !== "insert") {
          throw new Error("values() can only be called on INSERT operations");
        }
        const result = visitValuesOperation(ast, source as InsertOperation, visitorContext);
        if (result) {
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "returning": {
        if (source.operationType === "insert") {
          const result = visitReturningOperation(ast, source as InsertOperation, visitorContext);
          if (result) {
            for (const [key, value] of Object.entries(result.autoParams)) {
              visitorContext.autoParams.set(key, value);
            }
            return result.operation;
          }
          return null;
        } else if (source.operationType === "update") {
          const result = visitReturningUpdateOperation(
            ast,
            source as UpdateOperation,
            visitorContext,
          );
          if (result) {
            for (const [key, value] of Object.entries(result.autoParams)) {
              visitorContext.autoParams.set(key, value);
            }
            return result.operation;
          }
          return null;
        }
        throw new Error("returning() can only be called on INSERT or UPDATE operations");
      }

      // UPDATE operations
      case "set": {
        if (source.operationType !== "update") {
          throw new Error("set() can only be called on UPDATE operations");
        }
        const result = visitSetOperation(ast, source as UpdateOperation, visitorContext);
        if (result) {
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      case "allowFullTableUpdate": {
        if (source.operationType !== "update") {
          throw new Error("allowFullTableUpdate() can only be called on UPDATE operations");
        }
        const result = visitAllowFullUpdateOperation(ast, source as UpdateOperation);
        if (result) {
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      // DELETE operations
      case "allowFullTableDelete": {
        if (source.operationType !== "delete") {
          throw new Error("allowFullTableDelete() can only be called on DELETE operations");
        }
        const result = visitAllowFullDeleteOperation(ast, source as DeleteOperation);
        if (result) {
          for (const [key, value] of Object.entries(result.autoParams)) {
            visitorContext.autoParams.set(key, value);
          }
          return result.operation;
        }
        return null;
      }

      default:
        // Handle WHERE based on source type
        if (methodName === "where") {
          if (source.operationType === "update") {
            const result = visitWhereUpdateOperation(
              ast,
              source as UpdateOperation,
              visitorContext,
            );
            if (result) {
              for (const [key, value] of Object.entries(result.autoParams)) {
                visitorContext.autoParams.set(key, value);
              }
              return result.operation;
            }
            return null;
          } else if (source.operationType === "delete") {
            const result = visitWhereDeleteOperation(
              ast,
              source as DeleteOperation,
              visitorContext,
            );
            if (result) {
              for (const [key, value] of Object.entries(result.autoParams)) {
                visitorContext.autoParams.set(key, value);
              }
              return result.operation;
            }
            return null;
          }
        }
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
