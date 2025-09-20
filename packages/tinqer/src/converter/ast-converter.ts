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

export class AstConverter {
  /**
   * Convert an OXC AST node to an Expression
   */
  static convert(node: any, context: ConversionContext = {}): Expression {
    if (!node) {
      return { type: "constant", value: null } as ConstantExpression;
    }

    switch (node.type) {
      case "Program":
        // Lambda strings parse to Program with single ExpressionStatement
        if (node.body?.length === 1 && node.body[0]?.type === "ExpressionStatement") {
          return this.convert(node.body[0].expression, context);
        }
        throw new Error("Complex program not supported");

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

      case "ReturnStatement":
        if (node.argument) {
          return this.convert(node.argument, context);
        }
        return { type: "constant", value: undefined } as ConstantExpression;

      case "ParenthesizedExpression":
        // Unwrap parentheses
        return this.convert(node.expression, context);

      default:
        throw new Error(`Unsupported AST node type: ${node.type}`);
    }
  }

  private static convertFunction(node: any, context: ConversionContext): LambdaExpression {
    // Extract parameter names
    const params: ParameterExpression[] = [];
    const paramNames = new Set<string>();

    if (node.params) {
      for (const param of node.params.items || node.params) {
        let paramName: string;
        if (param.pattern?.type === "BindingIdentifier") {
          paramName = param.pattern.name;
        } else if (param.type === "BindingIdentifier") {
          paramName = param.name;
        } else if (param.type === "Identifier") {
          paramName = param.name;
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
    if (node.body?.type === "FunctionBody" || node.body?.type === "BlockStatement") {
      body = this.convertBlockStatement(node.body, bodyContext);
    } else {
      body = this.convert(node.body, bodyContext);
    }

    return {
      type: "lambda",
      parameters: params,
      body,
    };
  }

  private static convertIdentifier(node: any, context: ConversionContext): Expression {
    const name = node.name;

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

  private static convertMemberExpression(node: any, context: ConversionContext): Expression {
    const object = this.convert(node.object, context);

    let property: string;
    if (node.computed) {
      // Handle computed properties like obj[0] or obj["prop"]
      if (node.property.type === "NumericLiteral") {
        property = String(node.property.value);
      } else if (node.property.type === "StringLiteral") {
        property = node.property.value;
      } else {
        throw new Error("Complex computed properties not supported");
      }
    } else {
      // Regular property access
      if (node.property.type === "IdentifierName" || node.property.type === "Identifier") {
        property = node.property.name;
      } else {
        throw new Error("Invalid property access");
      }
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

  private static convertBinaryExpression(node: any, context: ConversionContext): BinaryExpression {
    const left = this.convert(node.left, context);
    const right = this.convert(node.right, context);

    // Normalize === to == and !== to !=
    let operator = node.operator;
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
    node: any,
    context: ConversionContext,
  ): LogicalExpression {
    const left = this.convert(node.left, context);
    const right = this.convert(node.right, context);

    return {
      type: "logical",
      operator: node.operator,
      left,
      right,
    };
  }

  private static convertUnaryExpression(node: any, context: ConversionContext): UnaryExpression {
    const operand = this.convert(node.argument, context);

    return {
      type: "unary",
      operator: node.operator,
      operand,
    };
  }

  private static convertCallExpression(node: any, context: ConversionContext): CallExpression {
    // Check if it's a method call (e.g., name.toLowerCase())
    if (node.callee.type === "MemberExpression") {
      const memberExpr = node.callee;
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

      const args = node.arguments.map((arg: any) => this.convert(arg, context));

      return {
        type: "call",
        callee,
        method,
        arguments: args,
      };
    }

    // Handle regular function calls (like COUNT, SUM, etc.)
    if (node.callee.type === "Identifier" || node.callee.type === "IdentifierReference") {
      const method = node.callee.name;
      const args = node.arguments.map((arg: any) => this.convert(arg, context));

      return {
        type: "call",
        method,
        arguments: args,
      };
    }

    throw new Error("Complex function calls not supported");
  }

  private static convertConditionalExpression(
    node: any,
    context: ConversionContext,
  ): ConditionalExpression {
    const test = this.convert(node.test, context);
    const consequent = this.convert(node.consequent, context);
    const alternate = this.convert(node.alternate, context);

    return {
      type: "conditional",
      test,
      consequent,
      alternate,
    };
  }

  private static convertArrayExpression(node: any, context: ConversionContext): ArrayExpression {
    const elements = node.elements.map((el: any) => {
      if (!el) return { type: "constant", value: undefined } as ConstantExpression;
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

  private static convertObjectExpression(node: any, context: ConversionContext): ObjectExpression {
    const properties = node.properties.map((prop: any) => {
      if (prop.type === "SpreadElement") {
        throw new Error("Spread properties not supported");
      }

      let key: Expression;
      if (prop.key.type === "Identifier" || prop.key.type === "IdentifierName") {
        key = { type: "constant", value: prop.key.name } as ConstantExpression;
      } else if (prop.key.type === "StringLiteral") {
        key = { type: "constant", value: prop.key.value } as ConstantExpression;
      } else {
        throw new Error("Complex object keys not supported");
      }

      const value = this.convert(prop.value, context);

      return { key, value };
    });

    return {
      type: "object",
      properties,
    };
  }

  private static convertLiteral(node: any): ConstantExpression {
    return {
      type: "constant",
      value: node.value,
    };
  }

  private static convertBlockStatement(node: any, context: ConversionContext): Expression {
    const statements = node.statements || node.body || [];

    // Handle single return statement
    if (statements.length === 1 && statements[0].type === "ReturnStatement") {
      if (statements[0].argument) {
        return this.convert(statements[0].argument, context);
      }
      return { type: "constant", value: undefined } as ConstantExpression;
    }

    throw new Error("Complex block statements not supported");
  }
}
