/**
 * AST to Expression/QueryOperation converter
 * Converts OXC AST nodes to our expression and query operation types
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
} from "../expressions/expression.js";

import type {
  QueryOperation,
  FromOperation,
  WhereOperation,
  SelectOperation,
  OrderByOperation,
  JoinOperation,
  GroupByOperation,
  TakeOperation,
  SkipOperation,
  FirstOperation,
  CountOperation,
  ToArrayOperation,
} from "../query-tree/operations.js";

/**
 * Context for tracking parameter origins during conversion
 */
export interface ConversionContext {
  // Track which parameters come from tables vs query params
  tableParams: Set<string>;
  queryParams: Set<string>;
  currentTable?: string;
  tableAliases: Map<string, string>;
}

/**
 * Converts an OXC AST to a QueryOperation tree
 * This handles the method chain: from().where().select() etc.
 */
export function convertAstToQueryOperation(ast: any): QueryOperation | null {
  try {
    // The AST should be an arrow function
    // Extract the body which should be a method chain
    const arrowFunc = findArrowFunction(ast);
    if (!arrowFunc) {
      return null;
    }

    // Get the parameter name (e.g., "p" in (p) => ...)
    const paramName = getParameterName(arrowFunc);

    // Create context
    const context: ConversionContext = {
      tableParams: new Set(),
      queryParams: paramName ? new Set([paramName]) : new Set(),
      tableAliases: new Map(),
    };

    // Convert the body (should be a method chain)
    return convertMethodChain(arrowFunc.body, context);
  } catch (error) {
    console.error("Failed to convert AST to QueryOperation:", error);
    return null;
  }
}

/**
 * Converts an OXC AST to an Expression
 * This handles individual expressions within lambdas
 */
export function convertAstToExpression(
  ast: any,
  context: ConversionContext
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
      return convertLiteral(ast);

    case "CallExpression":
      return convertCallExpression(ast, context);

    case "ObjectExpression":
      return convertObjectExpression(ast, context);

    case "ArrowFunctionExpression":
      return convertLambdaExpression(ast, context);

    case "UnaryExpression":
      if (ast.operator === "!") {
        const expr = convertAstToExpression(ast.argument, context);
        if (expr && isBooleanExpression(expr)) {
          return {
            type: "not",
            expression: expr as BooleanExpression,
          };
        }
      }
      return null;

    default:
      console.warn("Unsupported AST node type:", ast.type);
      return null;
  }
}

// ==================== Helper Functions ====================

function findArrowFunction(ast: any): any {
  if (ast.type === "ArrowFunctionExpression") {
    return ast;
  }

  if (ast.body && ast.body.length > 0) {
    for (const stmt of ast.body) {
      if (stmt.type === "ExpressionStatement" && stmt.expression) {
        return findArrowFunction(stmt.expression);
      }
    }
  }

  return null;
}

function getParameterName(arrowFunc: any): string | null {
  if (arrowFunc.params && arrowFunc.params.length > 0) {
    return arrowFunc.params[0].name;
  }
  return null;
}

function convertMethodChain(ast: any, context: ConversionContext): QueryOperation | null {
  if (!ast) return null;

  // Handle call expressions (method calls)
  if (ast.type === "CallExpression") {
    const methodName = getMethodName(ast);

    // Check if this is a from() call
    if (methodName === "from") {
      return convertFromOperation(ast, context);
    }

    // Otherwise, it's a chained method call
    if (ast.callee && ast.callee.type === "MemberExpression") {
      const source = convertMethodChain(ast.callee.object, context);
      if (!source) return null;

      switch (methodName) {
        case "where":
          return convertWhereOperation(ast, source, context);
        case "select":
          return convertSelectOperation(ast, source, context);
        case "orderBy":
        case "orderByDescending":
          return convertOrderByOperation(ast, source, context, methodName);
        case "take":
          return convertTakeOperation(ast, source, context);
        case "skip":
          return convertSkipOperation(ast, source, context);
        case "first":
        case "firstOrDefault":
          return convertFirstOperation(ast, source, context, methodName);
        case "count":
          return convertCountOperation(ast, source, context);
        case "toArray":
          return convertToArrayOperation(source);
        // Add more operations as needed
      }
    }
  }

  return null;
}

function getMethodName(callExpr: any): string | null {
  if (callExpr.callee) {
    if (callExpr.callee.type === "Identifier") {
      return callExpr.callee.name;
    }
    if (callExpr.callee.type === "MemberExpression" && callExpr.callee.property) {
      return callExpr.callee.property.name;
    }
  }
  return null;
}

function convertFromOperation(ast: any, context: ConversionContext): FromOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const arg = ast.arguments[0];
    if (arg.type === "StringLiteral" || arg.type === "Literal") {
      const tableName = arg.value;
      context.currentTable = tableName;
      return {
        type: "queryOperation",
        operationType: "from",
        table: tableName,
      };
    }
  }
  return null;
}

function convertWhereOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext
): WhereOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      // Add the lambda parameter to table params
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const predicate = convertAstToExpression(lambdaAst.body, context);
      if (predicate && isBooleanExpression(predicate)) {
        return {
          type: "queryOperation",
          operationType: "where",
          source,
          predicate: predicate as BooleanExpression,
        };
      }
    }
  }
  return null;
}

function convertSelectOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext
): SelectOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      // Add the lambda parameter to table params
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const selector = convertAstToExpression(lambdaAst.body, context);
      if (selector && (isValueExpression(selector) || isObjectExpression(selector))) {
        return {
          type: "queryOperation",
          operationType: "select",
          source,
          selector: selector as (ValueExpression | ObjectExpression),
        };
      }
    }
  }
  return null;
}

function convertOrderByOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
  methodName: string
): OrderByOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const keySelector = convertAstToExpression(lambdaAst.body, context);

      // Simple property access can be just a string
      if (keySelector && keySelector.type === "column") {
        return {
          type: "queryOperation",
          operationType: "orderBy",
          source,
          keySelector: (keySelector as ColumnExpression).name,
          direction: methodName === "orderByDescending" ? "descending" : "ascending",
        };
      }
    }
  }
  return null;
}

function convertTakeOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext
): TakeOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const arg = ast.arguments[0];
    if (arg.type === "NumericLiteral" || arg.type === "Literal") {
      return {
        type: "queryOperation",
        operationType: "take",
        source,
        count: arg.value,
      };
    }
  }
  return null;
}

function convertSkipOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext
): SkipOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const arg = ast.arguments[0];
    if (arg.type === "NumericLiteral" || arg.type === "Literal") {
      return {
        type: "queryOperation",
        operationType: "skip",
        source,
        count: arg.value,
      };
    }
  }
  return null;
}

function convertFirstOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
  methodName: string
): FirstOperation | null {
  let predicate: BooleanExpression | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const expr = convertAstToExpression(lambdaAst.body, context);
      if (expr && isBooleanExpression(expr)) {
        predicate = expr as BooleanExpression;
      }
    }
  }

  return {
    type: "queryOperation",
    operationType: methodName === "firstOrDefault" ? "firstOrDefault" : "first",
    source,
    predicate,
  };
}

function convertCountOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext
): CountOperation | null {
  let predicate: BooleanExpression | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const expr = convertAstToExpression(lambdaAst.body, context);
      if (expr && isBooleanExpression(expr)) {
        predicate = expr as BooleanExpression;
      }
    }
  }

  return {
    type: "queryOperation",
    operationType: "count",
    source,
    predicate,
  };
}

function convertToArrayOperation(source: QueryOperation): ToArrayOperation {
  return {
    type: "queryOperation",
    operationType: "toArray",
    source,
  };
}

function convertIdentifier(ast: any, context: ConversionContext): Expression | null {
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

function convertMemberExpression(ast: any, context: ConversionContext): Expression | null {
  const objectName = ast.object.name;
  const propertyName = ast.property.name;

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

  // Nested member access (e.g., x.address.city)
  const obj = convertAstToExpression(ast.object, context);
  if (obj && obj.type === "column") {
    // Flatten nested column access
    return {
      type: "column",
      name: `${(obj as ColumnExpression).name}.${propertyName}`,
    } as ColumnExpression;
  }

  return null;
}

function convertBinaryExpression(ast: any, context: ConversionContext): Expression | null {
  const left = convertAstToExpression(ast.left, context);
  const right = convertAstToExpression(ast.right, context);

  if (!left || !right) return null;

  const operator = ast.operator;

  // Comparison operators
  if (["==", "===", "!=", "!==", ">", ">=", "<", "<="].includes(operator)) {
    const op = operator === "===" ? "==" : operator === "!==" ? "!=" : operator;
    return {
      type: "comparison",
      operator: op as any,
      left: left as ValueExpression,
      right: right as ValueExpression,
    } as ComparisonExpression;
  }

  // Arithmetic operators
  if (["+", "-", "*", "/", "%"].includes(operator)) {
    return {
      type: "arithmetic",
      operator: operator as any,
      left: left as ValueExpression,
      right: right as ValueExpression,
    } as ArithmeticExpression;
  }

  return null;
}

function convertLogicalExpression(ast: any, context: ConversionContext): Expression | null {
  const left = convertAstToExpression(ast.left, context);
  const right = convertAstToExpression(ast.right, context);

  if (!left || !right) return null;

  if (isBooleanExpression(left) && isBooleanExpression(right)) {
    return {
      type: "logical",
      operator: ast.operator,
      left: left as BooleanExpression,
      right: right as BooleanExpression,
    } as LogicalExpression;
  }

  return null;
}

function convertLiteral(ast: any): ConstantExpression {
  return {
    type: "constant",
    value: ast.value,
    valueType: typeof ast.value as any,
  };
}

function convertCallExpression(ast: any, context: ConversionContext): Expression | null {
  // Handle string method calls
  if (ast.callee.type === "MemberExpression") {
    const obj = convertAstToExpression(ast.callee.object, context);
    const methodName = ast.callee.property.name;

    if (obj && isValueExpression(obj)) {
      // Boolean methods
      if (["startsWith", "endsWith", "includes", "contains"].includes(methodName)) {
        const args = ast.arguments.map((arg: any) => convertAstToExpression(arg, context));
        return {
          type: "booleanMethod",
          object: obj as ValueExpression,
          method: methodName as any,
          arguments: args.filter(Boolean) as ValueExpression[],
        } as BooleanMethodExpression;
      }

      // String methods
      if (["toLowerCase", "toUpperCase", "trim"].includes(methodName)) {
        return {
          type: "stringMethod",
          object: obj as ValueExpression,
          method: methodName as any,
        };
      }
    }
  }

  return null;
}

function convertObjectExpression(ast: any, context: ConversionContext): ObjectExpression | null {
  const properties = ast.properties.map((prop: any) => {
    const key = prop.key.name;
    const value = convertAstToExpression(prop.value, context);
    if (!value) return null;
    return { key, value };
  }).filter(Boolean);

  return {
    type: "object",
    properties,
  };
}

function convertLambdaExpression(ast: any, context: ConversionContext): Expression | null {
  const params = ast.params.map((p: any) => ({ name: p.name }));
  const body = convertAstToExpression(ast.body, context);

  if (!body) return null;

  return {
    type: "lambda",
    parameters: params,
    body,
  };
}

// Type guards (should import from expressions)
function isBooleanExpression(expr: Expression): boolean {
  return [
    "comparison",
    "logical",
    "not",
    "booleanConstant",
    "booleanColumn",
    "booleanParam",
    "booleanMethod",
    "in",
    "between",
    "isNull",
    "exists",
    "like",
    "regex",
  ].includes(expr.type);
}

function isValueExpression(expr: Expression): boolean {
  return [
    "column",
    "constant",
    "param",
    "arithmetic",
    "concat",
    "stringMethod",
    "case",
    "coalesce",
    "cast",
  ].includes(expr.type);
}

function isObjectExpression(expr: Expression): boolean {
  return expr.type === "object";
}