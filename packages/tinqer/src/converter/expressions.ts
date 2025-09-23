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
  ConditionalExpression,
  CoalesceExpression,
  InExpression,
  ArrayExpression,
} from "../expressions/expression.js";

import type {
  ASTNode,
  Expression as ASTExpression,
  Identifier,
  MemberExpression as ASTMemberExpression,
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  BinaryExpression as ASTBinaryExpression,
  LogicalExpression as ASTLogicalExpression,
  UnaryExpression as ASTUnaryExpression,
  ObjectExpression as ASTObjectExpression,
  ConditionalExpression as ASTConditionalExpression,
  ChainExpression as ASTChainExpression,
  ArrayExpression as ASTArrayExpression,
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
        context,
      );

    case "CallExpression":
      return convertCallExpression(ast, context);

    case "ObjectExpression":
      return convertObjectExpression(ast, context);

    case "ArrowFunctionExpression":
      return convertLambdaExpression(ast, context);

    case "ArrayExpression":
      return convertArrayExpression(ast, context);

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

    case "ConditionalExpression":
      return convertConditionalExpression(ast as ASTConditionalExpression, context);

    case "ChainExpression": {
      // Optional chaining - unwrap and process the inner expression
      const chainExpr = ast as ASTChainExpression;
      return convertAstToExpression(chainExpr.expression, context);
    }

    default:
      console.warn("Unsupported AST node type:", (ast as ASTNode).type);
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
  // Handle array indexing (e.g., params.roles[0])
  if (ast.computed && ast.object.type === "Identifier") {
    const objectName = (ast.object as Identifier).name;

    // Get the index value (could be NumericLiteral or Literal)
    let index: number | null = null;
    if (ast.property.type === "NumericLiteral") {
      index = (ast.property as NumericLiteral).value;
    } else if (
      ast.property.type === "Literal" &&
      typeof (ast.property as Literal).value === "number"
    ) {
      index = (ast.property as Literal).value as number;
    }

    if (index !== null) {
      // Check if it's a query parameter array access
      if (context.queryParams.has(objectName)) {
        return {
          type: "param",
          param: objectName,
          index: index,
        } as ParameterExpression;
      }
    }
  }

  // Also handle nested array indexing (e.g., params.data.roles[0])
  if (ast.computed && ast.object.type === "MemberExpression") {
    const memberObj = convertMemberExpression(ast.object as ASTMemberExpression, context);

    // Get the index value
    let index: number | null = null;
    if (ast.property.type === "NumericLiteral") {
      index = (ast.property as NumericLiteral).value;
    } else if (
      ast.property.type === "Literal" &&
      typeof (ast.property as Literal).value === "number"
    ) {
      index = (ast.property as Literal).value as number;
    }

    if (index !== null && memberObj && memberObj.type === "param") {
      const paramExpr = memberObj as ParameterExpression;
      return {
        type: "param",
        param: paramExpr.param,
        property: paramExpr.property,
        index: index,
      } as ParameterExpression;
    }
  }

  // Check if both object and property are identifiers
  if (ast.object.type === "Identifier" && ast.property.type === "Identifier" && !ast.computed) {
    const objectName = (ast.object as Identifier).name;
    const propertyName = (ast.property as Identifier).name;

    // Handle JavaScript built-in constants like Number.MAX_SAFE_INTEGER
    if (objectName === "Number") {
      let value: number | undefined;
      if (propertyName === "MAX_SAFE_INTEGER") {
        value = Number.MAX_SAFE_INTEGER;
      } else if (propertyName === "MIN_SAFE_INTEGER") {
        value = Number.MIN_SAFE_INTEGER;
      } else if (propertyName === "MAX_VALUE") {
        value = Number.MAX_VALUE;
      } else if (propertyName === "MIN_VALUE") {
        value = Number.MIN_VALUE;
      } else if (propertyName === "POSITIVE_INFINITY") {
        value = Number.POSITIVE_INFINITY;
      } else if (propertyName === "NEGATIVE_INFINITY") {
        value = Number.NEGATIVE_INFINITY;
      } else if (propertyName === "NaN") {
        value = Number.NaN;
      }

      if (value !== undefined) {
        // Convert to auto-parameterized parameter using column hint
        const columnName = "id"; // Use generic hint for Number constants
        const counter = (context.columnCounters.get(columnName) || 0) + 1;
        context.columnCounters.set(columnName, counter);
        const paramName = `_${columnName}${counter}`;
        context.autoParams.set(paramName, value);

        return {
          type: "param",
          param: paramName,
        } as ParameterExpression;
      }
    }

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
  // Use column hint for comparisons and simple arithmetic (column op literal)
  let columnHint: string | undefined;
  const isComparison = ["==", "===", "!=", "!==", ">", ">=", "<", "<="].includes(ast.operator);

  if (isComparison) {
    // For comparisons, use column hints to relate constants to compared columns
    if (
      ast.left.type === "MemberExpression" &&
      (ast.right.type === "Literal" ||
        ast.right.type === "NumericLiteral" ||
        ast.right.type === "StringLiteral" ||
        ast.right.type === "BooleanLiteral" ||
        ast.right.type === "NullLiteral")
    ) {
      // Pattern: column OP literal
      const memberExpr = ast.left as ASTMemberExpression;
      if (memberExpr.property && memberExpr.property.type === "Identifier") {
        columnHint = (memberExpr.property as Identifier).name;
      }
    } else if (
      ast.right.type === "MemberExpression" &&
      (ast.left.type === "Literal" ||
        ast.left.type === "NumericLiteral" ||
        ast.left.type === "StringLiteral" ||
        ast.left.type === "BooleanLiteral" ||
        ast.left.type === "NullLiteral")
    ) {
      // Pattern: literal OP column
      const memberExpr = ast.right as ASTMemberExpression;
      if (memberExpr.property && memberExpr.property.type === "Identifier") {
        columnHint = (memberExpr.property as Identifier).name;
      }
    }
  } else if (
    ["+", "-", "*", "/", "%"].includes(ast.operator) &&
    ast.left.type === "MemberExpression" &&
    (ast.right.type === "Literal" ||
      ast.right.type === "NumericLiteral" ||
      ast.right.type === "StringLiteral" ||
      ast.right.type === "BooleanLiteral" ||
      ast.right.type === "NullLiteral")
  ) {
    // For arithmetic operations with column on left, use column hints
    // but will be overridden later for string concatenation contexts (for +)
    const memberExpr = ast.left as ASTMemberExpression;
    if (memberExpr.property && memberExpr.property.type === "Identifier") {
      columnHint = (memberExpr.property as Identifier).name;
    }
  }

  // Convert left side
  let left: Expression | null;
  if (
    columnHint &&
    (ast.left.type === "Literal" ||
      ast.left.type === "NumericLiteral" ||
      ast.left.type === "StringLiteral" ||
      ast.left.type === "BooleanLiteral" ||
      ast.left.type === "NullLiteral")
  ) {
    left = convertLiteral(
      ast.left as Literal | NumericLiteral | StringLiteral | BooleanLiteral | NullLiteral,
      context,
      columnHint,
    );
  } else {
    left = convertAstToExpression(ast.left, context);
  }

  // Convert right side with column hint for literals
  let right: Expression | null;
  if (
    columnHint &&
    (ast.right.type === "Literal" ||
      ast.right.type === "NumericLiteral" ||
      ast.right.type === "StringLiteral" ||
      ast.right.type === "BooleanLiteral" ||
      ast.right.type === "NullLiteral")
  ) {
    right = convertLiteral(
      ast.right as Literal | NumericLiteral | StringLiteral | BooleanLiteral | NullLiteral,
      context,
      columnHint,
    );
  } else {
    right = convertAstToExpression(ast.right, context);
  }

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
      // Reject string concatenation in SELECT projections
      if (context.inSelectProjection) {
        throw new Error(
          "SELECT projections only support simple column access. String concatenation must be computed in application code.",
        );
      }
      // For string concatenation, use the already converted left and right
      // which have column hints if applicable (from the earlier conversion)
      return {
        type: "concat",
        left: left as ValueExpression,
        right: right as ValueExpression,
      } as ConcatExpression;
    }
  }

  // Arithmetic operators
  if (["+", "-", "*", "/", "%"].includes(operator)) {
    // Reject arithmetic expressions in SELECT projections
    if (context.inSelectProjection) {
      throw new Error(
        "SELECT projections only support simple column access. Arithmetic operations must be computed in application code.",
      );
    }
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

  // Handle ?? (nullish coalescing) as COALESCE
  if (ast.operator === "??" && isValueExpression(left) && isValueExpression(right)) {
    // Reject coalesce expressions in SELECT projections
    if (context.inSelectProjection) {
      throw new Error(
        "SELECT projections only support simple column access. Coalesce expressions must be computed in application code.",
      );
    }
    return {
      type: "coalesce",
      expressions: [left as ValueExpression, right as ValueExpression],
    } as CoalesceExpression;
  }

  // Handle || as coalesce when not both boolean expressions (for backward compatibility)
  if (ast.operator === "||" && isValueExpression(left) && isValueExpression(right)) {
    // Reject coalesce expressions in SELECT projections
    if (context.inSelectProjection) {
      throw new Error(
        "SELECT projections only support simple column access. Coalesce expressions must be computed in application code.",
      );
    }
    return {
      type: "coalesce",
      expressions: [left as ValueExpression, right as ValueExpression],
    } as CoalesceExpression;
  }

  return null;
}

export function convertLiteral(
  ast: Literal | NumericLiteral | StringLiteral | BooleanLiteral | NullLiteral,
  context: ConversionContext,
  columnHint?: string,
): ParameterExpression | ConstantExpression {
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

  // Special case for null - don't parameterize it so we can generate IS NULL/IS NOT NULL
  if (value === null) {
    return {
      type: "constant",
      value: null,
    } as ConstantExpression;
  }

  // Generate parameter name based on column hint
  const columnName = columnHint || "value";
  const counter = (context.columnCounters.get(columnName) || 0) + 1;
  context.columnCounters.set(columnName, counter);
  const paramName = `_${columnName}${counter}`;

  // Store the parameter value
  context.autoParams.set(paramName, value);

  // Return a parameter expression instead of constant
  return {
    type: "param",
    param: paramName,
  } as ParameterExpression;
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

      // Special handling for array.includes() -> IN expression
      if (methodName === "includes" && obj && obj.type === "array") {
        // This is array.includes(value) which should become value IN (array)
        if (ast.arguments && ast.arguments.length === 1 && ast.arguments[0]) {
          const valueArg = convertAstToExpression(ast.arguments[0], context);
          if (valueArg && isValueExpression(valueArg)) {
            return {
              type: "in",
              value: valueArg as ValueExpression,
              list: obj as ArrayExpression,
            } as InExpression;
          }
        }
      }

      if (obj && isValueExpression(obj)) {
        // Boolean methods for strings
        if (["startsWith", "endsWith", "includes", "contains"].includes(methodName)) {
          // Extract column hint from the method object for parameter naming
          let columnHint: string | undefined;
          if (obj.type === "column") {
            columnHint = (obj as ColumnExpression).name;
          }

          const args = ast.arguments.map((arg: ASTExpression) => {
            // Convert literals with column hint for better parameter names
            if (
              columnHint &&
              (arg.type === "Literal" ||
                arg.type === "NumericLiteral" ||
                arg.type === "StringLiteral" ||
                arg.type === "BooleanLiteral" ||
                arg.type === "NullLiteral")
            ) {
              return convertLiteral(
                arg as Literal | NumericLiteral | StringLiteral | BooleanLiteral | NullLiteral,
                context,
                columnHint,
              );
            }
            return convertAstToExpression(arg, context);
          });
          return {
            type: "booleanMethod",
            object: obj as ValueExpression,
            method: methodName as "startsWith" | "endsWith" | "includes" | "contains",
            arguments: args.filter(Boolean) as ValueExpression[],
          } as BooleanMethodExpression;
        }

        // String methods - only support toLowerCase and toUpperCase
        if (["toLowerCase", "toUpperCase"].includes(methodName)) {
          return {
            type: "stringMethod",
            object: obj as ValueExpression,
            method: methodName as "toLowerCase" | "toUpperCase",
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

export function convertArrayExpression(
  ast: ASTArrayExpression,
  context: ConversionContext,
): ArrayExpression | null {
  const elements: Expression[] = [];

  for (const element of ast.elements) {
    if (element) {
      const expr = convertAstToExpression(element, context);
      if (expr) {
        elements.push(expr);
      }
    }
  }

  return {
    type: "array",
    elements,
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

export function convertConditionalExpression(
  ast: ASTConditionalExpression,
  context: ConversionContext,
): ConditionalExpression | null {
  // Reject conditional expressions in SELECT projections
  if (context.inSelectProjection) {
    throw new Error(
      "SELECT projections only support simple column access. Conditional expressions must be computed in application code.",
    );
  }

  const condition = convertAstToExpression(ast.test, context);
  const thenExpr = convertAstToExpression(ast.consequent, context);
  const elseExpr = convertAstToExpression(ast.alternate, context);

  if (!condition || !thenExpr || !elseExpr) return null;

  // Convert condition to boolean expression if needed
  let booleanCondition: BooleanExpression;
  if (isBooleanExpression(condition)) {
    booleanCondition = condition as BooleanExpression;
  } else if (condition.type === "column") {
    // Convert column to booleanColumn
    booleanCondition = {
      type: "booleanColumn",
      name: (condition as ColumnExpression).name,
    };
  } else {
    // For other types, we can't convert to boolean safely
    return null;
  }

  return {
    type: "conditional",
    condition: booleanCondition,
    then: thenExpr,
    else: elseExpr,
  };
}
