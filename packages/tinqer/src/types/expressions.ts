/**
 * Expression Types for Tinqer
 * Generic expression trees where simple cases are special cases of complex structures
 */

/**
 * Base expression interface
 */
export interface Expression {
  type: string;
}

/**
 * Constant value (e.g., 18, "hello", true, null)
 */
export interface ConstantExpression extends Expression {
  type: "constant";
  value: string | number | boolean | null | undefined;
}

/**
 * Parameter reference (e.g., u in "u => u.age", or params.minAge)
 */
export interface ParameterExpression extends Expression {
  type: "parameter";
  name: string;
  origin?: ParameterOrigin;
}

/**
 * Member access (e.g., u.age, result.departmentName)
 */
export interface MemberExpression extends Expression {
  type: "member";
  object?: Expression; // Optional for simple property access
  property: string;
}

/**
 * Binary operation (e.g., age >= 18, a == b)
 */
export interface BinaryExpression extends Expression {
  type: "binary";
  operator: string; // "==", "!=", ">", "<", ">=", "<=", "+", "-", "*", "/", "%"
  left: Expression;
  right: Expression;
}

/**
 * Logical operation (e.g., a && b, x || y)
 */
export interface LogicalExpression extends Expression {
  type: "logical";
  operator: "&&" | "||";
  left: Expression;
  right: Expression;
}

/**
 * Unary operation (e.g., !isActive, -count)
 */
export interface UnaryExpression extends Expression {
  type: "unary";
  operator: string; // "!", "-", "+"
  operand: Expression;
}

/**
 * Function/method call (e.g., COUNT(*), name.toLowerCase())
 */
export interface CallExpression extends Expression {
  type: "call";
  callee?: Expression; // Object for method calls
  method: string;
  arguments: Expression[];
}

/**
 * Conditional/ternary (e.g., age > 18 ? "adult" : "minor")
 */
export interface ConditionalExpression extends Expression {
  type: "conditional";
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

/**
 * Array literal (e.g., [1, 2, 3])
 */
export interface ArrayExpression extends Expression {
  type: "array";
  elements: Expression[];
}

/**
 * Object literal (e.g., { id: u.id, name: u.name })
 */
export interface ObjectExpression extends Expression {
  type: "object";
  properties: ObjectProperty[];
}

export interface ObjectProperty {
  key: Expression;
  value: Expression;
}

/**
 * Lambda function (e.g., u => u.age > 18)
 */
export interface LambdaExpression extends Expression {
  type: "lambda";
  parameters: ParameterExpression[];
  body: Expression;
}

/**
 * Parameter origin tracking - where does this parameter come from?
 */
export interface ParameterOrigin {
  type: "table" | "external" | "joined" | "cte" | "subquery";
  ref?: string; // Table name, CTE name, etc.
}
