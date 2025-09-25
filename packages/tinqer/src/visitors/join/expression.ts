/**
 * JOIN expression visitor
 * Handles expressions within JOIN context with parameter tracking
 */

import type { Expression } from "../../expressions/expression.js";
import type {
  Expression as ASTExpression,
  MemberExpression,
  Literal,
} from "../../parser/ast-types.js";
import type { JoinContext } from "./context.js";

/**
 * Visit expressions in JOIN context with parameter tracking
 */
export function visitJoinExpression(
  node: ASTExpression,
  context: JoinContext,
  startCounter: number,
): { value: Expression | null; autoParams: Record<string, unknown>; counter: number } {
  let currentCounter = startCounter;
  const autoParams: Record<string, unknown> = {};

  switch (node.type) {
    case "MemberExpression": {
      const member = node as MemberExpression;

      if (member.object.type === "Identifier" && member.property.type === "Identifier") {
        const objName = member.object.name;
        const propName = member.property.name;

        // Check if this is a JOIN parameter
        if (context.joinParams?.has(objName)) {
          const tableIndex = context.joinParams.get(objName);
          return {
            value: {
              type: "column",
              name: propName,
              table: `$param${tableIndex}`, // Mark with table index
            },
            autoParams,
            counter: currentCounter,
          };
        }

        // Regular table parameter
        if (context.tableParams.has(objName)) {
          return {
            value: {
              type: "column",
              name: propName,
              table: objName,
            },
            autoParams,
            counter: currentCounter,
          };
        }
      }
      break;
    }

    case "Literal": {
      const lit = node as Literal;
      currentCounter++;
      const paramName = `__p${currentCounter}`;
      autoParams[paramName] = lit.value;

      return {
        value: {
          type: "param",
          param: paramName,
        },
        autoParams,
        counter: currentCounter,
      };
    }

    // Add more cases as needed
  }

  return { value: null, autoParams, counter: currentCounter };
}
