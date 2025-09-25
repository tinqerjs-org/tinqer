/**
 * Main visitor entry point
 * Dispatches to appropriate visitors based on node type and context
 */

import type {
  Expression,
  BooleanExpression,
  BooleanColumnExpression,
  ValueExpression,
  ArithmeticExpression,
  ConcatExpression,
  ConditionalExpression,
  ColumnExpression,
} from "../expressions/expression.js";

import type {
  ASTNode,
  Expression as ASTExpression,
  Identifier,
  MemberExpression as ASTMemberExpression,
  BinaryExpression as ASTBinaryExpression,
  LogicalExpression as ASTLogicalExpression,
  UnaryExpression as ASTUnaryExpression,
  CallExpression as ASTCallExpression,
  ObjectExpression as ASTObjectExpression,
  ArrayExpression as ASTArrayExpression,
  ArrowFunctionExpression,
  ConditionalExpression as ASTConditionalExpression,
  ChainExpression as ASTChainExpression,
  ParenthesizedExpression,
  Literal,
  NumericLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,
} from "../parser/ast-types.js";

import type { VisitorContext } from "./types.js";
import { createAutoParam } from "./types.js";

// Common visitors
import { visitIdentifier } from "./common/identifier.js";
import { visitLiteral } from "./common/literal.js";
import { visitMemberAccess } from "./common/member-access.js";

// Boolean visitors
import { visitComparison } from "./boolean/comparison.js";
import { visitLogical } from "./boolean/logical.js";

// Value visitors
import { visitObject } from "./value/object-literal.js";
import { visitArray } from "./value/array-literal.js";
import { visitCall } from "./value/call-expression.js";

// Utils
import { isBooleanExpression, isValueExpression, isLikelyStringColumn, isLikelyStringParam } from "./utils.js";

/**
 * Main visitor dispatcher
 * Routes to appropriate visitor based on node type and context
 */
export function visitExpression(
  node: ASTExpression,
  context: VisitorContext
): Expression | null {
  if (!node) return null;

  switch (node.type) {
    case "Identifier":
      return visitIdentifier(node as Identifier, context);

    case "MemberExpression":
      return visitMemberAccess(
        node as ASTMemberExpression,
        context,
        (n, ctx) => visitExpression(n as ASTExpression, ctx)
      );

    case "Literal":
    case "NumericLiteral":
    case "StringLiteral":
    case "BooleanLiteral":
    case "NullLiteral":
      return visitLiteral(
        node as Literal | NumericLiteral | StringLiteral | BooleanLiteral | NullLiteral,
        context
      );

    case "BinaryExpression":
      return visitBinaryExpression(node as ASTBinaryExpression, context);

    case "LogicalExpression":
      return visitLogical(
        node as ASTLogicalExpression,
        context,
        (n, ctx) => visitExpression(n as ASTExpression, ctx)
      );

    case "UnaryExpression":
      return visitUnaryExpression(node as ASTUnaryExpression, context);

    case "CallExpression":
      return visitCall(
        node as ASTCallExpression,
        context,
        (n, ctx) => visitExpression(n as ASTExpression, ctx)
      );

    case "ObjectExpression":
      return visitObject(
        node as ASTObjectExpression,
        context,
        (n, ctx) => visitExpression(n as ASTExpression, ctx)
      );

    case "ArrayExpression":
      return visitArray(
        node as ASTArrayExpression,
        context,
        (n, ctx) => visitExpression(n as ASTExpression, ctx)
      );

    case "ArrowFunctionExpression":
      return visitLambda(node as ArrowFunctionExpression, context);

    case "ConditionalExpression":
      return visitConditional(node as ASTConditionalExpression, context);

    case "ChainExpression":
      // Optional chaining - unwrap and process inner expression
      return visitExpression((node as ASTChainExpression).expression, context);

    case "ParenthesizedExpression":
      // Parentheses - unwrap and process inner expression
      return visitExpression((node as ParenthesizedExpression).expression, context);

    default:
      throw new Error(`Unsupported AST node type: ${(node as ASTNode).type}`);
  }
}

/**
 * Visit binary expression (arithmetic or comparison)
 */
function visitBinaryExpression(
  node: ASTBinaryExpression,
  context: VisitorContext
): Expression | null {
  const operator = node.operator;

  // Comparison operators
  if (["==", "===", "!=", "!==", ">", ">=", "<", "<="].includes(operator)) {
    return visitComparison(node, context, (n, ctx) => visitExpression(n as ASTExpression, ctx));
  }

  // Arithmetic/concatenation operators
  if (["+", "-", "*", "/", "%"].includes(operator)) {
    return visitArithmeticOrConcat(node, context);
  }

  return null;
}

/**
 * Visit arithmetic or concatenation expression
 */
function visitArithmeticOrConcat(
  node: ASTBinaryExpression,
  context: VisitorContext
): ArithmeticExpression | ConcatExpression | null {
  // Convert operands
  const left = isLiteralNode(node.left)
    ? visitLiteral(node.left as Literal, context)
    : visitExpression(node.left, context);

  const right = isLiteralNode(node.right)
    ? visitLiteral(node.right as Literal, context)
    : visitExpression(node.right, context);

  if (!left || !right || !isValueExpression(left) || !isValueExpression(right)) {
    throw new Error(`Failed to convert binary expression with operator '${node.operator}'`);
  }

  // Check for string concatenation (+ operator)
  if (node.operator === "+") {
    // Validate no table-less expressions in SELECT
    if (context.inSelectProjection && context.hasTableParam === false) {
      const leftIsNonTable = left.type === "constant" ||
        (left.type === "param" && !context.tableParams.has((left as { param: string }).param));
      const rightIsNonTable = right.type === "constant" ||
        (right.type === "param" && !context.tableParams.has((right as { param: string }).param));

      if (leftIsNonTable && rightIsNonTable) {
        throw new Error(
          "Expressions without table context are not allowed in SELECT projections. " +
          "Use a table parameter (e.g., select(i => ...) instead of select(() => ...))."
        );
      }
    }

    // Check if either side is string-like
    const leftIsString = isStringExpression(left as ValueExpression);
    const rightIsString = isStringExpression(right as ValueExpression);

    if (leftIsString || rightIsString) {
      return {
        type: "concat",
        left: left as ValueExpression,
        right: right as ValueExpression,
      } as ConcatExpression;
    }
  }

  // Regular arithmetic
  return {
    type: "arithmetic",
    operator: node.operator as "+" | "-" | "*" | "/" | "%",
    left: left as ValueExpression,
    right: right as ValueExpression,
  } as ArithmeticExpression;
}

/**
 * Visit unary expression (!, -, +)
 */
function visitUnaryExpression(
  node: ASTUnaryExpression,
  context: VisitorContext
): Expression | null {
  // Logical NOT
  if (node.operator === "!") {
    const expr = visitExpression(node.argument, context);

    // Convert column to booleanColumn if needed
    let finalExpr = expr;
    if (expr?.type === "column") {
      const col = expr as ColumnExpression;
      const boolCol: BooleanColumnExpression = {
        type: "booleanColumn",
        name: col.name,
        ...(col.table ? { table: col.table } : {})
      } as BooleanColumnExpression;
      finalExpr = boolCol;
    }

    if (finalExpr && isBooleanExpression(finalExpr)) {
      return {
        type: "not",
        expression: finalExpr as BooleanExpression,
      };
    }
  }

  // Unary minus
  if (node.operator === "-") {
    // Negative numeric literal
    if (node.argument.type === "NumericLiteral") {
      const value = -(node.argument as NumericLiteral).value;
      const paramName = createAutoParam(context, value);
      return { type: "param", param: paramName };
    }
    if (node.argument.type === "Literal") {
      const literalValue = (node.argument as Literal).value;
      if (typeof literalValue === "number") {
        const value = -literalValue;
        const paramName = createAutoParam(context, value);
        return { type: "param", param: paramName };
      }
    }

    // Negate other expressions
    const argExpr = visitExpression(node.argument, context);
    if (argExpr) {
      return {
        type: "arithmetic",
        operator: "*",
        left: { type: "constant", value: -1 },
        right: argExpr,
      } as ArithmeticExpression;
    }
  }

  // Unary plus (pass through)
  if (node.operator === "+") {
    return visitExpression(node.argument, context);
  }

  return null;
}

/**
 * Visit lambda expression
 */
function visitLambda(
  node: ArrowFunctionExpression,
  context: VisitorContext
): Expression | null {
  const params = node.params.map((p: Identifier) => ({ name: p.name }));

  // Get body expression
  let bodyExpr: ASTExpression | null = null;
  if (node.body.type === "BlockStatement") {
    // Look for return statement
    const returnStmt = node.body.body.find(
      (stmt: unknown) => (stmt as { type?: string }).type === "ReturnStatement"
    );
    if (returnStmt) {
      bodyExpr = (returnStmt as { argument?: ASTExpression }).argument || null;
    }
  } else {
    bodyExpr = node.body;
  }

  if (!bodyExpr) return null;
  const body = visitExpression(bodyExpr, context);
  if (!body) return null;

  return {
    type: "lambda",
    parameters: params,
    body,
  };
}

/**
 * Visit conditional (ternary) expression
 */
function visitConditional(
  node: ASTConditionalExpression,
  context: VisitorContext
): ConditionalExpression | null {
  const condition = visitExpression(node.test, context);
  const thenExpr = visitExpression(node.consequent, context);
  const elseExpr = visitExpression(node.alternate, context);

  if (!condition || !thenExpr || !elseExpr) return null;

  // Ensure condition is boolean
  let booleanCondition: BooleanExpression;
  if (isBooleanExpression(condition)) {
    booleanCondition = condition as BooleanExpression;
  } else if (condition.type === "column") {
    // Convert column to booleanColumn
    const col = condition as ColumnExpression;
    const boolCol: BooleanColumnExpression = {
      type: "booleanColumn",
      name: col.name,
      ...(col.table ? { table: col.table } : {})
    } as BooleanColumnExpression;
    booleanCondition = boolCol;
  } else {
    return null;
  }

  return {
    type: "conditional",
    condition: booleanCondition,
    then: thenExpr,
    else: elseExpr,
  };
}

// Helper functions

function isLiteralNode(node: unknown): boolean {
  if (!node) return false;
  const type = (node as { type?: string }).type;
  return ["Literal", "NumericLiteral", "StringLiteral", "BooleanLiteral", "NullLiteral"].includes(type || "");
}

function isStringExpression(expr: ValueExpression): boolean {
  if (expr.type === "constant") {
    return typeof expr.value === "string";
  }
  if (expr.type === "concat") {
    return true;
  }
  if (expr.type === "column") {
    return isLikelyStringColumn(expr.name);
  }
  if (expr.type === "param" && expr.property) {
    return isLikelyStringParam(expr.property);
  }
  return false;
}