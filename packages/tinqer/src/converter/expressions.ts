/**
 * Expression conversion functions
 * Converts AST expressions to our Expression types
 */

import type {
  Expression,
  BooleanExpression,
  ValueExpression,
  ObjectExpression,
  ColumnExpression,
  ConstantExpression,
  ParameterExpression,
  ComparisonExpression,
  LogicalExpression,
  ArithmeticExpression,
  BooleanMethodExpression,
  ConcatExpression,
  StringMethodExpression,
  AggregateExpression,
} from "../expressions/expression.js";

import type {
  Expression as ASTExpression,
  Identifier,
  MemberExpression as ASTMemberExpression,
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  BinaryExpression as ASTBinaryExpression,
  LogicalExpression as ASTLogicalExpression,
  UnaryExpression as ASTUnaryExpression,
  ObjectExpression as ASTObjectExpression,
  Literal,
  NumericLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,
  ParenthesizedExpression,
} from "../parser/ast-types.js";

import type { ConversionContext } from "./converter-utils.js";
import {
  getParameterName,
  getReturnExpression,
  isBooleanExpression,
  isValueExpression,
  isLikelyStringColumn,
  isLikelyStringParam,
} from "./converter-utils.js";

/**
 * Converts an OXC AST to an Expression
 * This handles individual expressions within lambdas
 */
export function convertAstToExpression(
  ast: ASTExpression,
  context: ConversionContext,
): Expression | null {
  if (!ast) return null;

  switch (ast.type) {
    case "Identifier":
      return convertIdentifier(ast, context);

    case "MemberExpression":
      return convertMemberExpression(ast, context);

    case "BinaryExpression":
      return convertBinaryExpression(ast, context);

    case "LogicalExpression":
      return convertLogicalExpression(ast, context);

    case "Literal":
    case "NumericLiteral":
    case "StringLiteral":
    case "BooleanLiteral":
    case "NullLiteral":
      return convertLiteral(
        ast as Literal | NumericLiteral | StringLiteral | BooleanLiteral | NullLiteral,
      );

    case "CallExpression":
      return convertCallExpression(ast, context);

    case "ObjectExpression":
      return convertObjectExpression(ast, context);

    case "ArrowFunctionExpression":
      return convertLambdaExpression(ast, context);

    case "UnaryExpression": {
      const unaryExpr = ast as ASTUnaryExpression;
      if (unaryExpr.operator === "!") {
        const expr = convertAstToExpression(unaryExpr.argument, context);

        // Convert column to booleanColumn if needed
        let finalExpr = expr;
        if (expr && expr.type === "column") {
          finalExpr = {
            type: "booleanColumn",
            name: (expr as ColumnExpression).name,
          };
        }

        if (finalExpr && isBooleanExpression(finalExpr)) {
          return {
            type: "not",
            expression: finalExpr as BooleanExpression,
          };
        }
      }
      return null;
    }

    case "ParenthesizedExpression": {
      // Simply unwrap parentheses and process the inner expression
      const parenExpr = ast as ParenthesizedExpression;
      return convertAstToExpression(parenExpr.expression, context);
    }

    default:
      console.warn("Unsupported AST node type:", ast.type);
      return null;
  }
}

export function convertIdentifier(ast: Identifier, context: ConversionContext): Expression | null {
  const name = ast.name;

  // Check if it's a table parameter
  if (context.tableParams.has(name)) {
    // This shouldn't happen alone - identifiers are usually part of member expressions
    return null;
  }

  // Check if it's a query parameter
  if (context.queryParams.has(name)) {
    return {
      type: "param",
      param: name,
    } as ParameterExpression;
  }

  // Otherwise, it might be a column name (rare case)
  return {
    type: "column",
    name,
  } as ColumnExpression;
}

export function convertMemberExpression(
  ast: ASTMemberExpression,
  context: ConversionContext,
): Expression | null {
  // Check if both object and property are identifiers
  if (ast.object.type === "Identifier" && ast.property.type === "Identifier") {
    const objectName = (ast.object as Identifier).name;
    const propertyName = (ast.property as Identifier).name;

    // Check if the object is a table parameter (e.g., x.name where x is table param)
    if (context.tableParams.has(objectName)) {
      return {
        type: "column",
        name: propertyName,
      } as ColumnExpression;
    }

    // Check if it's a query parameter (e.g., p.minAge where p is query param)
    if (context.queryParams.has(objectName)) {
      return {
        type: "param",
        param: objectName,
        property: propertyName,
      } as ParameterExpression;
    }
  }

  // Nested member access (e.g., x.address.city)
  const obj = convertAstToExpression(ast.object, context);
  if (obj && obj.type === "column" && ast.property.type === "Identifier") {
    // Flatten nested column access
    const propertyName = (ast.property as Identifier).name;
    return {
      type: "column",
      name: `${(obj as ColumnExpression).name}.${propertyName}`,
    } as ColumnExpression;
  }

  return null;
}

export function convertBinaryExpression(
  ast: ASTBinaryExpression,
  context: ConversionContext,
): Expression | null {
  const left = convertAstToExpression(ast.left, context);
  const right = convertAstToExpression(ast.right, context);

  if (!left || !right) return null;

  const operator = ast.operator;

  // Comparison operators
  if (["==", "===", "!=", "!==", ">", ">=", "<", "<="].includes(operator)) {
    const op = operator === "===" ? "==" : operator === "!==" ? "!=" : operator;
    return {
      type: "comparison",
      operator: op as "==" | "!=" | ">" | ">=" | "<" | "<=",
      left: left as ValueExpression,
      right: right as ValueExpression,
    } as ComparisonExpression;
  }

  // Check for string concatenation
  if (operator === "+") {
    // Treat as concat if we have a string literal or concat expression
    const leftIsString =
      (left.type === "constant" && typeof (left as ConstantExpression).value === "string") ||
      left.type === "concat"; // Already a concat expression
    const rightIsString =
      (right.type === "constant" && typeof (right as ConstantExpression).value === "string") ||
      right.type === "concat";

    // Also check for string-like column/parameter names (heuristic)
    const leftLikelyString =
      (left.type === "column" && isLikelyStringColumn((left as ColumnExpression).name)) ||
      (left.type === "param" && isLikelyStringParam((left as ParameterExpression).property));
    const rightLikelyString =
      (right.type === "column" && isLikelyStringColumn((right as ColumnExpression).name)) ||
      (right.type === "param" && isLikelyStringParam((right as ParameterExpression).property));

    if (leftIsString || rightIsString || leftLikelyString || rightLikelyString) {
      return {
        type: "concat",
        left: left as ValueExpression,
        right: right as ValueExpression,
      } as ConcatExpression;
    }
  }

  // Arithmetic operators
  if (["+", "-", "*", "/", "%"].includes(operator)) {
    return {
      type: "arithmetic",
      operator: operator as "+" | "-" | "*" | "/" | "%",
      left: left as ValueExpression,
      right: right as ValueExpression,
    } as ArithmeticExpression;
  }

  return null;
}

export function convertLogicalExpression(
  ast: ASTLogicalExpression,
  context: ConversionContext,
): Expression | null {
  const left = convertAstToExpression(ast.left, context);
  const right = convertAstToExpression(ast.right, context);

  if (!left || !right) return null;

  // Convert columns to booleanColumns if needed
  let finalLeft = left;
  if (left.type === "column") {
    finalLeft = {
      type: "booleanColumn",
      name: (left as ColumnExpression).name,
    };
  }

  let finalRight = right;
  if (right.type === "column") {
    finalRight = {
      type: "booleanColumn",
      name: (right as ColumnExpression).name,
    };
  }

  if (isBooleanExpression(finalLeft) && isBooleanExpression(finalRight)) {
    return {
      type: "logical",
      operator: ast.operator === "&&" ? "and" : ast.operator === "||" ? "or" : ast.operator,
      left: finalLeft as BooleanExpression,
      right: finalRight as BooleanExpression,
    } as LogicalExpression;
  }

  return null;
}

export function convertLiteral(
  ast: Literal | NumericLiteral | StringLiteral | BooleanLiteral | NullLiteral,
): ConstantExpression {
  let value: string | number | boolean | null;
  if (ast.type === "NumericLiteral") {
    value = (ast as NumericLiteral).value;
  } else if (ast.type === "StringLiteral") {
    value = (ast as StringLiteral).value;
  } else if (ast.type === "BooleanLiteral") {
    value = (ast as BooleanLiteral).value;
  } else if (ast.type === "NullLiteral") {
    value = null;
  } else {
    value = (ast as Literal).value;
  }

  const valueType =
    typeof value === "number"
      ? "number"
      : typeof value === "string"
        ? "string"
        : typeof value === "boolean"
          ? "boolean"
          : value === null
            ? "null"
            : "undefined";

  return {
    type: "constant",
    value: value,
    valueType: valueType as "number" | "string" | "boolean" | "null" | "undefined",
  };
}

export function convertCallExpression(
  ast: ASTCallExpression,
  context: ConversionContext,
): Expression | null {
  // Handle method calls
  if (ast.callee.type === "MemberExpression") {
    const memberCallee = ast.callee as ASTMemberExpression;

    // Check if this is an aggregate method on a grouping parameter
    // In C# LINQ, after groupBy, the parameter represents IGrouping<TKey, TElement>
    if (memberCallee.object.type === "Identifier" && memberCallee.property.type === "Identifier") {
      const objName = (memberCallee.object as Identifier).name;
      const methodName = (memberCallee.property as Identifier).name;

      // Check if this is a grouping parameter calling an aggregate method
      if (context.groupingParams && context.groupingParams.has(objName)) {
        // Handle aggregate methods on grouping
        if (["count", "sum", "avg", "average", "min", "max"].includes(methodName.toLowerCase())) {
          const aggregateFunc =
            methodName.toLowerCase() === "average" ? "avg" : methodName.toLowerCase();

          // For methods like sum, avg, min, max that can take a selector
          if (ast.arguments && ast.arguments.length > 0) {
            const selectorArg = ast.arguments[0];
            if (selectorArg && selectorArg.type === "ArrowFunctionExpression") {
              const arrowFunc = selectorArg as ArrowFunctionExpression;
              const paramName = getParameterName(arrowFunc);
              if (paramName) {
                context.tableParams.add(paramName);
              }

              const bodyExpr =
                arrowFunc.body.type === "BlockStatement"
                  ? getReturnExpression(arrowFunc.body.body)
                  : arrowFunc.body;

              if (bodyExpr) {
                const expr = convertAstToExpression(bodyExpr, context);
                if (expr && isValueExpression(expr)) {
                  return {
                    type: "aggregate",
                    function: aggregateFunc as "count" | "sum" | "avg" | "min" | "max",
                    expression: expr as ValueExpression,
                  } as AggregateExpression;
                }
              }
            }
          }

          // No arguments - just COUNT(*) or similar
          return {
            type: "aggregate",
            function: aggregateFunc as "count" | "sum" | "avg" | "min" | "max",
          } as AggregateExpression;
        }
      }
    }

    const obj = convertAstToExpression(memberCallee.object, context);

    if (memberCallee.property.type === "Identifier") {
      const methodName = (memberCallee.property as Identifier).name;

      if (obj && isValueExpression(obj)) {
        // Boolean methods
        if (["startsWith", "endsWith", "includes", "contains"].includes(methodName)) {
          const args = ast.arguments.map((arg: ASTExpression) =>
            convertAstToExpression(arg, context),
          );
          return {
            type: "booleanMethod",
            object: obj as ValueExpression,
            method: methodName as "startsWith" | "endsWith" | "includes" | "contains",
            arguments: args.filter(Boolean) as ValueExpression[],
          } as BooleanMethodExpression;
        }

        // String methods
        if (["toLowerCase", "toUpperCase", "trim"].includes(methodName)) {
          return {
            type: "stringMethod",
            object: obj as ValueExpression,
            method: methodName as "toLowerCase" | "toUpperCase" | "trim",
          } as StringMethodExpression;
        }
      }
    }
  }

  return null;
}

export function convertObjectExpression(
  ast: ASTObjectExpression,
  context: ConversionContext,
): ObjectExpression | null {
  const properties: Record<string, Expression> = {};

  for (const prop of ast.properties) {
    if (prop.key.type === "Identifier") {
      const key = (prop.key as Identifier).name;
      const value = convertAstToExpression(prop.value, context);
      if (!value) return null;
      properties[key] = value;
    } else if (prop.key.type === "Literal" || prop.key.type === "StringLiteral") {
      const key = String((prop.key as Literal | StringLiteral).value);
      const value = convertAstToExpression(prop.value, context);
      if (!value) return null;
      properties[key] = value;
    }
  }

  return {
    type: "object",
    properties,
  };
}

export function convertLambdaExpression(
  ast: ArrowFunctionExpression,
  context: ConversionContext,
): Expression | null {
  const params = ast.params.map((p: Identifier) => ({ name: p.name }));

  // Handle both Expression body and BlockStatement body
  let bodyExpr: ASTExpression | null = null;
  if (ast.body.type === "BlockStatement") {
    // For block statements, look for a return statement
    bodyExpr = getReturnExpression(ast.body.body);
  } else {
    bodyExpr = ast.body;
  }

  if (!bodyExpr) return null;
  const body = convertAstToExpression(bodyExpr, context);
  if (!body) return null;

  return {
    type: "lambda",
    parameters: params,
    body,
  };
}
