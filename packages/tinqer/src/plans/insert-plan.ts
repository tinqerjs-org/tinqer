import type { DatabaseSchema } from "../linq/database-context.js";
import type { QueryBuilder } from "../linq/query-builder.js";
import type { QueryHelpers } from "../linq/functions.js";
import type { Insertable, InsertableWithReturning } from "../linq/insertable.js";
import type { ParseQueryOptions } from "../parser/types.js";
import type { QueryOperation, InsertOperation } from "../query-tree/operations.js";
import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression as ASTExpression,
  Program,
  ObjectExpression as ASTObjectExpression,
} from "../parser/ast-types.js";
import { parseJavaScript } from "../parser/oxc-parser.js";
import { normalizeJoins } from "../parser/normalize-joins.js";
import { wrapWindowFilters } from "../parser/normalize-window-filters.js";
import type { ParseResult } from "../parser/parse-query.js";
import { parseQuery } from "../parser/parse-query.js";
import {
  restoreVisitorContext,
  snapshotVisitorContext,
  type VisitorContext,
  type VisitorContextSnapshot,
} from "../visitors/types.js";
import { visitValuesOperation } from "../visitors/insert/values.js";
import { visitReturningOperation } from "../visitors/insert/returning.js";

// -----------------------------------------------------------------------------
// Plan data
// -----------------------------------------------------------------------------

export interface InsertPlan<TRecord, TParams> {
  readonly kind: "insert";
  readonly operation: QueryOperation;
  readonly autoParams: Record<string, unknown>;
  readonly autoParamInfos?: Record<string, unknown>;
  readonly contextSnapshot: VisitorContextSnapshot;
  readonly parseOptions?: ParseQueryOptions;
  readonly __type?: {
    record: TRecord;
    params: TParams;
  };
}

type InsertPlanState<TRecord, TParams> = InsertPlan<TRecord, TParams>;

function createInitialState<TRecord, TParams>(
  parseResult: ParseResult,
  options?: ParseQueryOptions,
): InsertPlanState<TRecord, TParams> {
  const operationClone = cloneOperationTree(parseResult.operation);
  return {
    kind: "insert",
    operation: operationClone,
    autoParams: { ...parseResult.autoParams },
    autoParamInfos: parseResult.autoParamInfos ? { ...parseResult.autoParamInfos } : undefined,
    contextSnapshot: parseResult.contextSnapshot,
    parseOptions: options,
  };
}

function createState<TRecord, TParams>(
  base: InsertPlanState<unknown, TParams>,
  nextOperation: QueryOperation,
  visitorContext: VisitorContext,
): InsertPlanState<TRecord, TParams> {
  const nextSnapshot = snapshotVisitorContext(visitorContext);
  const autoParamEntries = Array.from(visitorContext.autoParams.entries());
  const autoParams = Object.fromEntries(autoParamEntries);
  const autoParamInfos = visitorContext.autoParamInfos
    ? Object.fromEntries(visitorContext.autoParamInfos.entries())
    : base.autoParamInfos;

  const normalizedOperation = wrapWindowFilters(normalizeJoins(cloneOperationTree(nextOperation)));

  return {
    kind: "insert",
    operation: normalizedOperation,
    autoParams,
    autoParamInfos,
    contextSnapshot: nextSnapshot,
    parseOptions: base.parseOptions,
  };
}

// -----------------------------------------------------------------------------
// Plan SQL result
// -----------------------------------------------------------------------------

export interface InsertPlanSql {
  operation: QueryOperation;
  params: Record<string, unknown>;
  autoParamInfos?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Plan handle stages
// -----------------------------------------------------------------------------

// Initial stage - only table is specified
export class InsertPlanHandleInitial<TRecord, TParams> {
  constructor(private readonly state: InsertPlanState<TRecord, TParams>) {}

  values(values: Partial<TRecord>): InsertPlanHandleWithValues<TRecord, TParams> {
    const nextState = appendValues(this.state, values as Record<string, unknown>);
    return new InsertPlanHandleWithValues(nextState);
  }

  finalize(_params: TParams): InsertPlanSql {
    // Initial stage without values - this would be invalid SQL
    throw new Error("INSERT statement requires values() to be called before generating SQL");
  }

  toPlan(): InsertPlan<TRecord, TParams> {
    return this.state;
  }
}

// After values() is called
export class InsertPlanHandleWithValues<TRecord, TParams> {
  constructor(private readonly state: InsertPlanState<TRecord, TParams>) {}

  returning<TResult>(
    selector: (item: TRecord) => TResult,
  ): InsertPlanHandleWithReturning<TResult, TParams> {
    const nextState = appendReturning(
      this.state,
      selector as unknown as (item: unknown) => unknown,
    );
    return new InsertPlanHandleWithReturning(nextState as InsertPlanState<TResult, TParams>);
  }

  finalize(params: TParams): InsertPlanSql {
    const merged = mergeParams(this.state.autoParams, params);
    return {
      operation: this.state.operation,
      params: merged,
      autoParamInfos: this.state.autoParamInfos,
    };
  }

  toPlan(): InsertPlan<TRecord, TParams> {
    return this.state;
  }

  execute(_params: TParams): Promise<void> {
    return Promise.reject(
      new Error("execute() is not implemented yet. Use executeInsertPlan helper once available."),
    );
  }
}

// After returning() is called
export class InsertPlanHandleWithReturning<TResult, TParams> {
  constructor(private readonly state: InsertPlanState<TResult, TParams>) {}

  finalize(params: TParams): InsertPlanSql {
    const merged = mergeParams(this.state.autoParams, params);
    return {
      operation: this.state.operation,
      params: merged,
      autoParamInfos: this.state.autoParamInfos,
    };
  }

  toPlan(): InsertPlan<TResult, TParams> {
    return this.state;
  }

  execute(_params: TParams): Promise<TResult> {
    return Promise.reject(
      new Error("execute() is not implemented yet. Use executeInsertPlan helper once available."),
    );
  }
}

// -----------------------------------------------------------------------------
// Public entry points
// -----------------------------------------------------------------------------

// Single builder overload
export function defineInsert<
  TSchema,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- {} is correct for extensible empty object
  TParams = {},
  TQuery = unknown,
>(
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams, helpers?: QueryHelpers) => TQuery,
  options?: ParseQueryOptions,
): TQuery extends InsertableWithReturning<unknown, infer TReturning>
  ? InsertPlanHandleWithReturning<TReturning, TParams>
  : TQuery extends Insertable<infer TTable>
    ? InsertPlanHandleInitial<TTable, TParams>
    : never;

// Overload for direct table name - DISABLED FOR NOW
// export function defineInsert<TSchema, TParams = {}, TTable extends keyof TSchema = keyof TSchema>(
//   schema: DatabaseSchema<TSchema>,
//   table: TTable,
//   options?: ParseQueryOptions,
// ): InsertPlanHandleInitial<TSchema[TTable], TParams>;

// Implementation
export function defineInsert(
  _schema: DatabaseSchema<unknown>,
  builder: (
    queryBuilder: QueryBuilder<unknown>,
    params: unknown,
    helpers?: QueryHelpers,
  ) => unknown,
  options?: ParseQueryOptions,
) {
  // Parse the builder function to get the operation
  const parseResult = parseQuery(builder, options);
  if (!parseResult || parseResult.operation.operationType !== "insert") {
    throw new Error("Failed to parse insert builder or not an insert operation");
  }

  const initialState = createInitialState<unknown, unknown>(parseResult, options);

  // Always return InsertPlanHandleInitial to keep the type simple
  // The builder can call .values() to add values if needed
  return new InsertPlanHandleInitial(initialState);
}

// -----------------------------------------------------------------------------
// Helper functions for individual operations
// -----------------------------------------------------------------------------

function appendValues<TRecord, TParams>(
  state: InsertPlanState<TRecord, TParams>,
  values: Record<string, unknown>,
): InsertPlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);

  // Create an object literal AST for the values
  const valuesExpression: ASTObjectExpression = {
    type: "ObjectExpression",
    properties: Object.entries(values).map(([key, value]) => ({
      type: "Property",
      key: { type: "Identifier", name: key },
      value: { type: "Literal", value },
      kind: "init",
      method: false,
      shorthand: false,
      computed: false,
    })),
  } as ASTObjectExpression;

  const call = createMethodCall("values", valuesExpression);
  const result = visitValuesOperation(call, state.operation as InsertOperation, visitorContext);

  if (!result) {
    throw new Error("Failed to append values to insert plan");
  }

  visitorContext.autoParams = mergeAutoParams(visitorContext.autoParams, result.autoParams);

  return createState(state, result.operation, visitorContext);
}

function appendReturning<TRecord, TParams>(
  state: InsertPlanState<TRecord, TParams>,
  selector: (item: unknown) => unknown,
): InsertPlanState<unknown, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const lambda = parseLambdaExpression(selector as (...args: unknown[]) => unknown, "returning");
  const call = createMethodCall("returning", lambda);
  const result = visitReturningOperation(call, state.operation as InsertOperation, visitorContext);

  if (!result) {
    throw new Error("Failed to append returning clause to insert plan");
  }

  return createState(
    state as unknown as InsertPlanState<unknown, TParams>,
    result.operation,
    visitorContext,
  );
}

// -----------------------------------------------------------------------------
// AST helpers
// -----------------------------------------------------------------------------

function parseLambdaExpression(
  lambda: (...args: unknown[]) => unknown,
  label: string,
): ArrowFunctionExpression {
  const source = lambda.toString();
  const program = parseJavaScript(source) as Program;
  const body = program.body?.[0];

  if (!body || body.type !== "ExpressionStatement") {
    throw new Error(`${label} expects an arrow function expression`);
  }

  const expression = body.expression as ASTExpression;
  if (expression.type !== "ArrowFunctionExpression") {
    throw new Error(`${label} expects an arrow function expression`);
  }

  return expression;
}

function createMethodCall(methodName: string, argument?: ASTExpression): CallExpression {
  return {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: {
        type: "Identifier",
        name: "__plan",
      },
      property: {
        type: "Identifier",
        name: methodName,
      },
      computed: false,
      optional: false,
    },
    arguments: argument ? [argument] : [],
    optional: false,
  } as CallExpression;
}

function mergeAutoParams(
  existing: Map<string, unknown>,
  additions: Record<string, unknown>,
): Map<string, unknown> {
  const result = new Map(existing);
  for (const [key, value] of Object.entries(additions)) {
    result.set(key, value);
  }
  return result;
}

function mergeParams<TParams>(
  autoParams: Record<string, unknown>,
  params: TParams,
): Record<string, unknown> {
  return {
    ...autoParams,
    ...(params as Record<string, unknown>),
  };
}

function cloneOperationTree(operation: QueryOperation): QueryOperation {
  // Deep clone that preserves Maps and other complex structures
  function deepClone(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    // Handle Map instances
    if (obj instanceof Map) {
      const clonedMap = new Map();
      for (const [key, value] of obj) {
        clonedMap.set(key, deepClone(value));
      }
      return clonedMap;
    }

    // Handle Array instances
    if (Array.isArray(obj)) {
      return obj.map((item) => deepClone(item));
    }

    // Handle regular objects
    const clonedObj: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = deepClone((obj as Record<string, unknown>)[key]);
      }
    }
    return clonedObj;
  }

  return deepClone(operation) as QueryOperation;
}
