/**
 * Main SQL generation orchestrator
 */

import type {
  QueryOperation,
  FromOperation,
  WhereOperation,
  SelectOperation,
  OrderByOperation,
  ThenByOperation,
  TakeOperation,
  SkipOperation,
  DistinctOperation,
  GroupByOperation,
  CountOperation,
  SumOperation,
  AverageOperation,
  MinOperation,
  MaxOperation,
  FirstOperation,
  SingleOperation,
  LastOperation,
  JoinOperation,
  UnionOperation,
} from "@webpods/tinqer";
import type { SqlContext } from "./types.js";
import { generateFrom } from "./generators/from.js";
import { generateSelect } from "./generators/select.js";
import { generateBooleanExpression } from "./expression-generator.js";
import { generateOrderBy } from "./generators/orderby.js";
import { generateThenBy } from "./generators/thenby.js";
import { generateTake } from "./generators/take.js";
import { generateSkip } from "./generators/skip.js";
import { generateDistinct } from "./generators/distinct.js";
import { generateGroupBy } from "./generators/groupby.js";
import { generateCount } from "./generators/count.js";
import { generateSum } from "./generators/sum.js";
import { generateAverage } from "./generators/average.js";
import { generateMin } from "./generators/min.js";
import { generateMax } from "./generators/max.js";
import { generateFirst } from "./generators/first.js";
import { generateSingle } from "./generators/single.js";
import { generateLast } from "./generators/last.js";
import { generateJoin } from "./generators/join.js";
import { generateUnion } from "./generators/union.js";

/**
 * Generate SQL from a QueryOperation tree
 */
export function generateSql(operation: QueryOperation, _params: unknown): string {
  const context: SqlContext = {
    tableAliases: new Map(),
    aliasCounter: 0,
    formatParameter: (paramName: string) => `$(${paramName})`, // pg-promise format
  };

  // Handle special operations first
  if (operation.operationType === "union") {
    return generateUnion(operation as UnionOperation, context);
  }

  // Collect all operations in the chain
  const operations = collectOperations(operation);

  // Build SQL fragments in correct order
  const fragments: string[] = [];

  // Check for DISTINCT
  const distinctOp = operations.find((op) => op.operationType === "distinct");
  const distinctKeyword = distinctOp
    ? generateDistinct(distinctOp as DistinctOperation, context)
    : "";

  // Check for aggregate operations
  const countOp = operations.find((op) => op.operationType === "count") as CountOperation;
  const sumOp = operations.find((op) => op.operationType === "sum") as SumOperation;
  const avgOp = operations.find((op) => op.operationType === "average") as AverageOperation;
  const minOp = operations.find((op) => op.operationType === "min") as MinOperation;
  const maxOp = operations.find((op) => op.operationType === "max") as MaxOperation;

  // Find and process SELECT or aggregate operation
  if (countOp) {
    fragments.push(`SELECT ${generateCount(countOp, context)}`);
  } else if (sumOp) {
    fragments.push(`SELECT ${generateSum(sumOp, context)}`);
  } else if (avgOp) {
    fragments.push(`SELECT ${generateAverage(avgOp, context)}`);
  } else if (minOp) {
    fragments.push(`SELECT ${generateMin(minOp, context)}`);
  } else if (maxOp) {
    fragments.push(`SELECT ${generateMax(maxOp, context)}`);
  } else {
    const selectOp = operations.find((op) => op.operationType === "select") as SelectOperation;
    if (selectOp) {
      const selectClause = generateSelect(selectOp, context);
      if (distinctKeyword) {
        fragments.push(selectClause.replace("SELECT", `SELECT ${distinctKeyword}`));
      } else {
        fragments.push(selectClause);
      }
    } else {
      // Default SELECT *
      fragments.push(distinctKeyword ? `SELECT ${distinctKeyword} *` : "SELECT *");
    }
  }

  // Process FROM
  const fromOp = operations.find((op) => op.operationType === "from") as FromOperation;
  if (!fromOp) {
    throw new Error("Query must have a FROM operation");
  }
  fragments.push(generateFrom(fromOp, context));

  // Process JOIN operations
  const joinOps = operations.filter((op) => op.operationType === "join") as JoinOperation[];
  joinOps.forEach((joinOp) => {
    fragments.push(generateJoin(joinOp, context));
  });

  // Process WHERE clauses (combine multiple with AND)
  const whereOps = operations.filter((op) => op.operationType === "where") as WhereOperation[];
  if (whereOps.length > 0) {
    const predicates = whereOps.map((whereOp) =>
      generateBooleanExpression(whereOp.predicate, context),
    );
    fragments.push(`WHERE ${predicates.join(" AND ")}`);
  }

  // Process GROUP BY
  const groupByOp = operations.find((op) => op.operationType === "groupBy") as GroupByOperation;
  if (groupByOp) {
    fragments.push(generateGroupBy(groupByOp, context));
  }

  // Process ORDER BY and THEN BY
  const orderByOp = operations.find((op) => op.operationType === "orderBy") as OrderByOperation;
  if (orderByOp) {
    let orderByClause = generateOrderBy(orderByOp, context);

    // Collect all THEN BY operations
    const thenByOps = operations.filter((op) => op.operationType === "thenBy") as ThenByOperation[];
    thenByOps.forEach((thenByOp) => {
      orderByClause += generateThenBy(thenByOp, context);
    });

    fragments.push(orderByClause);
  }

  // Process terminal operations
  const firstOp = operations.find((op) => op.operationType === "first") as FirstOperation;
  const singleOp = operations.find((op) => op.operationType === "single") as SingleOperation;
  const lastOp = operations.find((op) => op.operationType === "last") as LastOperation;

  if (firstOp) {
    const firstClause = generateFirst(firstOp, context);
    if (!firstClause.startsWith("LIMIT")) {
      fragments.push(firstClause);
    } else {
      fragments.push(firstClause);
    }
  } else if (singleOp) {
    fragments.push(generateSingle(singleOp, context));
  } else if (lastOp) {
    fragments.push(generateLast(lastOp, context));
  } else {
    // Process LIMIT/OFFSET
    const takeOp = operations.find((op) => op.operationType === "take") as TakeOperation;
    if (takeOp) {
      fragments.push(generateTake(takeOp, context));
    }

    const skipOp = operations.find((op) => op.operationType === "skip") as SkipOperation;
    if (skipOp) {
      fragments.push(generateSkip(skipOp, context));
    }
  }

  return fragments.join(" ");
}

/**
 * Collect all operations in the chain
 */
function collectOperations(operation: QueryOperation): QueryOperation[] {
  const operations: QueryOperation[] = [];
  let current: QueryOperation | undefined = operation;

  while (current) {
    operations.push(current);
    current = (current as any).source;
  }

  // Reverse to get operations in execution order (from -> where -> select)
  return operations.reverse();
}
