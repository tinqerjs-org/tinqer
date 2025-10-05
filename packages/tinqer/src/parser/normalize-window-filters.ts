/**
 * Normalization pass that wraps queries in subqueries when WHERE clauses
 * reference window function columns defined in SELECT.
 *
 * This is necessary because SQL does not allow referencing window function
 * aliases in the WHERE clause of the same query level.
 */

import type {
  QueryOperation,
  FromOperation,
  WhereOperation,
  SelectOperation,
} from "../query-tree/operations.js";
import type {
  Expression,
  ObjectExpression,
  BooleanExpression,
  ColumnExpression,
} from "../expressions/expression.js";

/**
 * Result of normalization with window alias tracking
 */
interface NormalizeResult {
  operation: QueryOperation;
  windowAliases: Set<string>;
}

/**
 * Extract window function column names from a SELECT operation
 */
function getWindowAliasesFromSelect(
  selectOp: SelectOperation,
  parentAliases: Set<string>,
): Set<string> {
  const aliases = new Set<string>();

  if (!selectOp.selector) {
    // SELECT * - no new window aliases, but preserve parent ones
    return parentAliases;
  }

  if (selectOp.selector.type === "allColumns") {
    // SELECT all - preserve parent window aliases
    return parentAliases;
  }

  if (selectOp.selector.type === "object") {
    const objectExpr = selectOp.selector as ObjectExpression;

    for (const [propName, expr] of Object.entries(objectExpr.properties)) {
      // Direct window function
      if (expr.type === "windowFunction") {
        aliases.add(propName);
      }
      // Forwarded window alias: { newRn: r.rn } where "rn" is a window alias
      else if (expr.type === "column") {
        const colExpr = expr as ColumnExpression;
        if (parentAliases.has(colExpr.name)) {
          aliases.add(propName);
        }
      }
    }
  }

  return aliases;
}

/**
 * Check if a boolean expression references any columns in the given set
 */
function referencesColumns(expr: BooleanExpression, columnNames: Set<string>): boolean {
  switch (expr.type) {
    case "comparison":
      return (
        expressionReferencesColumns(expr.left, columnNames) ||
        expressionReferencesColumns(expr.right, columnNames)
      );

    case "logical":
      return (
        referencesColumns(expr.left, columnNames) || referencesColumns(expr.right, columnNames)
      );

    case "not":
      return referencesColumns(expr.expression, columnNames);

    case "booleanColumn":
      return columnNames.has(expr.name);

    case "in":
      return expressionReferencesColumns(expr.value, columnNames);

    case "isNull":
      return expressionReferencesColumns(expr.expression, columnNames);

    case "booleanMethod":
      return expressionReferencesColumns(expr.object, columnNames);

    case "caseInsensitiveFunction":
      return expr.arguments.some((arg) => expressionReferencesColumns(arg, columnNames));

    case "booleanConstant":
    case "booleanParam":
      return false;

    default:
      return false;
  }
}

/**
 * Check if a value expression references any columns in the given set
 */
function expressionReferencesColumns(expr: Expression, columnNames: Set<string>): boolean {
  if (!expr) {
    return false;
  }

  switch (expr.type) {
    case "column":
      return columnNames.has((expr as ColumnExpression).name);

    case "arithmetic":
      return (
        expressionReferencesColumns(expr.left, columnNames) ||
        expressionReferencesColumns(expr.right, columnNames)
      );

    case "concat":
      return (
        expressionReferencesColumns(expr.left, columnNames) ||
        expressionReferencesColumns(expr.right, columnNames)
      );

    case "stringMethod":
      return expressionReferencesColumns(expr.object, columnNames);

    case "case":
      return (
        expr.conditions.some(
          (c) =>
            referencesColumns(c.when, columnNames) ||
            expressionReferencesColumns(c.then, columnNames),
        ) || (expr.else ? expressionReferencesColumns(expr.else, columnNames) : false)
      );

    case "coalesce":
      return expr.expressions.some((e) => expressionReferencesColumns(e, columnNames));

    case "object":
      return Object.values((expr as ObjectExpression).properties).some((e) =>
        expressionReferencesColumns(e, columnNames),
      );

    case "constant":
    case "param":
    case "reference":
    case "allColumns":
    case "aggregate":
    case "windowFunction":
      return false;

    default:
      return false;
  }
}

/**
 * Recursively normalize operations and wrap WHERE clauses that reference window columns
 */
function visit(operation: QueryOperation, parentAliases: Set<string> = new Set()): NormalizeResult {
  // Handle WHERE operations specially - this is where wrapping happens
  if (operation.operationType === "where") {
    const whereOp = operation as WhereOperation;

    // First, recursively normalize the source
    const normalizedSource = visit(whereOp.source, parentAliases);

    // Check if this WHERE references any window aliases from the source
    if (
      referencesColumns(whereOp.predicate, normalizedSource.windowAliases) &&
      normalizedSource.windowAliases.size > 0
    ) {
      // Need to wrap - but don't wrap if source is already a subquery FROM
      const needsWrapping = !(
        normalizedSource.operation.operationType === "from" &&
        (normalizedSource.operation as FromOperation).subquery
      );

      if (needsWrapping) {
        // Get the original table name for aliasing
        const originalTableName = getOriginalTableName(normalizedSource.operation);

        // Create a subquery FROM operation
        const subqueryFrom: FromOperation = {
          type: "queryOperation",
          operationType: "from",
          subquery: normalizedSource.operation,
          aliasHint: originalTableName,
        };

        // Return wrapped WHERE with the subquery
        const wrappedWhere: WhereOperation = {
          type: "queryOperation",
          operationType: "where",
          source: subqueryFrom,
          predicate: whereOp.predicate,
        };

        return {
          operation: wrappedWhere,
          windowAliases: normalizedSource.windowAliases,
        };
      }
    }

    // No wrapping needed - return normalized WHERE
    const normalizedWhere: WhereOperation = {
      type: "queryOperation",
      operationType: "where",
      source: normalizedSource.operation,
      predicate: whereOp.predicate,
    };

    return {
      operation: normalizedWhere,
      windowAliases: normalizedSource.windowAliases,
    };
  }

  // Handle SELECT operations - track window aliases
  if (operation.operationType === "select") {
    const selectOp = operation as SelectOperation;
    const normalizedSource = visit(selectOp.source, parentAliases);

    // Extract window aliases from this SELECT
    const newAliases = getWindowAliasesFromSelect(selectOp, normalizedSource.windowAliases);

    const normalizedSelect: SelectOperation = {
      type: "queryOperation",
      operationType: "select",
      source: normalizedSource.operation,
      selector: selectOp.selector,
    };

    return {
      operation: normalizedSelect,
      windowAliases: newAliases,
    };
  }

  // For all other operations, recursively normalize source and propagate aliases
  const sourceOp = operation as { source?: QueryOperation };
  if (sourceOp.source) {
    const normalizedSource = visit(sourceOp.source, parentAliases);

    // We need to reconstruct the operation with the normalized source
    // Since we can't spread due to type constraints, handle common operations explicitly
    const reconstructed: QueryOperation = {
      ...operation,
      source: normalizedSource.operation,
    } as QueryOperation;

    return {
      operation: reconstructed,
      windowAliases: normalizedSource.windowAliases,
    };
  }

  // Base case: no source (e.g., FROM operation)
  return {
    operation,
    windowAliases: new Set(),
  };
}

/**
 * Get the original table name from an operation tree
 */
function getOriginalTableName(operation: QueryOperation): string | undefined {
  if (operation.operationType === "from") {
    const fromOp = operation as FromOperation;
    return fromOp.aliasHint || fromOp.table;
  }

  const sourceOp = operation as { source?: QueryOperation };
  if (sourceOp.source) {
    return getOriginalTableName(sourceOp.source);
  }

  return undefined;
}

/**
 * Main entry point: wrap queries that filter on window function columns
 */
export function wrapWindowFilters(operation: QueryOperation): QueryOperation {
  return visit(operation).operation;
}
