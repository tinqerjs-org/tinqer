/**
 * AST type definitions for OXC parser output
 * These types represent the JavaScript AST nodes returned by the OXC parser
 */

// Base AST node
export interface ASTNode {
  type: string;
}

// Program node (root of AST)
export interface Program extends ASTNode {
  type: "Program";
  body: Statement[];
  sourceType: "module" | "script";
}

// Expression Statement
export interface ExpressionStatement extends ASTNode {
  type: "ExpressionStatement";
  expression: Expression;
}

// Expressions
export interface Identifier extends ASTNode {
  type: "Identifier";
  name: string;
}

export interface MemberExpression extends ASTNode {
  type: "MemberExpression";
  object: Expression;
  property: Identifier;
  computed: boolean;
}

export interface CallExpression extends ASTNode {
  type: "CallExpression";
  callee: Expression | MemberExpression | Identifier;
  arguments: Expression[];
}

export interface ArrowFunctionExpression extends ASTNode {
  type: "ArrowFunctionExpression";
  params: Identifier[];
  body: Expression | BlockStatement;
}

export interface BinaryExpression extends ASTNode {
  type: "BinaryExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface LogicalExpression extends ASTNode {
  type: "LogicalExpression";
  operator: "&&" | "||";
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends ASTNode {
  type: "UnaryExpression";
  operator: string;
  argument: Expression;
}

export interface ConditionalExpression extends ASTNode {
  type: "ConditionalExpression";
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface ObjectExpression extends ASTNode {
  type: "ObjectExpression";
  properties: Property[];
}

export interface Property extends ASTNode {
  type: "Property";
  key: Identifier | Literal;
  value: Expression;
  kind: "init" | "get" | "set";
}

export interface ArrayExpression extends ASTNode {
  type: "ArrayExpression";
  elements: (Expression | null)[];
}

export interface ParenthesizedExpression extends ASTNode {
  type: "ParenthesizedExpression";
  expression: Expression;
}

export interface ChainExpression extends ASTNode {
  type: "ChainExpression";
  expression: Expression;
}

// Literals
export interface Literal extends ASTNode {
  type: "Literal" | "NumericLiteral" | "StringLiteral" | "BooleanLiteral" | "NullLiteral";
  value: string | number | boolean | null;
  raw?: string;
}

export interface NumericLiteral extends ASTNode {
  type: "NumericLiteral";
  value: number;
}

export interface StringLiteral extends ASTNode {
  type: "StringLiteral";
  value: string;
}

export interface BooleanLiteral extends ASTNode {
  type: "BooleanLiteral";
  value: boolean;
}

export interface NullLiteral extends ASTNode {
  type: "NullLiteral";
  value: null;
}

// Statements (for function bodies)
export interface BlockStatement extends ASTNode {
  type: "BlockStatement";
  body: Statement[];
}

export interface ReturnStatement extends ASTNode {
  type: "ReturnStatement";
  argument: Expression | null;
}

// Union types
export type Expression =
  | Identifier
  | MemberExpression
  | CallExpression
  | ArrowFunctionExpression
  | BinaryExpression
  | LogicalExpression
  | UnaryExpression
  | ConditionalExpression
  | ObjectExpression
  | ArrayExpression
  | ParenthesizedExpression
  | ChainExpression
  | Literal
  | NumericLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral;

export type Statement = BlockStatement | ReturnStatement | ExpressionStatement;

export type ASTNodeType = Expression | Statement;
