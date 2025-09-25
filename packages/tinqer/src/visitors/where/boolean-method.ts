/**
 * Boolean method visitor for WHERE clauses
 * Handles method calls that return boolean values
 */

import type { BooleanExpression, ValueExpression } from "../../expressions/expression.js";
import type {
  CallExpression,
  MemberExpression,
  Identifier,
  Expression as ASTExpression,
} from "../../parser/ast-types.js";
import type { WhereContext, VisitorResult } from "./context.js";
import { visitValue } from "./value.js";

/**
 * Visit boolean method calls
 */
export function visitBooleanMethod(
  node: CallExpression,
  context: WhereContext,
): VisitorResult<BooleanExpression | null> {
  let currentCounter = context.autoParamCounter;

  // Handle optional chaining in callee
  let calleeNode = node.callee;
  if (calleeNode.type === "ChainExpression") {
    const chain = calleeNode as any;
    if (chain.expression) {
      calleeNode = chain.expression;
    }
  }

  if (calleeNode.type !== "MemberExpression") return { value: null, counter: currentCounter };

  const memberCallee = calleeNode as MemberExpression;
  if (memberCallee.property.type !== "Identifier") return { value: null, counter: currentCounter };

  const methodName = (memberCallee.property as Identifier).name;

  // Unwrap the object to handle parentheses, TypeScript casts, and optional chaining
  let objectNode = memberCallee.object as any;
  while (
    objectNode.type === "ParenthesizedExpression" ||
    objectNode.type === "TSAsExpression" ||
    objectNode.type === "ChainExpression"
  ) {
    if (objectNode.type === "ParenthesizedExpression") {
      objectNode = objectNode.expression;
    } else if (objectNode.type === "TSAsExpression") {
      objectNode = objectNode.expression;
    } else if (objectNode.type === "ChainExpression") {
      objectNode = objectNode.expression;
    }
  }

  // Array includes method (for IN operator)
  if (methodName === "includes" && objectNode.type === "ArrayExpression") {
    // This is array.includes(value) which translates to SQL IN
    const arrayNode = objectNode as any;
    const arrayValues: ValueExpression[] = [];

    // Parse array elements
    for (const element of arrayNode.elements) {
      if (element) {
        const elementResult = visitValue(element as ASTExpression, {
          ...context,
          autoParamCounter: currentCounter,
        });
        if (elementResult.value) {
          arrayValues.push(elementResult.value);
          currentCounter = elementResult.counter;
        }
      }
    }

    // Parse the argument (the value being checked)
    if (node.arguments && node.arguments.length > 0) {
      const valueResult = visitValue(node.arguments[0] as ASTExpression, {
        ...context,
        autoParamCounter: currentCounter,
      });

      if (valueResult.value) {
        currentCounter = valueResult.counter;
        return {
          value: {
            type: "in",
            value: valueResult.value,
            list: {
              type: "array",
              elements: arrayValues,
            },
          } as any,
          counter: currentCounter,
        };
      }
    }

    return { value: null, counter: currentCounter };
  }

  // String boolean methods
  if (["startsWith", "endsWith", "includes", "contains"].includes(methodName)) {
    const objResult = visitValue(memberCallee.object, {
      ...context,
      autoParamCounter: currentCounter,
    });
    if (!objResult.value) return { value: null, counter: currentCounter };
    currentCounter = objResult.counter;

    const args: ValueExpression[] = [];
    for (const arg of node.arguments) {
      const valueResult = visitValue(arg as ASTExpression, {
        ...context,
        autoParamCounter: currentCounter,
      });
      if (valueResult.value) {
        args.push(valueResult.value);
        currentCounter = valueResult.counter;
      }
    }

    return {
      value: {
        type: "booleanMethod",
        object: objResult.value,
        method: methodName as "startsWith" | "endsWith" | "includes" | "contains",
        arguments: args,
      },
      counter: currentCounter,
    };
  }

  return { value: null, counter: currentCounter };
}
