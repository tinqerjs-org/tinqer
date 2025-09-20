/**
 * Expression Types for Tinqer
 * Generic expression trees where simple cases are special cases of complex structures
 */

// Forward declaration of the Expression union type
export type Expression =
  | ConstantExpression
  | ParameterExpression
  | MemberExpression
  | BinaryExpression
  | LogicalExpression
  | UnaryExpression
  | CallExpression
  | ConditionalExpression
  | ArrayExpression
  | ObjectExpression
  | LambdaExpression;

/**
 * Expression type that excludes lambda (for storage in queryable)
 */
export type NonLambdaExpression = Exclude<Expression, LambdaExpression>;

/**
 * WHERE clause expressions - must evaluate to boolean
 */
export type WhereExpression =
  | BinaryExpression      // Comparisons: age > 18, name == "John"
  | LogicalExpression     // AND/OR: age > 18 && isActive
  | UnaryExpression       // NOT: !isActive (only with ! operator)
  | MemberExpression      // Boolean fields: u.isActive
  | CallExpression;       // Boolean methods: name.startsWith("A")

/**
 * HAVING clause expressions - aggregates with conditions
 */
export type HavingExpression =
  | BinaryExpression      // COUNT(*) > 5, AVG(price) < 100
  | LogicalExpression     // COUNT(*) > 5 && SUM(total) < 1000
  | UnaryExpression;      // Only negation (!)

/**
 * GROUP BY expressions - fields to group by
 */
export type GroupByExpression =
  | MemberExpression      // Single field: u.department
  | ObjectExpression;     // Composite: { dept: u.department, year: u.year }

/**
 * SELECT projection expressions
 */
export type SelectExpression =
  | ObjectExpression      // Object literal: { id: u.id, name: u.name }
  | CallExpression        // Aggregates: COUNT(*), SUM(amount)
  | MemberExpression      // Single field: u.name
  | BinaryExpression      // Computed: u.price * u.quantity
  | ConditionalExpression // Ternary: age > 18 ? "adult" : "minor"
  | ArrayExpression       // Array: [u.id, u.name]
  | ConstantExpression;   // Literal: 1, "value", true

/**
 * LIMIT/OFFSET expressions - must be numeric
 */
export type LimitOffsetExpression =
  | ConstantExpression    // Only numeric constants: 10
  | ParameterExpression   // External params: params.pageSize
  | MemberExpression;     // Field reference: params.limit

/**
 * ORDER BY key expressions
 */
export type OrderByExpression =
  | MemberExpression      // Field: u.name
  | BinaryExpression      // Computed: u.price * u.quantity
  | CallExpression        // Function: u.name.toLowerCase()
  | ConditionalExpression;// Conditional ordering

/**
 * Constant value (e.g., 18, "hello", true, null)
 */
export interface ConstantExpression {
  type: "constant";
  value: string | number | boolean | null | undefined;
}

/**
 * Parameter reference (e.g., u in "u => u.age", or params.minAge)
 */
export interface ParameterExpression {
  type: "parameter";
  name: string;
  origin?: ParameterOrigin;
}

/**
 * Member access (e.g., u.age, result.departmentName)
 */
export interface MemberExpression {
  type: "member";
  object?: Expression; // Optional for simple property access
  property: string;
}

/**
 * Binary operation (e.g., age >= 18, a == b)
 */
export interface BinaryExpression {
  type: "binary";
  operator: string; // "==", "!=", ">", "<", ">=", "<=", "+", "-", "*", "/", "%"
  left: Expression;
  right: Expression;
}

/**
 * Logical operation (e.g., a && b, x || y)
 */
export interface LogicalExpression {
  type: "logical";
  operator: "&&" | "||";
  left: Expression;
  right: Expression;
}

/**
 * Unary operation (e.g., !isActive, -count)
 */
export interface UnaryExpression {
  type: "unary";
  operator: string; // "!", "-", "+"
  operand: Expression;
}

/**
 * Function/method call (e.g., COUNT(*), name.toLowerCase())
 */
export interface CallExpression {
  type: "call";
  callee?: Expression; // Object for method calls
  method: string;
  arguments: Expression[];
}

/**
 * Conditional/ternary (e.g., age > 18 ? "adult" : "minor")
 */
export interface ConditionalExpression {
  type: "conditional";
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

/**
 * Array literal (e.g., [1, 2, 3])
 */
export interface ArrayExpression {
  type: "array";
  elements: Expression[];
}

/**
 * Object literal (e.g., { id: u.id, name: u.name })
 */
export interface ObjectExpression {
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
export interface LambdaExpression {
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