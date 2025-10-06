/**
 * Core visitor types and context definitions
 *
 * Visitors are pure functions that transform AST nodes into expressions
 * Context provides environment information needed during traversal
 */

import type {
  Expression,
  BooleanExpression,
  ValueExpression,
  ObjectExpression,
  ArrayExpression,
} from "../expressions/expression.js";

import type { ASTNode, Expression as ASTExpression } from "../parser/ast-types.js";

import type { ObjectShapeNode } from "../query-tree/operations.js";

// ==================== Visitor Type Definitions ====================

/**
 * Base visitor function signature
 * Pure function that transforms an AST node to a result type
 */
export type Visitor<TNode = ASTNode, TContext = VisitorContext, TResult = Expression | null> = (
  node: TNode,
  context: TContext,
) => TResult;

/**
 * Specialized visitor types for different contexts
 */
export type BooleanVisitor = Visitor<ASTExpression, BooleanContext, BooleanExpression | null>;
export type ValueVisitor = Visitor<ASTExpression, ValueContext, ValueExpression | null>;
export type ObjectVisitor = Visitor<ASTExpression, ObjectContext, ObjectExpression | null>;
export type ArrayVisitor = Visitor<ASTExpression, ArrayContext, ArrayExpression | null>;
export type ExpressionVisitor = Visitor<ASTExpression, VisitorContext, Expression | null>;

// ==================== Context Definitions ====================

/**
 * Enhanced auto-parameter information with field context
 */
export interface AutoParamInfo {
  value: string | number | boolean | null;
  fieldName?: string; // e.g., "age", "name", "LIMIT", "OFFSET"
  tableName?: string; // e.g., "users", "orders"
  sourceTable?: number; // For JOINs: 0 = outer, 1 = inner
}

/**
 * Base visitor context with common information
 */
export interface VisitorContext {
  // Parameter tracking
  queryBuilderParam?: string; // DSL parameter name (ctx in (q, p, h) => q.from("users"))
  tableParams: Set<string>; // Table parameter names (x in x => x.name)
  queryParams: Set<string>; // Query parameter names (p in (p) => p.minAge)
  helpersParam?: string; // Helpers parameter name (_ in (p, _) => h.functions.iequals)
  groupingParams?: Set<string>; // Grouping parameter names for aggregates

  // Auto-parameterization
  autoParams: Map<string, unknown>; // Generated parameter names -> values
  autoParamCounter: number; // Counter for generating unique param names
  autoParamInfos?: Map<string, AutoParamInfo>; // Enhanced field context information

  // JOIN context
  joinParams?: Map<string, number>; // JOIN parameter -> table index mapping
  joinResultParam?: string; // JOIN result parameter name
  currentResultShape?: ObjectShapeNode; // Shape of JOIN result

  // Current parsing context
  currentTable?: string; // Current table being processed
  inSelectProjection?: boolean; // Whether we're in a SELECT projection
  hasTableParam?: boolean; // Whether lambda has table parameter

  // Expected result type (guides visitor selection)
  expectedType?: "boolean" | "value" | "object" | "array" | "any";
}

/**
 * Context for boolean expressions (WHERE, JOIN ON, etc.)
 */
export interface BooleanContext extends VisitorContext {
  expectedType: "boolean";
}

/**
 * Context for value expressions (arithmetic, column access, etc.)
 */
export interface ValueContext extends VisitorContext {
  expectedType: "value";
}

/**
 * Context for object expressions (SELECT projections)
 */
export interface ObjectContext extends VisitorContext {
  expectedType: "object";
}

/**
 * Context for array expressions
 */
export interface ArrayContext extends VisitorContext {
  expectedType: "array";
}

/**
 * Context for GROUP BY key selection
 */
export interface KeyContext extends VisitorContext {
  expectedType: "value";
  allowComposite?: boolean; // Whether composite keys are allowed
}

/**
 * Context for aggregate expressions
 */
export interface AggregateContext extends VisitorContext {
  expectedType: "value";
  inAggregate: true;
}

// ==================== Visitor Registry ====================

/**
 * Registry of visitors for different AST node types
 * Each context can have its own set of visitors
 */
export interface VisitorRegistry {
  // Common visitors (used across contexts)
  common: Map<string, ExpressionVisitor>;

  // Context-specific visitors
  boolean: Map<string, BooleanVisitor>;
  value: Map<string, ValueVisitor>;
  object: Map<string, ObjectVisitor>;
  array: Map<string, ArrayVisitor>;
}

// ==================== Helper Functions ====================

/**
 * Create a base context with common properties
 */
export function createBaseContext(): VisitorContext {
  return {
    tableParams: new Set<string>(),
    queryParams: new Set<string>(),
    autoParams: new Map<string, unknown>(),
    autoParamCounter: 0,
  };
}

/**
 * Create a boolean context from a base context
 */
export function toBooleanContext(context: VisitorContext): BooleanContext {
  return {
    ...context,
    expectedType: "boolean",
  };
}

/**
 * Create a value context from a base context
 */
export function toValueContext(context: VisitorContext): ValueContext {
  return {
    ...context,
    expectedType: "value",
  };
}

/**
 * Create an object context from a base context
 */
export function toObjectContext(context: VisitorContext): ObjectContext {
  return {
    ...context,
    expectedType: "object",
  };
}

/**
 * Create an array context from a base context
 */
export function toArrayContext(context: VisitorContext): ArrayContext {
  return {
    ...context,
    expectedType: "array",
  };
}

/**
 * Create an auto-parameterized parameter
 */
export function createAutoParam(
  context: VisitorContext,
  value: unknown,
  options: {
    fieldName?: string;
    tableName?: string;
    sourceTable?: number;
  } = {},
): string {
  // Generate simple sequential parameter names to match existing tests
  // Format: __p1, __p2, __p3, etc.
  context.autoParamCounter++;
  const paramName = `__p${context.autoParamCounter}`;

  context.autoParams.set(paramName, value);

  // Store enhanced field context if available
  if (context.autoParamInfos) {
    context.autoParamInfos.set(paramName, {
      value: value as string | number | boolean | null,
      fieldName: options.fieldName,
      tableName: options.tableName,
      sourceTable: options.sourceTable,
    });
  }

  return paramName;
}
