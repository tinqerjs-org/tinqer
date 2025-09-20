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
  ConcatExpression,
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
  FirstOrDefaultOperation,
  SingleOperation,
  SingleOrDefaultOperation,
  LastOperation,
  LastOrDefaultOperation,
  CountOperation,
  SumOperation,
  AverageOperation,
  MinOperation,
  MaxOperation,
  ToArrayOperation,
  ThenByOperation,
  DistinctOperation,
  ContainsOperation,
  UnionOperation,
  ReverseOperation,
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
export function convertAstToExpression(ast: any, context: ConversionContext): Expression | null {
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

        // Convert column to booleanColumn if needed
        let finalExpr = expr;
        if (expr && expr.type === "column") {
          finalExpr = {
            type: "booleanColumn",
            name: (expr as any).name,
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

    case "ParenthesizedExpression":
      // Simply unwrap parentheses and process the inner expression
      return convertAstToExpression(ast.expression, context);

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
        case "skipWhile":
          return convertSkipWhileOperation(ast, source, context);
        case "first":
          return convertFirstOperation(ast, source, context, false);
        case "firstOrDefault":
          return convertFirstOrDefaultOperation(ast, source, context);
        case "count":
          return convertCountOperation(ast, source, context);
        case "toArray":
          return convertToArrayOperation(source);
        case "groupBy":
          return convertGroupByOperation(ast, source, context);
        case "join":
          return convertJoinOperation(ast, source, context);
        case "distinct":
          return convertDistinctOperation(ast, source, context);
        case "thenBy":
        case "thenByDescending":
          return convertThenByOperation(ast, source, context, methodName);
        case "sum":
          return convertSumOperation(ast, source, context);
        case "average":
          return convertAverageOperation(ast, source, context);
        case "min":
          return convertMinOperation(ast, source, context);
        case "max":
          return convertMaxOperation(ast, source, context);
        case "single":
        case "singleOrDefault":
          return convertSingleOperation(ast, source, context, methodName);
        case "last":
        case "lastOrDefault":
          return convertLastOperation(ast, source, context, methodName);
        case "contains":
          return convertContainsOperation(ast, source, context);
        case "union":
          return convertUnionOperation(ast, source, context);
        case "reverse":
          return convertReverseOperation(source);
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
  context: ConversionContext,
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

      // If we got a column, convert it to a booleanColumn for where clauses
      let finalPredicate = predicate;
      if (predicate && predicate.type === "column") {
        finalPredicate = {
          type: "booleanColumn",
          name: (predicate as any).name,
        };
      }

      if (finalPredicate && isBooleanExpression(finalPredicate)) {
        return {
          type: "queryOperation",
          operationType: "where",
          source,
          predicate: finalPredicate as BooleanExpression,
        };
      }
    }
  }
  return null;
}

function convertSelectOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
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
          selector: selector as ValueExpression | ObjectExpression,
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
  methodName: string,
): OrderByOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const keySelector = convertAstToExpression(lambdaAst.body, context);

      if (keySelector) {
        // For simple columns, just use the string name
        // For computed expressions, use the full expression
        const selector =
          keySelector.type === "column"
            ? (keySelector as ColumnExpression).name
            : (keySelector as ValueExpression);

        return {
          type: "queryOperation",
          operationType: "orderBy",
          source,
          keySelector: selector,
          descending: methodName === "orderByDescending",
        };
      }
    }
  }
  return null;
}

function convertTakeOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
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
    // Handle external parameter (e.g., p.limit)
    if (arg.type === "MemberExpression") {
      const objectName = arg.object.name;
      const propertyName = arg.property.name;
      if (context.queryParams.has(objectName)) {
        return {
          type: "queryOperation",
          operationType: "take",
          source,
          count: { type: "param", param: objectName, property: propertyName },
        };
      }
    }
  }
  return null;
}

function convertSkipOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
): SkipOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const arg = ast.arguments[0];

    // Handle numeric literals
    if (arg.type === "NumericLiteral" || arg.type === "Literal") {
      return {
        type: "queryOperation",
        operationType: "skip",
        source,
        count: arg.value,
      };
    }

    // Handle any expression (including arithmetic, member access, etc.)
    const expr = convertAstToExpression(arg, context);
    if (expr) {
      // If it's a simple parameter reference, use ParamRef format
      if (expr.type === "param") {
        return {
          type: "queryOperation",
          operationType: "skip",
          source,
          count: expr as any, // Already in ParamRef format
        };
      }

      // For other expressions (like arithmetic), use the expression directly
      return {
        type: "queryOperation",
        operationType: "skip",
        source,
        count: expr as any,
      };
    }
  }
  return null;
}

function convertSkipWhileOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
): any {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      // Add the lambda parameter to table params
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const predicate = convertAstToExpression(lambdaAst.body, context);

      // Convert column to booleanColumn if needed
      let finalPredicate = predicate;
      if (predicate && predicate.type === "column") {
        finalPredicate = {
          type: "booleanColumn",
          name: (predicate as any).name,
        };
      }

      if (finalPredicate && isBooleanExpression(finalPredicate)) {
        return {
          type: "queryOperation",
          operationType: "skipWhile",
          source,
          predicate: finalPredicate as BooleanExpression,
        };
      }
    }
  }
  return null;
}

function convertFirstOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
  _isDefault: boolean,
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
    operationType: "first",
    source,
    predicate,
  };
}

function convertFirstOrDefaultOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
): FirstOrDefaultOperation | null {
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
    operationType: "firstOrDefault",
    source,
    predicate,
  };
}

function convertCountOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
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

function convertGroupByOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
): GroupByOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const keySelectorAst = ast.arguments[0];

    if (keySelectorAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(keySelectorAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const keySelector = convertAstToExpression(keySelectorAst.body, context);

      // Only support simple column names for groupBy
      if (keySelector && keySelector.type === "column") {
        return {
          type: "queryOperation",
          operationType: "groupBy",
          source,
          keySelector: (keySelector as ColumnExpression).name,
        };
      }
    }
  }
  return null;
}

function convertJoinOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
): JoinOperation | null {
  if (ast.arguments && ast.arguments.length >= 4) {
    // join(inner, outerKeySelector, innerKeySelector, resultSelector)
    const innerSource = convertAstToQueryOperation(ast.arguments[0]);
    const outerKeySelectorAst = ast.arguments[1];
    const innerKeySelectorAst = ast.arguments[2];

    let outerKey: string | null = null;
    let innerKey: string | null = null;

    // Only support simple column selectors
    if (outerKeySelectorAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(outerKeySelectorAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }
      const expr = convertAstToExpression(outerKeySelectorAst.body, context);
      if (expr && expr.type === "column") {
        outerKey = (expr as ColumnExpression).name;
      }
    }

    if (innerKeySelectorAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(innerKeySelectorAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }
      const expr = convertAstToExpression(innerKeySelectorAst.body, context);
      if (expr && expr.type === "column") {
        innerKey = (expr as ColumnExpression).name;
      }
    }

    if (innerSource && outerKey && innerKey) {
      return {
        type: "queryOperation",
        operationType: "join",
        source,
        inner: innerSource,
        outerKey,
        innerKey,
      };
    }
  }
  return null;
}

function convertDistinctOperation(
  _ast: any,
  source: QueryOperation,
  _context: ConversionContext,
): DistinctOperation | null {
  return {
    type: "queryOperation",
    operationType: "distinct",
    source,
  };
}

function convertThenByOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
  methodName: string,
): ThenByOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const keySelector = convertAstToExpression(lambdaAst.body, context);

      if (keySelector) {
        // For simple columns, just use the string name
        // For computed expressions, use the full expression
        const selector =
          keySelector.type === "column"
            ? (keySelector as ColumnExpression).name
            : (keySelector as ValueExpression);

        return {
          type: "queryOperation",
          operationType: "thenBy",
          source,
          keySelector: selector,
          descending: methodName === "thenByDescending",
        };
      }
    }
  }
  return null;
}

function convertSumOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
): SumOperation | null {
  let selector: string | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }
      const expr = convertAstToExpression(lambdaAst.body, context);
      if (expr && expr.type === "column") {
        selector = (expr as ColumnExpression).name;
      }
    }
  }

  return {
    type: "queryOperation",
    operationType: "sum",
    source,
    selector,
  };
}

function convertAverageOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
): AverageOperation | null {
  let selector: string | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }
      const expr = convertAstToExpression(lambdaAst.body, context);
      if (expr && expr.type === "column") {
        selector = (expr as ColumnExpression).name;
      }
    }
  }

  return {
    type: "queryOperation",
    operationType: "average",
    source,
    selector,
  };
}

function convertMinOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
): MinOperation | null {
  let selector: string | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }
      const expr = convertAstToExpression(lambdaAst.body, context);
      if (expr && expr.type === "column") {
        selector = (expr as ColumnExpression).name;
      }
    }
  }

  return {
    type: "queryOperation",
    operationType: "min",
    source,
    selector,
  };
}

function convertMaxOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
): MaxOperation | null {
  let selector: string | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(lambdaAst);
      if (paramName) {
        context.tableParams.add(paramName);
      }
      const expr = convertAstToExpression(lambdaAst.body, context);
      if (expr && expr.type === "column") {
        selector = (expr as ColumnExpression).name;
      }
    }
  }

  return {
    type: "queryOperation",
    operationType: "max",
    source,
    selector,
  };
}

function convertSingleOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
  methodName: string,
): SingleOperation | SingleOrDefaultOperation | null {
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

  const operation: SingleOperation | SingleOrDefaultOperation = {
    type: "queryOperation",
    operationType: methodName === "singleOrDefault" ? "singleOrDefault" : "single",
    source,
    predicate,
  } as any;
  return operation;
}

function convertLastOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
  methodName: string,
): LastOperation | LastOrDefaultOperation | null {
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

  const operation: LastOperation | LastOrDefaultOperation = {
    type: "queryOperation",
    operationType: methodName === "lastOrDefault" ? "lastOrDefault" : "last",
    source,
    predicate,
  } as any;
  return operation;
}

function convertContainsOperation(
  ast: any,
  source: QueryOperation,
  context: ConversionContext,
): ContainsOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const valueArg = ast.arguments[0];
    const value = convertAstToExpression(valueArg, context);

    if (value && isValueExpression(value)) {
      return {
        type: "queryOperation",
        operationType: "contains",
        source,
        value: value as ValueExpression,
      };
    }
  }
  return null;
}

function convertUnionOperation(
  ast: any,
  source: QueryOperation,
  _context: ConversionContext,
): UnionOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const secondSource = convertAstToQueryOperation(ast.arguments[0]);
    if (secondSource) {
      return {
        type: "queryOperation",
        operationType: "union",
        source,
        second: secondSource,
      };
    }
  }
  return null;
}

function convertReverseOperation(source: QueryOperation): ReverseOperation {
  return {
    type: "queryOperation",
    operationType: "reverse",
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

  // Check for string concatenation
  if (operator === "+") {
    // Treat as concat if we have a string literal or concat expression
    const leftIsString =
      (left.type === "constant" && typeof (left as any).value === "string") ||
      left.type === "concat"; // Already a concat expression
    const rightIsString =
      (right.type === "constant" && typeof (right as any).value === "string") ||
      right.type === "concat";

    // Also check for string-like column/parameter names (heuristic)
    const leftLikelyString =
      (left.type === "column" && isLikelyStringColumn((left as any).name)) ||
      (left.type === "param" && isLikelyStringParam((left as any).property));
    const rightLikelyString =
      (right.type === "column" && isLikelyStringColumn((right as any).name)) ||
      (right.type === "param" && isLikelyStringParam((right as any).property));

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

  // Convert columns to booleanColumns if needed
  let finalLeft = left;
  if (left.type === "column") {
    finalLeft = {
      type: "booleanColumn",
      name: (left as any).name,
    };
  }

  let finalRight = right;
  if (right.type === "column") {
    finalRight = {
      type: "booleanColumn",
      name: (right as any).name,
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
  const properties: Record<string, Expression> = {};

  for (const prop of ast.properties) {
    const key = prop.key.name;
    const value = convertAstToExpression(prop.value, context);
    if (!value) return null;
    properties[key] = value;
  }

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

function isLikelyStringColumn(name: string): boolean {
  const stringPatterns =
    /^(name|title|description|text|message|label|prefix|suffix|firstName|lastName|fullName|displayName|email|url|path|address|city|country|state)$/i;
  return stringPatterns.test(name);
}

function isLikelyStringParam(property: string | undefined): boolean {
  if (!property) return false;
  return isLikelyStringColumn(property);
}
