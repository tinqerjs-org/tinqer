/**
 * UPDATE SQL generation for PostgreSQL
 */

import type {
  UpdateOperation,
  Expression,
  ParameterExpression,
  ConstantExpression,
} from "@tinqerjs/tinqer";
import type { SqlContext } from "../types.js";
import { generateExpression, generateBooleanExpression } from "../expression-generator.js";

function shouldSkipAssignment(valueExpr: Expression, context: SqlContext): boolean {
  if (valueExpr.type === "param") {
    const paramExpr = valueExpr as ParameterExpression;
    const paramName = paramExpr.property || paramExpr.param;
    const params = context.params;
    if (!params) {
      return false;
    }
    if (Object.prototype.hasOwnProperty.call(params, paramName)) {
      return params[paramName] === undefined;
    }
    return true;
  }

  if (valueExpr.type === "constant") {
    const constant = valueExpr as ConstantExpression;
    return constant.value === undefined;
  }

  return false;
}

/**
 * Generate UPDATE SQL statement
 */
export function generateUpdate(operation: UpdateOperation, context: SqlContext): string {
  const tableName = operation.schema
    ? `"${operation.schema}"."${operation.table}"`
    : `"${operation.table}"`;

  // Extract SET assignments from the assignments object expression
  const assignments: string[] = [];

  if (operation.assignments.type === "object") {
    for (const [column, valueExpr] of Object.entries(operation.assignments.properties)) {
      if (shouldSkipAssignment(valueExpr, context)) {
        continue;
      }
      const value = generateExpression(valueExpr, context);
      assignments.push(`"${column}" = ${value}`);
    }
  }

  if (assignments.length === 0) {
    throw new Error(
      "UPDATE must specify at least one column assignment. All provided values were undefined.",
    );
  }

  let sql = `UPDATE ${tableName} SET ${assignments.join(", ")}`;

  // Add WHERE clause if specified
  if (operation.predicate) {
    const whereClause = generateBooleanExpression(operation.predicate, context);
    sql += ` WHERE ${whereClause}`;
  } else if (!operation.allowFullTableUpdate) {
    throw new Error(
      "UPDATE requires a WHERE clause or explicit allowFullTableUpdate(). " +
        "Full table updates are dangerous and must be explicitly allowed.",
    );
  }

  // Add RETURNING clause if specified
  if (operation.returning !== undefined) {
    // Handle AllColumnsExpression (identity function like .returning(u => u))
    if (operation.returning.type === "allColumns") {
      sql += ` RETURNING *`;
    } else {
      const returningExpr = generateExpression(operation.returning, context);
      sql += ` RETURNING ${returningExpr}`;
    }
  }

  return sql;
}
