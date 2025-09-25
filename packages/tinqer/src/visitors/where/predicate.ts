/**
 * WHERE predicate visitor
 * Converts AST expressions to BooleanExpression for WHERE clauses
 */

import type {
  BooleanExpression,
  ColumnExpression,
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
import { visitComparison } from "./comparison.js";
import { visitLogical } from "./logical.js";

/**
 * Visit a predicate expression in WHERE context
 * Returns BooleanExpression or null
 */
export function visitPredicate(
  node: ASTExpression,
  context: WhereContext,
): VisitorResult<BooleanExpression | null> {
  let currentCounter = context.autoParamCounter;

  if (!node) return { value: null, counter: currentCounter };

  switch (node.type) {
    case "BinaryExpression": {
      const binary = node as BinaryExpression;
      // Check if it's a comparison
      if (["==", "===", "!=", "!==", ">", ">=", "<", "<="].includes(binary.operator)) {
        return visitComparison(binary, context);
      }
      return { value: null, counter: currentCounter };
    }

    case "LogicalExpression": {
      return visitLogical(node as ASTLogicalExpression, context);
    }

    case "UnaryExpression": {
      const unary = node as UnaryExpression;
      if (unary.operator === "!") {
        const innerResult = visitPredicate(unary.argument, { ...context, autoParamCounter: currentCounter });
        if (innerResult.value) {
          return {
            value: {
              type: "not",
              expression: innerResult.value,
            },
            counter: innerResult.counter
          };
        }
      }
      return { value: null, counter: currentCounter };
    }

    case "MemberExpression": {
      // Boolean column (e.g., x.isActive)
      const column = visitColumnAccess(node as MemberExpression, context);
      if (column) {
        return {
          value: {
            type: "booleanColumn",
            name: column.name,
            ...(column.table && { table: column.table }),
          },
          counter: currentCounter
        };
      }
      return { value: null, counter: currentCounter };
    }

    case "CallExpression": {
      // Boolean methods like x.name.startsWith("John")
      const result = visitBooleanMethod(node as CallExpression, { ...context, autoParamCounter: currentCounter });
      return result;
    }

    case "Identifier": {
      // Direct boolean column reference
      const id = node as Identifier;
      if (context.tableParams.has(id.name)) {
        // This is a table parameter used as boolean
        return {
          value: {
            type: "booleanColumn",
            name: id.name,
          },
          counter: currentCounter
        };
      }
      return { value: null, counter: currentCounter };
    }

    case "Literal":
    case "BooleanLiteral": {
      // Boolean constant
      const lit = node as Literal;
      if (typeof lit.value === "boolean") {
        return {
          value: {
            type: "booleanConstant",
            value: lit.value,
          },
          counter: currentCounter
        };
      }
      return { value: null, counter: currentCounter };
    }

    case "ParenthesizedExpression": {
      // Unwrap parentheses
      const paren = node as { expression: ASTExpression };
      return visitPredicate(paren.expression, context);
    }

    default:
      return { value: null, counter: currentCounter };
  }
}

/**
 * Visit column access (e.g., x.name, x.address.city)
 */
export function visitColumnAccess(
  node: MemberExpression,
  context: WhereContext,
): ColumnExpression | null {
  if (!node.computed && node.property.type === "Identifier") {
    const propertyName = (node.property as Identifier).name;

    // Simple member access: x.name
    if (node.object.type === "Identifier") {
      const objectName = (node.object as Identifier).name;

      if (context.tableParams.has(objectName)) {
        return {
          type: "column",
          name: propertyName,
        };
      }
    }

    // Nested member access: x.address.city
    if (node.object.type === "MemberExpression") {
      const innerColumn = visitColumnAccess(node.object as MemberExpression, context);
      if (innerColumn) {
        return {
          type: "column",
          name: `${innerColumn.name}.${propertyName}`,
        };
      }
    }
  }

  return null;
}

/**
 * Visit value expression (for comparison operands)
 * Returns the value expression and the updated counter
 */
export function visitValue(
  node: ASTExpression,
  context: WhereContext
): VisitorResult<ValueExpression | null> {
  let currentCounter = context.autoParamCounter;

  switch (node.type) {
    case "MemberExpression": {
      const member = node as MemberExpression;

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
            counter: currentCounter
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
          counter: currentCounter
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
        counter: currentCounter
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
          counter: currentCounter
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
            counter: currentCounter
          };
        }
      }
      return { value: null, counter: currentCounter };
    }

    case "BinaryExpression": {
      const binary = node as BinaryExpression;
      // Arithmetic expression
      if (["+", "-", "*", "/", "%"].includes(binary.operator)) {
        // Recursively visit left and right
        const leftResult = visitValue(binary.left, { ...context, autoParamCounter: currentCounter });
        if (!leftResult.value) return { value: null, counter: currentCounter };
        currentCounter = leftResult.counter;

        const rightResult = visitValue(binary.right, { ...context, autoParamCounter: currentCounter });
        if (!rightResult.value) return { value: null, counter: currentCounter };
        currentCounter = rightResult.counter;

        return {
          value: {
            type: "arithmetic",
            operator: binary.operator as "+" | "-" | "*" | "/" | "%",
            left: leftResult.value,
            right: rightResult.value,
          } as ArithmeticExpression,
          counter: currentCounter
        };
      }
      return { value: null, counter: currentCounter };
    }

    default:
      return { value: null, counter: currentCounter };
  }
}

/**
 * Visit boolean method calls
 */
function visitBooleanMethod(node: CallExpression, context: WhereContext): VisitorResult<BooleanExpression | null> {
  let currentCounter = context.autoParamCounter;

  if (node.callee.type !== "MemberExpression") return { value: null, counter: currentCounter };

  const memberCallee = node.callee as MemberExpression;
  if (memberCallee.property.type !== "Identifier") return { value: null, counter: currentCounter };

  const methodName = (memberCallee.property as Identifier).name;

  // String boolean methods
  if (["startsWith", "endsWith", "includes", "contains"].includes(methodName)) {
    const objResult = visitValue(memberCallee.object, { ...context, autoParamCounter: currentCounter });
    if (!objResult.value) return { value: null, counter: currentCounter };
    currentCounter = objResult.counter;

    const args: ValueExpression[] = [];
    for (const arg of node.arguments) {
      const valueResult = visitValue(arg as ASTExpression, { ...context, autoParamCounter: currentCounter });
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
      counter: currentCounter
    };
  }

  return { value: null, counter: currentCounter };
}
