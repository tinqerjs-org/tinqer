import type { DatabaseSchema } from "../linq/database-context.js";
import type { ParseQueryOptions } from "../parser/types.js";
import type { QueryOperation, DeleteOperation } from "../query-tree/operations.js";
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
import {
  restoreVisitorContext,
  snapshotVisitorContext,
  type VisitorContext,
  type VisitorContextSnapshot,
} from "../visitors/types.js";
import { visitWhereDeleteOperation } from "../visitors/delete/where-delete.js";
import { visitAllowFullDeleteOperation } from "../visitors/delete/allow-full-delete.js";

// -----------------------------------------------------------------------------
// Plan data
// -----------------------------------------------------------------------------

export interface DeletePlan<TRecord, TParams> {
  readonly kind: "delete";
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

type DeletePlanState<TRecord, TParams> = DeletePlan<TRecord, TParams>;

function createInitialState<TRecord, TParams>(
  parseResult: ParseResult,
  options?: ParseQueryOptions,
): DeletePlanState<TRecord, TParams> {
  const operationClone = cloneOperationTree(parseResult.operation);
  return {
    kind: "delete",
    operation: operationClone,
    autoParams: { ...parseResult.autoParams },
    autoParamInfos: parseResult.autoParamInfos ? { ...parseResult.autoParamInfos } : undefined,
    contextSnapshot: parseResult.contextSnapshot,
    parseOptions: options,
  };
}

function createState<TRecord, TParams>(
  base: DeletePlanState<unknown, TParams>,
  nextOperation: QueryOperation,
  visitorContext: VisitorContext,
): DeletePlanState<TRecord, TParams> {
  const nextSnapshot = snapshotVisitorContext(visitorContext);
  const autoParamEntries = Array.from(visitorContext.autoParams.entries());
  const autoParams = Object.fromEntries(autoParamEntries);
  const autoParamInfos = visitorContext.autoParamInfos
    ? Object.fromEntries(visitorContext.autoParamInfos.entries())
    : base.autoParamInfos;

  const normalizedOperation = wrapWindowFilters(normalizeJoins(cloneOperationTree(nextOperation)));

  return {
    kind: "delete",
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

export interface DeletePlanSql {
  operation: QueryOperation;
  params: Record<string, unknown>;
  autoParamInfos?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Plan handle stages
// -----------------------------------------------------------------------------

// Initial stage - only table is specified
export class DeletePlanHandleInitial<TRecord, TParams> {
  constructor(private readonly state: DeletePlanState<TRecord, TParams>) {}

  where<ExtraParams extends object = Record<string, never>>(
    predicate: (item: TRecord, params: TParams & ExtraParams) => boolean,
  ): DeletePlanHandleComplete<TRecord, TParams & ExtraParams> {
    const nextState = appendWhereDelete(
      this.state,
      predicate as unknown as (...args: unknown[]) => boolean,
    );
    return new DeletePlanHandleComplete(nextState as DeletePlanState<TRecord, TParams & ExtraParams>);
  }

  allowFullTableDelete(): DeletePlanHandleComplete<TRecord, TParams> {
    const nextState = appendAllowFullDelete(this.state);
    return new DeletePlanHandleComplete(nextState);
  }
}

// After where() or allowFullTableDelete() is called
export class DeletePlanHandleComplete<TRecord, TParams> {
  constructor(private readonly state: DeletePlanState<TRecord, TParams>) {}

  toSql(params: TParams): DeletePlanSql {
    const merged = mergeParams(this.state.autoParams, params);
    return {
      operation: this.state.operation,
      params: merged,
      autoParamInfos: this.state.autoParamInfos,
    };
  }

  toPlan(): DeletePlan<TRecord, TParams> {
    return this.state;
  }

  execute(_params: TParams): Promise<void> {
    return Promise.reject(
      new Error("execute() is not implemented yet. Use executeDeletePlan helper once available."),
    );
  }
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

export function defineDelete<TSchema, TParams, TTable extends keyof TSchema>(
  _schema: DatabaseSchema<TSchema>,
  table: TTable,
  options?: ParseQueryOptions,
): DeletePlanHandleInitial<TSchema[TTable], TParams> {
  // For delete, we start with just the table
  const initialOperation: DeleteOperation = {
    type: "queryOperation",
    operationType: "delete",
    table: table as string,
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

  const initialState = createInitialState<TSchema[TTable], TParams>(parseResult, options);
  return new DeletePlanHandleInitial(initialState);
}

// -----------------------------------------------------------------------------
// Helper functions for individual operations
// -----------------------------------------------------------------------------

function appendWhereDelete<TRecord, TParams>(
  state: DeletePlanState<TRecord, TParams>,
  predicate: (...args: unknown[]) => boolean,
): DeletePlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const lambda = parseLambdaExpression(predicate, "where");
  const call = createMethodCall("where", lambda);
  const result = visitWhereDeleteOperation(call, state.operation as DeleteOperation, visitorContext);

  if (!result) {
    throw new Error("Failed to append where clause to delete plan");
  }

  visitorContext.autoParams = mergeAutoParams(visitorContext.autoParams, result.autoParams);

  return createState(state, result.operation, visitorContext);
}

function appendAllowFullDelete<TRecord, TParams>(
  state: DeletePlanState<TRecord, TParams>,
): DeletePlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const call = createMethodCall("allowFullTableDelete");
  const result = visitAllowFullDeleteOperation(call, state.operation as DeleteOperation);

  if (!result) {
    throw new Error("Failed to append allowFullTableDelete to delete plan");
  }

  return createState(state, result.operation, visitorContext);
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