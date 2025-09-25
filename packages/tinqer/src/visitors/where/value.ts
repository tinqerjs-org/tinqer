/**
 * WHERE value expression visitor
 * Handles value expressions in WHERE clauses
 */

import type {
  ValueExpression,
  ParameterExpression,
  ArithmeticExpression,
} from "../../expressions/expression.js";

import type {
  Expression as ASTExpression,
  BinaryExpression,
  LogicalExpression as ASTLogicalExpression,
  UnaryExpression,
  MemberExpression,
  Identifier,
  Literal,
  CallExpression,
} from "../../parser/ast-types.js";

import type { WhereContext, VisitorResult } from "./context.js";
import { visitColumnAccess } from "./column.js";
import { visitPredicate } from "./predicate.js";
import { visitBooleanMethod } from "./boolean-method.js";
import { visitMemberAccess } from "../common/member-access.js";

/**
 * Visit value expression (for comparison operands)
 * Returns the value expression and the updated counter
 */
export function visitValue(
  node: ASTExpression,
  context: WhereContext,
): VisitorResult<ValueExpression | null> {
  let currentCounter = context.autoParamCounter;

  switch (node.type) {
    case "MemberExpression": {
      const member = node as MemberExpression;

      // First try using the common member access visitor which handles global constants
      const memberResult = visitMemberAccess(
        member,
        context as any, // WhereContext extends VisitorContext
        (n, ctx) => {
          const result = visitValue(n as ASTExpression, ctx as WhereContext);
          return result.value;
        }
      );
      if (memberResult && (memberResult.type === "param" || memberResult.type === "column")) {
        // Update counter if it's an auto-param (like Number.MAX_SAFE_INTEGER)
        if (memberResult.type === "param" && !memberResult.property) {
          // This is likely an auto-param, counter was already incremented internally
          currentCounter = context.autoParamCounter;
        }
        return { value: memberResult as ValueExpression, counter: currentCounter };
      }

      // Check if it's a query parameter member access (e.g., p.minAge)
      if (member.object.type === "Identifier") {
        const objectName = (member.object as Identifier).name;
        if (context.queryParams.has(objectName) && member.property.type === "Identifier") {
          // This is an external parameter like p.minAge - return as parameter
          const propertyName = (member.property as Identifier).name;
          return {
            value: {
              type: "param",
              param: objectName,
              property: propertyName,
            } as ParameterExpression,
            counter: currentCounter,
          };
        }
      }

      // Otherwise it's a column reference
      const column = visitColumnAccess(member, context);
      return { value: column, counter: currentCounter };
    }

    case "Literal":
    case "NumericLiteral":
    case "StringLiteral":
    case "BooleanLiteral":
    case "NullLiteral": {
      const lit = node as Literal;
      // NULL is special - not parameterized
      if (lit.value === null) {
        return {
          value: {
            type: "constant",
            value: null,
            valueType: "null",
          },
          counter: currentCounter,
        };
      }
      // Auto-parameterize other literals with field context if available
      currentCounter++;
      const paramName = `__p${currentCounter}`;
      context.autoParams.set(paramName, lit.value);

      // Store enhanced field context if available
      if (context.autoParamInfos) {
        context.autoParamInfos.set(paramName, {
          value: lit.value as string | number | boolean | null,
          fieldName: (context as any)._currentFieldName,
          tableName: (context as any)._currentTableName,
          sourceTable: (context as any)._currentSourceTable,
        });
      }

      return {
        value: {
          type: "param",
          param: paramName,
        } as ParameterExpression,
        counter: currentCounter,
      };
    }

    case "Identifier": {
      const id = node as Identifier;
      // Query parameter reference
      if (context.queryParams.has(id.name)) {
        return {
          value: {
            type: "param",
            param: id.name,
          } as ParameterExpression,
          counter: currentCounter,
        };
      }
      return { value: null, counter: currentCounter };
    }

    case "UnaryExpression": {
      const unary = node as UnaryExpression;
      // Negative number
      if (
        unary.operator === "-" &&
        (unary.argument.type === "NumericLiteral" || unary.argument.type === "Literal")
      ) {
        const lit = unary.argument as Literal;
        if (typeof lit.value === "number") {
          const value = -lit.value;
          currentCounter++;
          const paramName = `__p${currentCounter}`;
          context.autoParams.set(paramName, value);

          // Store enhanced field context if available
          if (context.autoParamInfos) {
            context.autoParamInfos.set(paramName, {
              value: value,
              fieldName: (context as any)._currentFieldName,
              tableName: (context as any)._currentTableName,
              sourceTable: (context as any)._currentSourceTable,
            });
          }

          return {
            value: {
              type: "param",
              param: paramName,
            } as ParameterExpression,
            counter: currentCounter,
          };
        }
      }
      return { value: null, counter: currentCounter };
    }

    case "ParenthesizedExpression": {
      // Unwrap parentheses and recurse
      const paren = node as { expression: ASTExpression };
      return visitValue(paren.expression, { ...context, autoParamCounter: currentCounter });
    }

    case "ConditionalExpression": {
      // Ternary operator: condition ? thenValue : elseValue
      const conditional = node as any;

      // Parse the condition
      const conditionResult = visitPredicate(conditional.test, {
        ...context,
        autoParamCounter: currentCounter,
      });
      if (!conditionResult.value) return { value: null, counter: currentCounter };
      currentCounter = conditionResult.counter;

      // Parse the then value
      const thenResult = visitValue(conditional.consequent, {
        ...context,
        autoParamCounter: currentCounter,
      });
      if (!thenResult.value) return { value: null, counter: currentCounter };
      currentCounter = thenResult.counter;

      // Parse the else value
      const elseResult = visitValue(conditional.alternate, {
        ...context,
        autoParamCounter: currentCounter,
      });
      if (!elseResult.value) return { value: null, counter: currentCounter };
      currentCounter = elseResult.counter;

      return {
        value: {
          type: "case",
          condition: conditionResult.value,
          then: thenResult.value,
          else: elseResult.value,
        } as any,
        counter: currentCounter,
      };
    }

    case "LogicalExpression": {
      const logical = node as ASTLogicalExpression;
      // Null coalescing operator
      if (logical.operator === "??") {
        // Visit left side
        const leftResult = visitValue(logical.left, {
          ...context,
          autoParamCounter: currentCounter,
        });
        if (!leftResult.value) return { value: null, counter: currentCounter };
        currentCounter = leftResult.counter;

        // Visit right side (default value)
        const rightResult = visitValue(logical.right, {
          ...context,
          autoParamCounter: currentCounter,
        });
        if (!rightResult.value) return { value: null, counter: currentCounter };
        currentCounter = rightResult.counter;

        return {
          value: {
            type: "coalesce",
            expressions: [leftResult.value, rightResult.value],
          } as any,
          counter: currentCounter,
        };
      }
      return { value: null, counter: currentCounter };
    }

    case "BinaryExpression": {
      const binary = node as BinaryExpression;
      // Arithmetic expression
      if (["+", "-", "*", "/", "%"].includes(binary.operator)) {
        // First check if left side is a column to get field context
        let fieldContext: any = {};
        if (binary.left.type === "MemberExpression") {
          const leftColumn = visitColumnAccess(binary.left as MemberExpression, context);
          if (leftColumn) {
            fieldContext = {
              _currentFieldName: leftColumn.name,
              _currentTableName: context.currentTable,
              _currentSourceTable: undefined,
            };
          }
        }

        // Create context with field info for literal processing
        const enhancedContext = { ...context, ...fieldContext, autoParamCounter: currentCounter };

        // Recursively visit left and right with enhanced context
        const leftResult = visitValue(binary.left, enhancedContext);
        if (!leftResult.value) return { value: null, counter: currentCounter };
        currentCounter = leftResult.counter;

        const rightResult = visitValue(binary.right, {
          ...enhancedContext,
          autoParamCounter: currentCounter,
        });
        if (!rightResult.value) return { value: null, counter: currentCounter };
        currentCounter = rightResult.counter;

        return {
          value: {
            type: "arithmetic",
            operator: binary.operator as "+" | "-" | "*" | "/" | "%",
            left: leftResult.value,
            right: rightResult.value,
          } as ArithmeticExpression,
          counter: currentCounter,
        };
      }
      return { value: null, counter: currentCounter };
    }

    case "CallExpression": {
      // Check if this is array.includes() for IN operator
      const result = visitBooleanMethod(node as CallExpression, {
        ...context,
        autoParamCounter: currentCounter,
      });
      // If it returns a boolean expression with type "in", extract just the value part
      if (result.value && (result.value as any).type === "in") {
        // Return null since IN is a boolean expression, not a value expression
        // The caller (visitPredicate) should handle this case
        return { value: null, counter: result.counter };
      }
      return { value: null, counter: currentCounter };
    }

    default:
      return { value: null, counter: currentCounter };
  }
}
