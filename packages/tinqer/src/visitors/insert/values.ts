/**
 * Visitor for INSERT .values() operation
 */

import type { InsertOperation } from "../../query-tree/operations.js";
import type { ObjectExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  ObjectExpression as ASTObjectExpression,
  Expression,
} from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { visitExpression } from "../index.js";

export interface ValuesVisitorResult {
  operation: InsertOperation;
  autoParams: Record<string, unknown>;
}

/**
 * Visit a .values() operation on an INSERT
 */
export function visitValuesOperation(
  ast: ASTCallExpression,
  source: InsertOperation,
  visitorContext: VisitorContext,
): ValuesVisitorResult | null {
  // .values({ column1: value1, column2: value2 }) or .values(() => ({ column1: value1, column2: value2 }))
  const args = ast.arguments;
  if (!args || args.length === 0) {
    return null;
  }

  const firstArg = args[0];
  if (!firstArg) {
    return null;
  }

  let bodyExpr: Expression = firstArg;

  // If it's a lambda (for backward compatibility or when using parameters), extract the body
  if (firstArg.type === "ArrowFunctionExpression") {
    const arrowFn = firstArg as ArrowFunctionExpression;
    let lambdaBody = arrowFn.body;

    // Handle block statement with return
    if (lambdaBody.type === "BlockStatement") {
      const returnStmt = lambdaBody.body?.find(
        (stmt: any) => stmt.type === "ReturnStatement",
      ) as any;
      if (!returnStmt || !returnStmt.argument) {
        throw new Error("values() lambda must return an object");
      }
      bodyExpr = returnStmt.argument as Expression;
    } else {
      bodyExpr = lambdaBody;
    }

    // Handle parenthesized expression (common pattern: () => ({ ... }))
    if (bodyExpr.type === "ParenthesizedExpression") {
      bodyExpr = (bodyExpr as { expression: Expression }).expression;
    }
  }

  // Must be an object expression
  if (bodyExpr.type !== "ObjectExpression") {
    throw new Error("values() must be an object literal or return an object literal");
  }

  // Visit the object expression to get column-value mappings
  const valuesExpr = visitExpression(bodyExpr as ASTObjectExpression, visitorContext);
  if (!valuesExpr || valuesExpr.type !== "object") {
    return null;
  }

  // Create updated INSERT operation with values
  const updatedOperation: InsertOperation = {
    ...source,
    values: valuesExpr as ObjectExpression,
  };

  return {
    operation: updatedOperation,
    autoParams: {},
  };
}
