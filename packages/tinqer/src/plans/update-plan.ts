import type { DatabaseSchema } from "../linq/database-context.js";
import type { QueryBuilder } from "../linq/query-builder.js";
import type { QueryHelpers } from "../linq/functions.js";
import type {
  Updatable,
  UpdatableWithSet,
  UpdatableComplete,
  UpdatableWithReturning,
} from "../linq/updatable.js";
import type { ParseQueryOptions } from "../parser/types.js";
import type { QueryOperation, UpdateOperation } from "../query-tree/operations.js";
import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression as ASTExpression,
  Program,
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
import { visitWhereUpdateOperation } from "../visitors/update/where-update.js";
import { visitSetOperation } from "../visitors/update/set.js";
import { visitAllowFullUpdateOperation } from "../visitors/update/allow-full-update.js";
import { visitReturningUpdateOperation } from "../visitors/update/returning-update.js";

// -----------------------------------------------------------------------------
// Plan data
// -----------------------------------------------------------------------------

export interface UpdatePlan<TRecord, TParams> {
  readonly kind: "update";
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

type UpdatePlanState<TRecord, TParams> = UpdatePlan<TRecord, TParams>;

function createInitialState<TRecord, TParams>(
  parseResult: ParseResult,
  options?: ParseQueryOptions,
): UpdatePlanState<TRecord, TParams> {
  const operationClone = cloneOperationTree(parseResult.operation);
  return {
    kind: "update",
    operation: operationClone,
    autoParams: { ...parseResult.autoParams },
    autoParamInfos: parseResult.autoParamInfos ? { ...parseResult.autoParamInfos } : undefined,
    contextSnapshot: parseResult.contextSnapshot,
    parseOptions: options,
  };
}

function createState<TRecord, TParams>(
  base: UpdatePlanState<unknown, TParams>,
  nextOperation: QueryOperation,
  visitorContext: VisitorContext,
): UpdatePlanState<TRecord, TParams> {
  const nextSnapshot = snapshotVisitorContext(visitorContext);
  const autoParamEntries = Array.from(visitorContext.autoParams.entries());
  const autoParams = Object.fromEntries(autoParamEntries);
  const autoParamInfos = visitorContext.autoParamInfos
    ? Object.fromEntries(visitorContext.autoParamInfos.entries())
    : base.autoParamInfos;

  const normalizedOperation = wrapWindowFilters(normalizeJoins(cloneOperationTree(nextOperation)));

  return {
    kind: "update",
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

export interface UpdatePlanSql {
  operation: QueryOperation;
  params: Record<string, unknown>;
  autoParamInfos?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Plan handle stages
// -----------------------------------------------------------------------------

// Initial stage - only table is specified
export class UpdatePlanHandleInitial<TRecord, TParams> {
  constructor(private readonly state: UpdatePlanState<TRecord, TParams>) {}

  set<ExtraParams extends object = Record<string, never>>(
    values: Partial<TRecord> | ((params: TParams & ExtraParams) => Partial<TRecord>),
  ): UpdatePlanHandleWithSet<TRecord, TParams & ExtraParams> {
    const nextState = appendSet(
      this.state,
      values as Partial<TRecord> | ((params: unknown) => Partial<TRecord>),
    );
    return new UpdatePlanHandleWithSet(
      nextState as UpdatePlanState<TRecord, TParams & ExtraParams>,
    );
  }

  toSql(_params: TParams): UpdatePlanSql {
    // Initial stage without SET clause - this would be invalid SQL
    throw new Error("UPDATE statement requires set() to be called before generating SQL");
  }

  toPlan(): UpdatePlan<TRecord, TParams> {
    return this.state;
  }
}

// After set() is called
export class UpdatePlanHandleWithSet<TRecord, TParams> {
  constructor(private readonly state: UpdatePlanState<TRecord, TParams>) {}

  where<ExtraParams extends object = Record<string, never>>(
    predicate: (item: TRecord, params: TParams & ExtraParams) => boolean,
  ): UpdatePlanHandleComplete<TRecord, TParams & ExtraParams> {
    const nextState = appendWhereUpdate(
      this.state,
      predicate as unknown as (...args: unknown[]) => boolean,
    );
    return new UpdatePlanHandleComplete(
      nextState as UpdatePlanState<TRecord, TParams & ExtraParams>,
    );
  }

  allowFullTableUpdate(): UpdatePlanHandleComplete<TRecord, TParams> {
    const nextState = appendAllowFullUpdate(this.state);
    return new UpdatePlanHandleComplete(nextState);
  }

  returning<TResult>(
    selector: (item: TRecord) => TResult,
  ): UpdatePlanHandleWithReturning<TResult, TParams> {
    const nextState = appendReturning(
      this.state,
      selector as unknown as (item: TRecord) => unknown,
    );
    return new UpdatePlanHandleWithReturning(nextState as UpdatePlanState<TResult, TParams>);
  }

  toSql(params: TParams): UpdatePlanSql {
    const merged = mergeParams(this.state.autoParams, params);
    return {
      operation: this.state.operation,
      params: merged,
      autoParamInfos: this.state.autoParamInfos,
    };
  }

  toPlan(): UpdatePlan<TRecord, TParams> {
    return this.state;
  }

  execute(_params: TParams): Promise<void> {
    return Promise.reject(
      new Error("execute() is not implemented yet. Use executeUpdatePlan helper once available."),
    );
  }
}

// After where() or allowFullTableUpdate() is called
export class UpdatePlanHandleComplete<TRecord, TParams> {
  constructor(private readonly state: UpdatePlanState<TRecord, TParams>) {}

  returning<TResult>(
    selector: (item: TRecord) => TResult,
  ): UpdatePlanHandleWithReturning<TResult, TParams> {
    const nextState = appendReturning(
      this.state,
      selector as unknown as (item: TRecord) => unknown,
    );
    return new UpdatePlanHandleWithReturning(nextState as UpdatePlanState<TResult, TParams>);
  }

  toSql(params: TParams): UpdatePlanSql {
    const merged = mergeParams(this.state.autoParams, params);
    return {
      operation: this.state.operation,
      params: merged,
      autoParamInfos: this.state.autoParamInfos,
    };
  }

  toPlan(): UpdatePlan<TRecord, TParams> {
    return this.state;
  }

  execute(_params: TParams): Promise<void> {
    return Promise.reject(
      new Error("execute() is not implemented yet. Use executeUpdatePlan helper once available."),
    );
  }
}

// After returning() is called
export class UpdatePlanHandleWithReturning<TResult, TParams> {
  constructor(private readonly state: UpdatePlanState<TResult, TParams>) {}

  toSql(params: TParams): UpdatePlanSql {
    const merged = mergeParams(this.state.autoParams, params);
    return {
      operation: this.state.operation,
      params: merged,
      autoParamInfos: this.state.autoParamInfos,
    };
  }

  toPlan(): UpdatePlan<TResult, TParams> {
    return this.state;
  }

  execute(_params: TParams): Promise<TResult[]> {
    return Promise.reject(
      new Error("execute() is not implemented yet. Use executeUpdatePlan helper once available."),
    );
  }
}

// -----------------------------------------------------------------------------
// Public entry points
// -----------------------------------------------------------------------------

// Type for builder function results
type UpdateResult<TTable, TReturning = unknown> =
  | Updatable<TTable>
  | UpdatableWithSet<TTable>
  | UpdatableComplete<TTable>
  | UpdatableWithReturning<TTable, TReturning>;

// Type for builder functions
type UpdateBuilder<TSchema, TParams, TTable, TReturning = unknown> =
  | ((
      queryBuilder: QueryBuilder<TSchema>,
      params: TParams,
      helpers: QueryHelpers,
    ) => UpdateResult<TTable, TReturning>)
  | ((queryBuilder: QueryBuilder<TSchema>, params: TParams) => UpdateResult<TTable, TReturning>)
  | ((queryBuilder: QueryBuilder<TSchema>) => UpdateResult<TTable, TReturning>);

// Combined overload for all builder functions
export function defineUpdate<TSchema, TParams, TTable, TReturning = unknown>(
  schema: DatabaseSchema<TSchema>,
  builder: UpdateBuilder<TSchema, TParams, TTable, TReturning>,
  options?: ParseQueryOptions,
):
  | UpdatePlanHandleInitial<TTable, TParams>
  | UpdatePlanHandleWithSet<TTable, TParams>
  | UpdatePlanHandleComplete<TTable, TParams>;

// Original overload for direct table name (kept for backward compatibility)
export function defineUpdate<TSchema, TParams, TTable extends keyof TSchema>(
  schema: DatabaseSchema<TSchema>,
  table: TTable,
  options?: ParseQueryOptions,
): UpdatePlanHandleInitial<TSchema[TTable], TParams>;

// Implementation
export function defineUpdate<TSchema, TParams = Record<string, never>, TTable = unknown>(
  _schema: DatabaseSchema<TSchema>,
  builderOrTable: UpdateBuilder<TSchema, TParams, TTable> | keyof TSchema,
  options?: ParseQueryOptions,
):
  | UpdatePlanHandleInitial<TTable, TParams>
  | UpdatePlanHandleWithSet<TTable, TParams>
  | UpdatePlanHandleComplete<TTable, TParams> {
  // Check if it's a builder function or a table name
  if (typeof builderOrTable === "function") {
    // Parse the builder function to get the operation
    const parseResult = parseQuery(builderOrTable, options);
    if (!parseResult || parseResult.operation.operationType !== "update") {
      throw new Error("Failed to parse update builder or not an update operation");
    }

    const initialState = createInitialState<TTable, TParams>(parseResult, options);

    // Check the state of the parsed operation to return the appropriate handle
    const updateOp = parseResult.operation as UpdateOperation;

    // Check if WHERE clause is present
    if (updateOp.predicate || updateOp.allowFullTableUpdate) {
      return new UpdatePlanHandleComplete(initialState);
    }

    // Check if SET clause is present
    if (
      updateOp.assignments &&
      (updateOp.assignments as any).properties &&
      Object.keys((updateOp.assignments as any).properties).length > 0
    ) {
      return new UpdatePlanHandleWithSet(initialState);
    }

    return new UpdatePlanHandleInitial(initialState);
  } else {
    // Original table name path
    const table = builderOrTable as keyof TSchema;
    const initialOperation: UpdateOperation = {
      type: "queryOperation",
      operationType: "update",
      table: table as string,
      assignments: {
        type: "object",
        properties: {},
      },
    };

    const parseResult: ParseResult = {
      operation: initialOperation,
      autoParams: {},
      contextSnapshot: snapshotVisitorContext({
        tableParams: new Set<string>(),
        queryParams: new Set<string>(),
        autoParams: new Map<string, unknown>(),
        autoParamCounter: 0,
      }),
    };

    const initialState = createInitialState<TTable, TParams>(parseResult, options);
    return new UpdatePlanHandleInitial(initialState);
  }
}

// -----------------------------------------------------------------------------
// Helper functions for individual operations
// -----------------------------------------------------------------------------

function appendSet<TRecord, TParams>(
  state: UpdatePlanState<TRecord, TParams>,
  values: Partial<TRecord> | ((params: unknown) => Partial<TRecord>),
): UpdatePlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);

  // Handle both direct object and lambda function cases
  let setExpression: ASTExpression;

  if (typeof values === "function") {
    const lambda = parseLambdaExpression(values as (...args: unknown[]) => unknown, "set");
    setExpression = lambda;
  } else {
    // Create an object literal AST for direct values
    setExpression = {
      type: "ObjectExpression",
      properties: Object.entries(values as Record<string, unknown>).map(([key, value]) => ({
        type: "Property",
        key: { type: "Identifier", name: key },
        value: { type: "Literal", value },
        kind: "init",
        method: false,
        shorthand: false,
        computed: false,
      })),
    } as ASTExpression;
  }

  const call = createMethodCall("set", setExpression);
  const result = visitSetOperation(call, state.operation as UpdateOperation, visitorContext);

  if (!result) {
    throw new Error("Failed to append set clause to update plan");
  }

  visitorContext.autoParams = mergeAutoParams(visitorContext.autoParams, result.autoParams);

  return createState(state, result.operation, visitorContext);
}

function appendWhereUpdate<TRecord, TParams>(
  state: UpdatePlanState<TRecord, TParams>,
  predicate: (...args: unknown[]) => boolean,
): UpdatePlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const lambda = parseLambdaExpression(predicate, "where");
  const call = createMethodCall("where", lambda);
  const result = visitWhereUpdateOperation(
    call,
    state.operation as UpdateOperation,
    visitorContext,
  );

  if (!result) {
    throw new Error("Failed to append where clause to update plan");
  }

  visitorContext.autoParams = mergeAutoParams(visitorContext.autoParams, result.autoParams);

  return createState(state, result.operation, visitorContext);
}

function appendAllowFullUpdate<TRecord, TParams>(
  state: UpdatePlanState<TRecord, TParams>,
): UpdatePlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const call = createMethodCall("allowFullTableUpdate");
  const result = visitAllowFullUpdateOperation(call, state.operation as UpdateOperation);

  if (!result) {
    throw new Error("Failed to append allowFullTableUpdate to update plan");
  }

  return createState(state, result.operation, visitorContext);
}

function appendReturning<TRecord, TParams>(
  state: UpdatePlanState<TRecord, TParams>,
  selector: (item: TRecord) => unknown,
): UpdatePlanState<unknown, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const lambda = parseLambdaExpression(selector as (...args: unknown[]) => unknown, "returning");
  const call = createMethodCall("returning", lambda);
  const result = visitReturningUpdateOperation(
    call,
    state.operation as UpdateOperation,
    visitorContext,
  );

  if (!result) {
    throw new Error("Failed to append returning clause to update plan");
  }

  return createState(
    state as unknown as UpdatePlanState<unknown, TParams>,
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
  return JSON.parse(JSON.stringify(operation)) as QueryOperation;
}
