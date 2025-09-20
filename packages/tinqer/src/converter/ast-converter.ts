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
  StringMethodExpression,
} from "../expressions/expression.js";

import type {
  Program,
  Statement,
  ExpressionStatement,
  ReturnStatement,
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
  SkipWhileOperation,
  FirstOperation,
  FirstOrDefaultOperation,
  SingleOperation,
  SingleOrDefaultOperation,
  LastOperation,
  LastOrDefaultOperation,
  CountOperation,
  SumOperation,
  AverageOperation,
  ParamRef,
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
export function convertAstToQueryOperation(ast: unknown): QueryOperation | null {
  try {
    if (!ast || typeof ast !== "object" || !("type" in ast)) {
      return null;
    }

    // Handle Program nodes from OXC parser
    let actualAst: ASTExpression;
    const typedAst = ast as { type: string };

    if (typedAst.type === "Program") {
      const program = ast as Program;
      if (program.body && program.body.length > 0) {
        const firstStatement = program.body[0];
        if (firstStatement && firstStatement.type === "ExpressionStatement") {
          const exprStmt = firstStatement as ExpressionStatement;
          actualAst = exprStmt.expression;
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      actualAst = ast as ASTExpression;
    }

    // The AST should be an arrow function
    // Extract the body which should be a method chain
    const arrowFunc = findArrowFunction(actualAst);
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
    // Handle both Expression body and BlockStatement body
    if (arrowFunc.body.type === "BlockStatement") {
      // For block statements, look for a return statement
      const returnExpr = getReturnExpression(arrowFunc.body.body);
      if (returnExpr) {
        return convertMethodChain(returnExpr, context);
      }
      return null;
    } else {
      return convertMethodChain(arrowFunc.body, context);
    }
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

// ==================== Helper Functions ====================

function getReturnExpression(blockBody: Statement[] | undefined): ASTExpression | null {
  const firstStatement = blockBody && blockBody.length > 0 ? blockBody[0] : null;
  if (firstStatement && firstStatement.type === "ReturnStatement") {
    const returnStmt = firstStatement as ReturnStatement;
    return returnStmt.argument || null;
  }
  return null;
}

function findArrowFunction(ast: ASTExpression): ArrowFunctionExpression | null {
  if (ast.type === "ArrowFunctionExpression") {
    return ast as ArrowFunctionExpression;
  }

  // Handle other expression types that might wrap arrow functions
  // For now, we only check the direct expression
  return null;
}

function getParameterName(arrowFunc: ArrowFunctionExpression): string | null {
  if (arrowFunc.params && arrowFunc.params.length > 0) {
    const firstParam = arrowFunc.params[0];
    if (firstParam) {
      return firstParam.name;
    }
  }
  return null;
}

function convertMethodChain(ast: ASTExpression, context: ConversionContext): QueryOperation | null {
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

function getMethodName(callExpr: ASTCallExpression): string | null {
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

function convertFromOperation(
  ast: ASTCallExpression,
  context: ConversionContext,
): FromOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const arg = ast.arguments[0];
    if (arg && (arg.type === "StringLiteral" || arg.type === "Literal")) {
      const tableName = (arg as StringLiteral | Literal).value as string;
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): WhereOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      // Add the lambda parameter to table params
      const paramName = getParameterName(lambdaAst as ArrowFunctionExpression);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const body = (lambdaAst as ArrowFunctionExpression).body;
      const predicate =
        body.type === "BlockStatement" ? null : convertAstToExpression(body, context);

      // If we got a column, convert it to a booleanColumn for where clauses
      let finalPredicate = predicate;
      if (predicate && predicate.type === "column") {
        finalPredicate = {
          type: "booleanColumn",
          name: (predicate as ColumnExpression).name,
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): SelectOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      // Add the lambda parameter to table params
      const paramName = getParameterName(lambdaAst as ArrowFunctionExpression);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const body = (lambdaAst as ArrowFunctionExpression).body;
      const selector =
        body.type === "BlockStatement" ? null : convertAstToExpression(body, context);
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
  methodName: string,
): OrderByOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const paramName = getParameterName(lambdaAst as ArrowFunctionExpression);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      const body = (lambdaAst as ArrowFunctionExpression).body;
      const keySelector =
        body.type === "BlockStatement" ? null : convertAstToExpression(body, context);

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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): TakeOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const arg = ast.arguments[0];
    if (!arg) return null;

    if (arg.type === "NumericLiteral") {
      return {
        type: "queryOperation",
        operationType: "take",
        source,
        count: (arg as NumericLiteral).value,
      };
    }
    if (arg.type === "Literal") {
      return {
        type: "queryOperation",
        operationType: "take",
        source,
        count: (arg as Literal).value as number,
      };
    }
    // Handle external parameter (e.g., p.limit)
    if (arg.type === "MemberExpression") {
      const memberExpr = arg as ASTMemberExpression;
      if (memberExpr.object.type === "Identifier" && memberExpr.property.type === "Identifier") {
        const objectName = (memberExpr.object as Identifier).name;
        const propertyName = (memberExpr.property as Identifier).name;
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
  }
  return null;
}

function convertSkipOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): SkipOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const arg = ast.arguments[0];
    if (!arg) return null;

    // Handle numeric literals
    if (arg.type === "NumericLiteral") {
      return {
        type: "queryOperation",
        operationType: "skip",
        source,
        count: (arg as NumericLiteral).value,
      };
    }
    if (arg.type === "Literal") {
      return {
        type: "queryOperation",
        operationType: "skip",
        source,
        count: (arg as Literal).value as number,
      };
    }

    // Handle any expression (including arithmetic, member access, etc.)
    const expr = convertAstToExpression(arg, context);
    if (expr) {
      // If it's a simple parameter reference, use it directly
      if (expr.type === "param") {
        return {
          type: "queryOperation",
          operationType: "skip",
          source,
          count: expr as ParameterExpression,
        };
      }

      // For other expressions (like arithmetic), use the expression directly
      // Note: This may be an arithmetic expression or other ValueExpression
      return {
        type: "queryOperation",
        operationType: "skip",
        source,
        count: expr as unknown as number | ParamRef, // Type assertion needed due to ValueExpression mismatch
      };
    }
  }
  return null;
}

function convertSkipWhileOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): SkipWhileOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      // Add the lambda parameter to table params
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (!bodyExpr) return null;
      const predicate = convertAstToExpression(bodyExpr, context);

      // Convert column to booleanColumn if needed
      let finalPredicate = predicate;
      if (predicate && predicate.type === "column") {
        finalPredicate = {
          type: "booleanColumn",
          name: (predicate as ColumnExpression).name,
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
  _isDefault: boolean,
): FirstOperation | null {
  let predicate: BooleanExpression | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && isBooleanExpression(expr)) {
          predicate = expr as BooleanExpression;
        }
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): FirstOrDefaultOperation | null {
  let predicate: BooleanExpression | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && isBooleanExpression(expr)) {
          predicate = expr as BooleanExpression;
        }
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): CountOperation | null {
  let predicate: BooleanExpression | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && isBooleanExpression(expr)) {
          predicate = expr as BooleanExpression;
        }
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): GroupByOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const keySelectorAst = ast.arguments[0];

    if (keySelectorAst && keySelectorAst.type === "ArrowFunctionExpression") {
      const arrowFunc = keySelectorAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const keySelector = convertAstToExpression(bodyExpr, context);

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
  }
  return null;
}

function convertJoinOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): JoinOperation | null {
  if (ast.arguments && ast.arguments.length >= 4) {
    // join(inner, outerKeySelector, innerKeySelector, resultSelector)
    const firstArg = ast.arguments[0];
    const innerSource = firstArg ? convertAstToQueryOperation(firstArg) : null;
    const outerKeySelectorAst = ast.arguments[1];
    const innerKeySelectorAst = ast.arguments[2];

    let outerKey: string | null = null;
    let innerKey: string | null = null;

    // Only support simple column selectors
    if (outerKeySelectorAst && outerKeySelectorAst.type === "ArrowFunctionExpression") {
      const outerArrow = outerKeySelectorAst as ArrowFunctionExpression;
      const paramName = getParameterName(outerArrow);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (outerArrow.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(outerArrow.body.body);
      } else {
        bodyExpr = outerArrow.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && expr.type === "column") {
          outerKey = (expr as ColumnExpression).name;
        }
      }
    }

    if (innerKeySelectorAst && innerKeySelectorAst.type === "ArrowFunctionExpression") {
      const innerArrow = innerKeySelectorAst as ArrowFunctionExpression;
      const paramName = getParameterName(innerArrow);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (innerArrow.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(innerArrow.body.body);
      } else {
        bodyExpr = innerArrow.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && expr.type === "column") {
          innerKey = (expr as ColumnExpression).name;
        }
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
  _ast: ASTCallExpression,
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
  methodName: string,
): ThenByOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const keySelector = convertAstToExpression(bodyExpr, context);

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
  }
  return null;
}

function convertSumOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): SumOperation | null {
  let selector: string | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && expr.type === "column") {
          selector = (expr as ColumnExpression).name;
        }
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): AverageOperation | null {
  let selector: string | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && expr.type === "column") {
          selector = (expr as ColumnExpression).name;
        }
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): MinOperation | null {
  let selector: string | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && expr.type === "column") {
          selector = (expr as ColumnExpression).name;
        }
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): MaxOperation | null {
  let selector: string | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && expr.type === "column") {
          selector = (expr as ColumnExpression).name;
        }
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
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
  methodName: string,
): SingleOperation | SingleOrDefaultOperation | null {
  let predicate: BooleanExpression | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && isBooleanExpression(expr)) {
          predicate = expr as BooleanExpression;
        }
      }
    }
  }

  const operation: SingleOperation | SingleOrDefaultOperation = {
    type: "queryOperation",
    operationType: methodName === "singleOrDefault" ? "singleOrDefault" : "single",
    source,
    predicate,
  };
  return operation;
}

function convertLastOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
  methodName: string,
): LastOperation | LastOrDefaultOperation | null {
  let predicate: BooleanExpression | undefined;

  if (ast.arguments && ast.arguments.length > 0) {
    const lambdaAst = ast.arguments[0];
    if (lambdaAst && lambdaAst.type === "ArrowFunctionExpression") {
      const arrowFunc = lambdaAst as ArrowFunctionExpression;
      const paramName = getParameterName(arrowFunc);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (arrowFunc.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(arrowFunc.body.body);
      } else {
        bodyExpr = arrowFunc.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && isBooleanExpression(expr)) {
          predicate = expr as BooleanExpression;
        }
      }
    }
  }

  const operation: LastOperation | LastOrDefaultOperation = {
    type: "queryOperation",
    operationType: methodName === "lastOrDefault" ? "lastOrDefault" : "last",
    source,
    predicate,
  };
  return operation;
}

function convertContainsOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): ContainsOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const valueArg = ast.arguments[0];
    if (valueArg) {
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
  }
  return null;
}

function convertUnionOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _context: ConversionContext,
): UnionOperation | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const secondArg = ast.arguments[0];
    if (secondArg) {
      const secondSource = convertAstToQueryOperation(secondArg);
      if (secondSource) {
        return {
          type: "queryOperation",
          operationType: "union",
          source,
          second: secondSource,
        };
      }
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

function convertIdentifier(ast: Identifier, context: ConversionContext): Expression | null {
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

function convertMemberExpression(
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

function convertBinaryExpression(
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

function convertLogicalExpression(
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

function convertLiteral(
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

function convertCallExpression(
  ast: ASTCallExpression,
  context: ConversionContext,
): Expression | null {
  // Handle string method calls
  if (ast.callee.type === "MemberExpression") {
    const memberCallee = ast.callee as ASTMemberExpression;
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

function convertObjectExpression(
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

function convertLambdaExpression(
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
