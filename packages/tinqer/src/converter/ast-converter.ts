/**
 * AST Converter
 * Converts OXC AST directly to Tinqer Expression trees
 */

import type {
  Expression,
  ConstantExpression,
  ParameterExpression,
  MemberExpression,
  BinaryExpression,
  LogicalExpression,
  UnaryExpression,
  CallExpression,
  ConditionalExpression,
  ArrayExpression,
  ObjectExpression,
  LambdaExpression,
  ParameterOrigin,
} from "../types/expressions.js";

export interface ConversionContext {
  parameterOrigin?: ParameterOrigin;
  lambdaParams?: Set<string>; // Track lambda parameter names
  externalParams?: Set<string>; // Track allowed external params (e.g., "params")
}

// Use 'any' for AST nodes since OXC doesn't export a complete union type
// We do proper type checking via the switch statement on node.type
type AstNode = {
  type: string;
  [key: string]: unknown;
};

export class AstConverter {
  /**
   * Convert an OXC AST node to an Expression
   */
  static convert(node: AstNode | null | undefined, context: ConversionContext = {}): Expression {
    if (!node) {
      return { type: "constant", value: null } as ConstantExpression;
    }

    switch (node.type) {
      case "Program": {
        // Lambda strings parse to Program with single ExpressionStatement
        const nodeBody = node.body as unknown as AstNode[] | undefined;
        if (nodeBody && nodeBody.length === 1 && nodeBody[0]?.type === "ExpressionStatement") {
          const expr = nodeBody[0] as { type: string; expression: AstNode };
          return this.convert(expr.expression, context);
        }
        throw new Error("Complex program not supported");
      }

      case "ArrowFunctionExpression":
      case "FunctionExpression":
        return this.convertFunction(node, context);

      case "Identifier":
      case "IdentifierReference":
        return this.convertIdentifier(node, context);

      case "MemberExpression":
        return this.convertMemberExpression(node, context);

      case "BinaryExpression":
        return this.convertBinaryExpression(node, context);

      case "LogicalExpression":
        return this.convertLogicalExpression(node, context);

      case "UnaryExpression":
        return this.convertUnaryExpression(node, context);

      case "CallExpression":
        return this.convertCallExpression(node, context);

      case "ConditionalExpression":
        return this.convertConditionalExpression(node, context);

      case "ArrayExpression":
        return this.convertArrayExpression(node, context);

      case "ObjectExpression":
        return this.convertObjectExpression(node, context);

      case "BooleanLiteral":
      case "NumericLiteral":
      case "StringLiteral":
      case "NullLiteral":
      case "Literal":
        return this.convertLiteral(node);

      case "BlockStatement":
      case "FunctionBody":
        return this.convertBlockStatement(node, context);

      case "ReturnStatement": {
        const nodeArg = node.argument as AstNode | undefined;
        if (nodeArg) {
          return this.convert(nodeArg, context);
        }
        return { type: "constant", value: undefined } as ConstantExpression;
      }

      case "ParenthesizedExpression": {
        // Unwrap parentheses
        const nodeExpr = node.expression as AstNode;
        return this.convert(nodeExpr, context);
      }

      default:
        throw new Error(`Unsupported AST node type: ${node.type}`);
    }
  }

  private static convertFunction(node: AstNode, context: ConversionContext): LambdaExpression {
    // Extract parameter names
    const params: ParameterExpression[] = [];
    const paramNames = new Set<string>();

    const nodeParams = node.params as unknown[];
    if (nodeParams) {
      for (const param of nodeParams) {
        let paramName: string;
        const p = param as {
          type?: string;
          name?: string;
          pattern?: { type: string; name?: string };
        };

        // Handle different parameter patterns
        if (p.type === "BindingIdentifier" && p.name) {
          paramName = p.name;
        } else if (p.pattern?.type === "BindingIdentifier" && p.pattern.name) {
          paramName = p.pattern.name;
        } else if (p.type === "Identifier" && p.name) {
          paramName = p.name;
        } else {
          throw new Error("Complex function parameters not supported");
        }

        params.push({
          type: "parameter",
          name: paramName,
          origin: context.parameterOrigin,
        });
        paramNames.add(paramName);
      }
    }

    // Create context for function body
    const bodyContext: ConversionContext = {
      ...context,
      lambdaParams: paramNames,
    };

    // Convert body
    let body: Expression;
    const funcBody = node.body as AstNode | undefined;
    if (funcBody && (funcBody.type === "FunctionBody" || funcBody.type === "BlockStatement")) {
      body = this.convertBlockStatement(funcBody, bodyContext);
    } else {
      body = this.convert(funcBody, bodyContext);
    }

    return {
      type: "lambda",
      parameters: params,
      body,
    };
  }

  private static convertIdentifier(node: AstNode, context: ConversionContext): Expression {
    const name = String(node.name);

    // Check if it's a lambda parameter
    if (context.lambdaParams?.has(name)) {
      return {
        type: "parameter",
        name,
        origin: context.parameterOrigin,
      } as ParameterExpression;
    }

    // Check if it's an allowed external parameter (like "params")
    if (context.externalParams?.has(name)) {
      return {
        type: "parameter",
        name,
        origin: { type: "external" },
      } as ParameterExpression;
    }

    // Check for boolean literals
    if (name === "true" || name === "false") {
      return { type: "constant", value: name === "true" } as ConstantExpression;
    }

    // Check for null/undefined
    if (name === "null") {
      return { type: "constant", value: null } as ConstantExpression;
    }
    if (name === "undefined") {
      return { type: "constant", value: undefined } as ConstantExpression;
    }

    // If we have externalParams defined and this isn't in it, it's an error
    if (context.externalParams && context.externalParams.size > 0) {
      throw new Error(
        `Reference to '${name}' not allowed. Only lambda parameters and 'params' are accessible.`,
      );
    }

    // Otherwise treat as constant (for cases where we're not validating)
    return { type: "constant", value: name } as ConstantExpression;
  }

  private static convertMemberExpression(node: AstNode, context: ConversionContext): Expression {
    const memberObject = node.object as AstNode;
    const object = this.convert(memberObject, context);

    let property: string;
    if ("computed" in node && node.computed === true) {
      // Handle computed properties like obj[0] or obj["prop"]
      const propExpr = node.property as AstNode;
      if (propExpr.type === "NumericLiteral") {
        property = String(propExpr.value);
      } else if (propExpr.type === "StringLiteral") {
        property = String(propExpr.value);
      } else {
        throw new Error("Complex computed properties not supported");
      }
    } else {
      // Regular property access - property is IdentifierName or Identifier
      const prop = node.property as { type: string; name: string };
      property = prop.name;
    }

    // Special handling for params.xxx
    if (object.type === "parameter" && (object as ParameterExpression).name === "params") {
      // This is accessing an external parameter
      return {
        type: "parameter",
        name: property,
        origin: { type: "external" },
      } as ParameterExpression;
    }

    return {
      type: "member",
      object,
      property,
    } as MemberExpression;
  }

  private static convertBinaryExpression(
    node: AstNode,
    context: ConversionContext,
  ): BinaryExpression {
    const binaryLeft = node.left as AstNode;
    const binaryRight = node.right as AstNode;
    const left = this.convert(binaryLeft, context);
    const right = this.convert(binaryRight, context);

    // Normalize === to == and !== to !=
    let operator = String(node.operator);
    if (operator === "===") operator = "==";
    if (operator === "!==") operator = "!=";

    return {
      type: "binary",
      operator,
      left,
      right,
    };
  }

  private static convertLogicalExpression(
    node: AstNode,
    context: ConversionContext,
  ): LogicalExpression {
    const logicalLeft = node.left as AstNode;
    const logicalRight = node.right as AstNode;
    const left = this.convert(logicalLeft, context);
    const right = this.convert(logicalRight, context);

    // OXC uses "&&", "||", and "??" operators
    // We only support && and ||
    const operator = String(node.operator);
    if (operator !== "&&" && operator !== "||") {
      throw new Error(`Unsupported logical operator: ${operator}`);
    }

    return {
      type: "logical",
      operator: operator === "&&" ? "&&" : "||",
      left,
      right,
    };
  }

  private static convertUnaryExpression(
    node: AstNode,
    context: ConversionContext,
  ): UnaryExpression {
    const unaryArg = node.argument as AstNode;
    const operand = this.convert(unaryArg, context);

    return {
      type: "unary",
      operator: String(node.operator),
      operand,
    };
  }

  private static convertCallExpression(node: AstNode, context: ConversionContext): CallExpression {
    const calleeNode = node.callee as AstNode;
    // Check if it's a method call (e.g., name.toLowerCase())
    if (calleeNode.type === "MemberExpression") {
      const memberExpr = calleeNode as {
        type: string;
        object: AstNode;
        property: { type: string; name: string };
      };
      const callee = this.convert(memberExpr.object, context);

      let method: string;
      if (
        memberExpr.property.type === "IdentifierName" ||
        memberExpr.property.type === "Identifier"
      ) {
        method = memberExpr.property.name;
      } else {
        throw new Error("Complex method names not supported");
      }

      const nodeArgs = node.arguments as AstNode[];
      const args = nodeArgs.map((arg: AstNode) => this.convert(arg, context));

      return {
        type: "call",
        callee,
        method,
        arguments: args,
      };
    }

    // Handle regular function calls (like COUNT, SUM, etc.)
    if (calleeNode.type === "Identifier" || calleeNode.type === "IdentifierReference") {
      const identifierNode = calleeNode as { type: string; name: string };
      const method = identifierNode.name;
      const nodeArgs = node.arguments as AstNode[];
      const args = nodeArgs.map((arg: AstNode) => this.convert(arg, context));

      return {
        type: "call",
        method,
        arguments: args,
      };
    }

    throw new Error("Complex function calls not supported");
  }

  private static convertConditionalExpression(
    node: AstNode,
    context: ConversionContext,
  ): ConditionalExpression {
    const testNode = node.test as AstNode;
    const consequentNode = node.consequent as AstNode;
    const alternateNode = node.alternate as AstNode;
    const test = this.convert(testNode, context);
    const consequent = this.convert(consequentNode, context);
    const alternate = this.convert(alternateNode, context);

    return {
      type: "conditional",
      test,
      consequent,
      alternate,
    };
  }

  private static convertArrayExpression(
    node: AstNode,
    context: ConversionContext,
  ): ArrayExpression {
    const elementsArray = node.elements as (AstNode | null)[];
    const elements = elementsArray.map((el: AstNode | null) => {
      if (!el) return { type: "constant", value: undefined };
      if (el.type === "SpreadElement") {
        throw new Error("Spread elements not supported");
      }
      return this.convert(el, context);
    });

    return {
      type: "array",
      elements,
    };
  }

  private static convertObjectExpression(
    node: AstNode,
    context: ConversionContext,
  ): ObjectExpression {
    const propertiesArray = node.properties as AstNode[];
    const properties = propertiesArray.map((propKind: AstNode) => {
      if (propKind.type === "SpreadElement") {
        throw new Error("Spread properties not supported");
      }

      // It's an ObjectProperty
      const prop = propKind as { type: "Property"; key: AstNode; value: AstNode };

      let key: Expression;
      const propKey = prop.key;
      if ("type" in propKey) {
        if (propKey.type === "Identifier" || propKey.type === "IdentifierName") {
          key = { type: "constant", value: propKey.name as string } as ConstantExpression;
        } else if (propKey.type === "StringLiteral") {
          key = { type: "constant", value: propKey.value as string } as ConstantExpression;
        } else {
          throw new Error("Complex object keys not supported");
        }
      } else {
        throw new Error("Unknown property key type");
      }

      const value = this.convert(prop.value, context);

      return { key, value };
    });

    return {
      type: "object",
      properties,
    };
  }

  private static convertLiteral(node: AstNode): ConstantExpression {
    const literalValue = node.value as string | number | boolean | null | undefined;
    return {
      type: "constant",
      value: literalValue,
    } as ConstantExpression;
  }

  private static convertBlockStatement(node: AstNode, context: ConversionContext): Expression {
    const statements = (node.statements || node.body || []) as AstNode[];

    // Handle single return statement
    if (statements.length === 1 && statements[0]?.type === "ReturnStatement") {
      const returnStmt = statements[0] as { type: string; argument?: AstNode };
      if (returnStmt.argument) {
        return this.convert(returnStmt.argument, context);
      }
      return { type: "constant", value: undefined } as ConstantExpression;
    }

    throw new Error("Complex block statements not supported");
  }
}
