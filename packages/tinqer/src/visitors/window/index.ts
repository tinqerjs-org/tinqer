/**
 * Window function visitor
 * Handles h.window.partitionBy(...).orderBy(...).rowNumber() chains
 */

import type {
  WindowFunctionExpression,
  ValueExpression,
  Expression,
} from "../../expressions/expression.js";
import type {
  CallExpression,
  MemberExpression,
  Identifier,
  Expression as ASTExpression,
  ArrowFunctionExpression,
} from "../../parser/ast-types.js";
import type { WindowFunctionType } from "../../linq/functions.js";
import type { VisitorContext } from "../types.js";
import { getParameterName, getReturnExpression, isValueExpression } from "../utils.js";

interface WindowMethodCall {
  method: string;
  args: ASTExpression[];
}

/**
 * Check if this call expression is a window function chain
 * Returns the function type if it is, null otherwise
 */
export function isWindowFunctionCall(
  node: CallExpression,
  context: VisitorContext,
): WindowFunctionType | null {
  if (!context.helpersParam) return null;

  // Walk backwards through the call chain to find the start
  let current: ASTExpression = node;
  const chain: string[] = [];

  while (current.type === "CallExpression") {
    const callExpr = current as CallExpression;
    if (callExpr.callee.type !== "MemberExpression") break;

    const memberExpr = callExpr.callee as MemberExpression;
    if (memberExpr.property.type !== "Identifier") break;

    const methodName = (memberExpr.property as Identifier).name;
    chain.unshift(methodName);
    current = memberExpr.object;
  }

  // Now current should be the helpers param (h), and chain should start with "window"
  if (current.type !== "Identifier") return null;
  const identifier = current as Identifier;

  if (identifier.name !== context.helpersParam) return null;

  // Check if chain starts with "window"
  if (chain.length === 0 || chain[0] !== "window") return null;

  // Remove "window" from the chain since it's not a method we need to process
  chain.shift();

  // Check if last method is a terminal window function
  if (chain.length === 0) return null;
  const lastMethod = chain[chain.length - 1]!;

  if (lastMethod === "rowNumber") return "rowNumber";
  if (lastMethod === "rank") return "rank";
  if (lastMethod === "denseRank") return "denseRank";

  return null;
}

/**
 * Extract method calls from the chain
 */
function extractChain(node: CallExpression): WindowMethodCall[] {
  const chain: WindowMethodCall[] = [];
  let current: ASTExpression = node;

  while (current.type === "CallExpression") {
    const callExpr = current as CallExpression;
    if (callExpr.callee.type !== "MemberExpression") break;

    const memberExpr = callExpr.callee as MemberExpression;
    if (memberExpr.property.type !== "Identifier") break;

    const methodName = (memberExpr.property as Identifier).name;
    chain.unshift({
      method: methodName,
      args: callExpr.arguments as ASTExpression[],
    });
    current = memberExpr.object;
  }

  return chain;
}

/**
 * Parse a selector lambda to ValueExpression
 */
function parseSelector(
  lambda: ASTExpression,
  context: VisitorContext,
  visitExpression: (node: ASTExpression, ctx: VisitorContext) => Expression | null,
): ValueExpression | null {
  if (lambda.type !== "ArrowFunctionExpression") return null;

  const arrowFn = lambda as ArrowFunctionExpression;
  const paramName = getParameterName(arrowFn);
  if (!paramName) return null;

  // Add parameter to context
  const newContext = {
    ...context,
    tableParams: new Set([...context.tableParams, paramName]),
  };

  // Get body expression
  const bodyExpr =
    arrowFn.body.type === "BlockStatement" ? getReturnExpression(arrowFn.body.body) : arrowFn.body;

  if (!bodyExpr) return null;

  const expr = visitExpression(bodyExpr as ASTExpression, newContext);
  if (expr && isValueExpression(expr)) {
    return expr as ValueExpression;
  }

  return null;
}

/**
 * Visit window function call chain and build WindowFunctionExpression
 */
export function visitWindowFunction(
  node: CallExpression,
  functionType: WindowFunctionType,
  context: VisitorContext,
  visitExpression: (node: ASTExpression, ctx: VisitorContext) => Expression | null,
): WindowFunctionExpression | null {
  const chain = extractChain(node);

  const partitionBy: ValueExpression[] = [];
  const orderBy: Array<{ expression: ValueExpression; direction: "asc" | "desc" }> = [];

  // Process all methods except the last one (which is the terminal function)
  for (let i = 0; i < chain.length - 1; i++) {
    const call = chain[i]!;

    switch (call.method) {
      case "partitionBy":
        for (const arg of call.args) {
          const selector = parseSelector(arg, context, visitExpression);
          if (selector) partitionBy.push(selector);
        }
        break;

      case "orderBy":
        if (call.args.length > 0) {
          const selector = parseSelector(call.args[0]!, context, visitExpression);
          if (selector) orderBy.push({ expression: selector, direction: "asc" });
        }
        break;

      case "orderByDescending":
        if (call.args.length > 0) {
          const selector = parseSelector(call.args[0]!, context, visitExpression);
          if (selector) orderBy.push({ expression: selector, direction: "desc" });
        }
        break;

      case "thenBy":
        if (call.args.length > 0) {
          const selector = parseSelector(call.args[0]!, context, visitExpression);
          if (selector) orderBy.push({ expression: selector, direction: "asc" });
        }
        break;

      case "thenByDescending":
        if (call.args.length > 0) {
          const selector = parseSelector(call.args[0]!, context, visitExpression);
          if (selector) orderBy.push({ expression: selector, direction: "desc" });
        }
        break;
    }
  }

  // Validate orderBy is present
  if (orderBy.length === 0) {
    throw new Error(
      `Window function ${functionType}() requires at least one orderBy() or orderByDescending() call`,
    );
  }

  return {
    type: "windowFunction" as const,
    function: functionType,
    partitionBy,
    orderBy,
  };
}
