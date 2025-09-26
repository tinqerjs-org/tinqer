/**
 * JOIN result selector visitor
 * Handles result selector expressions in JOIN operations
 */

import type { Expression } from "../../expressions/expression.js";
import type {
  Expression as ASTExpression,
  ParenthesizedExpression,
  ObjectExpression as ASTObjectExpression,
  MemberExpression,
  Identifier,
  Property,
} from "../../parser/ast-types.js";
import type { JoinContext } from "./context.js";
import { visitJoinExpression } from "./expression.js";

/**
 * Validate that a property value in JOIN result selector is allowed
 */
function validateJoinResultProperty(
  value: ASTExpression,
  propertyName: string,
  context: JoinContext,
): void {
  // Remove parentheses
  let expr = value;
  while (expr.type === "ParenthesizedExpression") {
    expr = (expr as ParenthesizedExpression).expression;
  }

  // Check allowed patterns:
  // 1. Direct table reference: d (where d is a JOIN parameter)
  // 2. Reference from joined object: joined.d (where joined is outer param)
  // 3. Spread is handled separately

  if (expr.type === "Identifier") {
    const identName = (expr as Identifier).name;

    // Check if this is the previous JOIN result parameter
    if (context.joinResultParam === identName) {
      return; // Valid - it's the previous JOIN result
    }

    // Otherwise must be a JOIN parameter (u, d, o, etc.)
    if (!context.joinParams?.has(identName)) {
      throw new Error(
        `Invalid value for property '${propertyName}' in JOIN result selector. ` +
          `'${identName}' is not a table reference. ` +
          `Only table references are allowed (e.g., { user: u, dept: d })`,
      );
    }
    return; // Valid
  }

  if (expr.type === "MemberExpression") {
    const memberExpr = expr as MemberExpression;
    if (memberExpr.object.type === "Identifier" && memberExpr.property.type === "Identifier") {
      const objName = (memberExpr.object as Identifier).name;

      // Check if this is accessing a property from the joined result
      if (context.joinResultParam === objName) {
        // This is like joined.u or joined.dept - valid
        return;
      }
    }
  }

  // Any other pattern is invalid
  throw new Error(
    `Invalid value for property '${propertyName}' in JOIN result selector. ` +
      `Only table references are allowed. Valid patterns: ` +
      `{ u: u, d: d } or { user: joined.u, dept: joined.d } or { ...joined, o: o }. ` +
      `No computed values, field selections, or complex expressions allowed.`,
  );
}

/**
 * Visit JOIN result selector with proper parameter tracking
 */
export function visitJoinResultSelector(
  node: ASTExpression,
  context: JoinContext,
  startCounter: number,
): { expression: Expression | null; autoParams: Record<string, unknown>; counter: number } | null {
  let currentCounter = startCounter;
  const autoParams: Record<string, unknown> = {};

  // Unwrap parenthesized expressions
  let expr = node;
  while (expr.type === "ParenthesizedExpression") {
    expr = (expr as ParenthesizedExpression).expression;
  }

  // Handle object expressions
  if (expr.type === "ObjectExpression") {
    const properties: Record<string, Expression> = {};
    const objExpr = expr as ASTObjectExpression;

    // The properties array can contain both Property and SpreadElement
    // even though the type says Property[]
    type PropertyOrSpread = Property | { type: "SpreadElement"; argument: ASTExpression };
    for (const prop of objExpr.properties as PropertyOrSpread[]) {
      if (prop.type === "SpreadElement") {
        // Handle spread operator: ...joined
        const spreadArg = prop.argument;
        if (spreadArg && spreadArg.type === "Identifier") {
          // This is spreading a parameter (like ...joined)
          // We'll handle this as copying all properties
          // For now, mark it as a special case
          const valueExpr = visitJoinExpression(spreadArg, context, currentCounter);
          if (valueExpr && valueExpr.value) {
            // Store spread as a special marker
            properties["...spread"] = valueExpr.value;
            currentCounter = valueExpr.counter;
          }
        } else {
          throw new Error(
            "Invalid spread in JOIN result selector. " +
              "Only spreading of the joined parameter is allowed (e.g., ...joined)",
          );
        }
      } else if (prop.type === "Property" && prop.key.type === "Identifier") {
        const key = prop.key.name;

        // Validate the property value is allowed in JOIN result selector
        validateJoinResultProperty(prop.value, key, context);

        const valueExpr = visitJoinExpression(prop.value, context, currentCounter);

        if (valueExpr && valueExpr.value) {
          properties[key] = valueExpr.value;
          currentCounter = valueExpr.counter;
          Object.assign(autoParams, valueExpr.autoParams);
        }
      } else {
        throw new Error(
          "Invalid property type in JOIN result selector. " +
            "Only simple property assignments and spread are allowed",
        );
      }
    }

    return {
      expression: {
        type: "object",
        properties,
      },
      autoParams,
      counter: currentCounter,
    };
  }

  // For non-object expressions, use the regular visitor
  const result = visitJoinExpression(expr, context, currentCounter);
  if (result) {
    return {
      expression: result.value,
      autoParams: result.autoParams,
      counter: result.counter,
    };
  }

  return null;
}
