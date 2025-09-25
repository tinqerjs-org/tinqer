/**
 * Boolean method visitor for WHERE clauses
 * Handles method calls that return boolean values
 */

import type {
  BooleanExpression,
  ValueExpression,
  InExpression,
} from "../../expressions/expression.js";
import type {
  CallExpression,
  MemberExpression,
  Identifier,
  Expression as ASTExpression,
  ParenthesizedExpression,
  ChainExpression,
  ArrayExpression,
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
    const chain = calleeNode as { expression?: ASTExpression };
    if (chain.expression) {
      calleeNode = chain.expression;
    }
  }

  if (calleeNode.type !== "MemberExpression") return { value: null, counter: currentCounter };

  const memberCallee = calleeNode as MemberExpression;
  if (memberCallee.property.type !== "Identifier") return { value: null, counter: currentCounter };

  const methodName = (memberCallee.property as Identifier).name;

  // Unwrap the object to handle parentheses and optional chaining
  let objectNode = memberCallee.object as ASTExpression;
  while (objectNode.type === "ParenthesizedExpression" || objectNode.type === "ChainExpression") {
    if (objectNode.type === "ParenthesizedExpression") {
      objectNode = (objectNode as ParenthesizedExpression).expression;
    } else if (objectNode.type === "ChainExpression") {
      objectNode = (objectNode as ChainExpression).expression;
    }
  }

  // Array includes method (for IN operator)
  if (methodName === "includes") {
    // Check if this is an array literal
    if (objectNode.type === "ArrayExpression") {
      // This is array.includes(value) which translates to SQL IN
      const arrayNode = objectNode as ArrayExpression;
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
            } as InExpression,
            counter: currentCounter,
          };
        }
      }
      return { value: null, counter: currentCounter };
    }

    // Check if this might be a parameter array (e.g., params.targetIds.includes(u.id))
    // We need to check if the object is a parameter expression
    const objResult = visitValue(memberCallee.object, {
      ...context,
      autoParamCounter: currentCounter,
    });

    if (objResult.value && node.arguments && node.arguments.length > 0) {
      currentCounter = objResult.counter;

      // Parse the argument (the value being checked)
      const valueResult = visitValue(node.arguments[0] as ASTExpression, {
        ...context,
        autoParamCounter: currentCounter,
      });

      if (valueResult.value) {
        currentCounter = valueResult.counter;

        // If the object is a parameter, treat this as an IN operation
        if (objResult.value.type === "param") {
          return {
            value: {
              type: "in",
              value: valueResult.value,
              list: objResult.value, // The parameter is the array
            } as InExpression,
            counter: currentCounter,
          };
        }
      }
    }
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
