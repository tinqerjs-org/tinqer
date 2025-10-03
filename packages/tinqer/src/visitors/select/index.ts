/**
 * SELECT operation visitor
 * Orchestrates projection parsing for SELECT clauses
 */

import type {
  SelectOperation,
  QueryOperation,
  GroupByOperation,
} from "../../query-tree/operations.js";
import type {
  ValueExpression,
  ObjectExpression,
  Expression,
  AllColumnsExpression,
} from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  Expression as ASTExpression,
  Identifier,
} from "../../parser/ast-types.js";

import { visitProjection } from "./projection.js";
import { createSelectContext } from "./context.js";
import { VisitorContext } from "../types.js";

/**
 * Visit SELECT operation
 * Produces SelectOperation with projection expression
 */
export function visitSelectOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  visitorContext: VisitorContext,
): { operation: SelectOperation; autoParams: Record<string, unknown> } | null {
  // SELECT expects a lambda: select(x => x.name) or select(x => ({ id: x.id, name: x.name }))
  if (!ast.arguments || ast.arguments.length === 0) {
    return null;
  }

  const lambdaArg = ast.arguments[0];
  if (!lambdaArg || lambdaArg.type !== "ArrowFunctionExpression") {
    return null;
  }

  const lambda = lambdaArg as ArrowFunctionExpression;

  // Create SELECT-specific context with current param counter
  const context = createSelectContext(
    visitorContext.tableParams,
    visitorContext.queryParams,
    visitorContext.autoParamCounter,
  );
  context.inProjection = true;

  // Pass JOIN context if available
  if (visitorContext.joinResultParam) {
    context.joinResultParam = visitorContext.joinResultParam;
    context.currentResultShape = visitorContext.currentResultShape;
    context.joinParams = visitorContext.joinParams;
  }

  // Check if source is a GROUP BY operation
  if (source.operationType === "groupBy") {
    context.isGroupedSource = true;
    // Store the GROUP BY key expression for reference
    const groupByOp = source as GroupByOperation;
    context.groupKeyExpression = groupByOp.keySelector;
  }

  // Add lambda parameter to context
  if (lambda.params && lambda.params.length > 0) {
    const firstParam = lambda.params[0];
    if (firstParam && firstParam.type === "Identifier") {
      const paramName = (firstParam as Identifier).name;

      if (context.isGroupedSource) {
        // In grouped context, parameter represents a grouping, not a row
        context.groupingParams.add(paramName);
      } else {
        context.tableParams.add(paramName);
        context.hasTableParam = true;
      }
    } else {
      context.hasTableParam = false;
    }
  } else {
    context.hasTableParam = false;
  }

  // Extract body expression
  let bodyExpr: ASTExpression | null = null;
  if (lambda.body.type === "BlockStatement") {
    // Look for return statement
    const returnStmt = lambda.body.body.find(
      (stmt: unknown) => (stmt as { type?: string }).type === "ReturnStatement",
    );
    if (returnStmt) {
      bodyExpr = (returnStmt as { argument?: ASTExpression }).argument || null;
    }
  } else {
    bodyExpr = lambda.body;
  }

  if (!bodyExpr) {
    return null;
  }

  // Check for identity projection (select(u => u))
  if (bodyExpr.type === "Identifier") {
    const identifierName = (bodyExpr as Identifier).name;
    // If the body is just the table parameter, it's an identity projection
    if (context.tableParams.has(identifierName) && context.hasTableParam) {
      // Return AllColumnsExpression for SELECT *
      const allColumns: AllColumnsExpression = { type: "allColumns" };
      return {
        operation: {
          type: "queryOperation",
          operationType: "select",
          source,
          selector: allColumns as ValueExpression,
        },
        autoParams: Object.fromEntries(context.autoParams),
      };
    }
  }

  // Visit projection expression
  const selector = visitProjection(bodyExpr, context);

  if (!selector) {
    return null;
  }

  // Validate expressions in SELECT
  if (selector) {
    // Check if selector contains any actual table column references
    const hasTableReference = checkHasTableReference(selector);

    // Check for complex expressions without table references
    if (!hasTableReference) {
      // Object expressions with computed properties (concat/arithmetic) must reference table columns
      if (selector.type === "object") {
        const objExpr = selector as ObjectExpression;
        for (const prop of Object.values(objExpr.properties)) {
          if (prop && (prop.type === "concat" || prop.type === "arithmetic")) {
            throw new Error("Expressions in SELECT must reference table columns");
          }
        }
      }
      // Direct concat/arithmetic expressions must reference table columns
      else if (selector.type === "concat" || selector.type === "arithmetic") {
        throw new Error("Expressions in SELECT must reference table columns");
      }
    }
  }

  // Update the global counter with the final value from this visitor
  visitorContext.autoParamCounter = context.autoParamCounter;

  return {
    operation: {
      type: "queryOperation",
      operationType: "select",
      source,
      selector: selector as ValueExpression | ObjectExpression,
    },
    autoParams: Object.fromEntries(context.autoParams),
  };
}

/**
 * Check if an expression contains any table column references
 */
function checkHasTableReference(expr: Expression): boolean {
  if (!expr) return false;

  switch (expr.type) {
    case "column":
      return true;

    case "object": {
      const objExpr = expr as ObjectExpression;
      return Object.values(objExpr.properties).some((prop) => checkHasTableReference(prop));
    }

    case "concat":
    case "arithmetic": {
      const binExpr = expr as { left: Expression; right: Expression };
      return checkHasTableReference(binExpr.left) || checkHasTableReference(binExpr.right);
    }

    case "coalesce": {
      const coalExpr = expr as { expressions: Expression[] };
      return coalExpr.expressions.some((e) => checkHasTableReference(e));
    }

    case "conditional": {
      const condExpr = expr as { condition: Expression; then: Expression; else: Expression };
      return (
        checkHasTableReference(condExpr.condition) ||
        checkHasTableReference(condExpr.then) ||
        checkHasTableReference(condExpr.else)
      );
    }

    case "stringMethod": {
      const methodExpr = expr as { object: Expression };
      return checkHasTableReference(methodExpr.object);
    }

    case "aggregate": {
      const aggExpr = expr as { expression?: Expression };
      return aggExpr.expression ? checkHasTableReference(aggExpr.expression) : false;
    }

    case "param":
    case "constant":
      return false;

    default:
      return false;
  }
}
