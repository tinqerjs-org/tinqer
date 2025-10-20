import { Queryable } from "../linq/queryable.js";
import { TerminalQuery } from "../linq/terminal-query.js";
import type { QueryHelpers } from "../linq/functions.js";
import type { QueryBuilder } from "../linq/query-builder.js";
import type { DatabaseSchema } from "../linq/database-context.js";
import type { Grouping } from "../linq/grouping.js";
import type { ParseQueryOptions } from "../parser/types.js";
import type { QueryOperation } from "../query-tree/operations.js";
import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression as ASTExpression,
  NumericLiteral,
  Program,
} from "../parser/ast-types.js";
import { parseJavaScript } from "../parser/oxc-parser.js";
import { parseQuery } from "../parser/parse-query.js";
import { normalizeJoins } from "../parser/normalize-joins.js";
import { wrapWindowFilters } from "../parser/normalize-window-filters.js";
import type { ParseResult } from "../parser/parse-query.js";
import {
  restoreVisitorContext,
  snapshotVisitorContext,
  type VisitorContext,
  type VisitorContextSnapshot,
} from "../visitors/types.js";
import { visitWhereOperation } from "../visitors/where/index.js";
import { visitSelectOperation } from "../visitors/select/index.js";
import { visitOrderByOperation, visitThenByOperation } from "../visitors/orderby/index.js";
import { visitTakeOperation } from "../visitors/take-skip/take.js";
import { visitSkipOperation } from "../visitors/take-skip/skip.js";
import { visitDistinctOperation } from "../visitors/distinct/index.js";
import { visitReverseOperation } from "../visitors/reverse/index.js";
import { visitGroupByOperation } from "../visitors/groupby/index.js";
import { visitJoinOperation } from "../visitors/join/join.js";

// -----------------------------------------------------------------------------
// Plan data
// -----------------------------------------------------------------------------

export interface SelectPlan<TRecord, TParams> {
  readonly kind: "select";
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

type SelectPlanState<TRecord, TParams> = SelectPlan<TRecord, TParams>;

function createInitialState<TRecord, TParams>(
  parseResult: ParseResult,
  options?: ParseQueryOptions,
): SelectPlanState<TRecord, TParams> {
  const operationClone = cloneOperationTree(parseResult.operation);
  return {
    kind: "select",
    operation: operationClone,
    autoParams: { ...parseResult.autoParams },
    autoParamInfos: parseResult.autoParamInfos ? { ...parseResult.autoParamInfos } : undefined,
    contextSnapshot: parseResult.contextSnapshot,
    parseOptions: options,
  };
}

function createState<TRecord, TParams>(
  base: SelectPlanState<unknown, TParams>,
  nextOperation: QueryOperation,
  visitorContext: VisitorContext,
): SelectPlanState<TRecord, TParams> {
  const nextSnapshot = snapshotVisitorContext(visitorContext);
  const autoParamEntries = Array.from(visitorContext.autoParams.entries());
  const autoParams = Object.fromEntries(autoParamEntries);
  const autoParamInfos = visitorContext.autoParamInfos
    ? Object.fromEntries(visitorContext.autoParamInfos.entries())
    : base.autoParamInfos;

  const normalizedOperation = wrapWindowFilters(normalizeJoins(cloneOperationTree(nextOperation)));

  return {
    kind: "select",
    operation: normalizedOperation,
    autoParams,
    autoParamInfos,
    contextSnapshot: nextSnapshot,
    parseOptions: base.parseOptions,
  };
}

// -----------------------------------------------------------------------------
// Plan handle
// -----------------------------------------------------------------------------

export interface SelectPlanSql {
  operation: QueryOperation;
  params: Record<string, unknown>;
  autoParamInfos?: Record<string, unknown>;
}

export class SelectPlanHandle<TRecord, TParams> extends Queryable<TRecord> {
  constructor(private readonly state: SelectPlanState<TRecord, TParams>) {
    super();
  }

  toSql(params: TParams): SelectPlanSql {
    const merged = mergeParams(this.state.autoParams, params);
    return {
      operation: this.state.operation,
      params: merged,
      autoParamInfos: this.state.autoParamInfos,
    };
  }

  /** TODO: remove once execute helper exists. */
  execute(_params: TParams): Promise<never> {
    return Promise.reject(
      new Error("execute() is not implemented yet. Use executeSelectPlan helper once available."),
    );
  }

  toPlan(): SelectPlan<TRecord, TParams> {
    return this.state;
  }

  // Overload to maintain Queryable compatibility
  where(predicate: (item: TRecord) => boolean): SelectPlanHandle<TRecord, TParams>;
  where<ExtraParams extends object = Record<string, never>>(
    predicate: (item: TRecord, params: TParams & ExtraParams) => boolean,
  ): SelectPlanHandle<TRecord, TParams & ExtraParams>;
  where<ExtraParams extends object = Record<string, never>>(
    predicate: ((item: TRecord) => boolean) | ((item: TRecord, params: TParams & ExtraParams) => boolean),
  ): SelectPlanHandle<TRecord, TParams | (TParams & ExtraParams)> {
    const nextState = appendWhere(
      this.state,
      predicate as unknown as (...args: unknown[]) => boolean,
    );
    return new SelectPlanHandle(nextState as SelectPlanState<TRecord, TParams | (TParams & ExtraParams)>);
  }

  select<TResult>(selector: (item: TRecord) => TResult): SelectPlanHandle<TResult, TParams> {
    const nextState = appendSelect(this.state, selector as unknown as (item: TRecord) => TResult);
    return new SelectPlanHandle(nextState as unknown as SelectPlanState<TResult, TParams>);
  }

  orderBy<TKey>(selector: (item: TRecord) => TKey): SelectPlanHandle<TRecord, TParams> {
    const nextState = appendOrderBy(
      this.state,
      selector as unknown as (item: TRecord) => unknown,
      "orderBy",
    );
    return new SelectPlanHandle(nextState);
  }

  orderByDescending<TKey>(selector: (item: TRecord) => TKey): SelectPlanHandle<TRecord, TParams> {
    const nextState = appendOrderBy(
      this.state,
      selector as unknown as (item: TRecord) => unknown,
      "orderByDescending",
    );
    return new SelectPlanHandle(nextState);
  }

  thenBy<TKey>(selector: (item: TRecord) => TKey): SelectPlanHandle<TRecord, TParams> {
    const nextState = appendThenBy(
      this.state,
      selector as unknown as (item: TRecord) => unknown,
      "thenBy",
    );
    return new SelectPlanHandle(nextState);
  }

  thenByDescending<TKey>(selector: (item: TRecord) => TKey): SelectPlanHandle<TRecord, TParams> {
    const nextState = appendThenBy(
      this.state,
      selector as unknown as (item: TRecord) => unknown,
      "thenByDescending",
    );
    return new SelectPlanHandle(nextState);
  }

  take(count: number): SelectPlanHandle<TRecord, TParams> {
    const nextState = appendTake(this.state, count);
    return new SelectPlanHandle(nextState);
  }

  skip(count: number): SelectPlanHandle<TRecord, TParams> {
    const nextState = appendSkip(this.state, count);
    return new SelectPlanHandle(nextState);
  }

  distinct(): SelectPlanHandle<TRecord, TParams> {
    const nextState = appendDistinct(this.state);
    return new SelectPlanHandle(nextState);
  }

  reverse(): SelectPlanHandle<TRecord, TParams> {
    const nextState = appendReverse(this.state);
    return new SelectPlanHandle(nextState);
  }

  // Note: Join operations are complex and require further work to properly handle inner queries
  // For now, these are placeholders that throw informative errors

  join<TInner, TKey, TResult>(
    inner: Queryable<TInner>,
    outerKeySelector: (item: TRecord) => TKey,
    innerKeySelector: (item: TInner) => TKey,
    resultSelector: (outer: TRecord, inner: TInner) => TResult,
  ): SelectPlanHandle<TResult, TParams> {
    const nextState = appendJoin(
      this.state,
      inner,
      outerKeySelector as unknown as (item: unknown) => unknown,
      innerKeySelector as unknown as (item: unknown) => unknown,
      resultSelector as unknown as (outer: unknown, inner: unknown) => unknown,
    );
    return new SelectPlanHandle(nextState as SelectPlanState<TResult, TParams>);
  }

  groupJoin<TInner, TKey, TResult>(
    _inner: Queryable<TInner>,
    _outerKeySelector: (item: TRecord) => TKey,
    _innerKeySelector: (item: TInner) => TKey,
    _resultSelector: (outer: TRecord, innerGroup: Grouping<TKey, TInner>) => TResult,
  ): SelectPlanHandle<TResult, TParams> {
    // TODO: Implement groupJoin support - requires handling inner query as plan or lambda
    throw new Error("groupJoin() is not yet implemented for plan handles. Coming soon.");
  }

  selectMany<TCollection>(
    _collectionSelector: (item: TRecord) => Queryable<TCollection> | Iterable<TCollection>,
  ): SelectPlanHandle<TCollection, TParams>;

  selectMany<TCollection, TResult>(
    _collectionSelector: (item: TRecord) => Queryable<TCollection> | Iterable<TCollection>,
    _resultSelector: (item: TRecord, collectionItem: TCollection) => TResult,
  ): SelectPlanHandle<TResult, TParams>;

  selectMany<TCollection, TResult = TCollection>(
    _collectionSelector: (item: TRecord) => Queryable<TCollection> | Iterable<TCollection>,
    _resultSelector?: (item: TRecord, collectionItem: TCollection) => TResult,
  ): SelectPlanHandle<TResult, TParams> {
    // TODO: Implement selectMany support - requires handling collection selector
    throw new Error("selectMany() is not yet implemented for plan handles. Coming soon.");
  }

  groupBy<TKey>(keySelector: (item: TRecord) => TKey): SelectPlanHandle<Grouping<TKey, TRecord>, TParams> {
    const nextState = appendGroupBy(
      this.state,
      keySelector as unknown as (item: unknown) => unknown,
    );
    return new SelectPlanHandle(nextState as unknown as SelectPlanState<Grouping<TKey, TRecord>, TParams>);
  }

  // Terminal operations - these return terminal handles that cannot be chained further

  count(predicate?: (item: TRecord) => boolean): SelectTerminalHandle<number, TParams> {
    // TODO: Wire up visitCountOperation properly
    // For now, create a simplified count operation
    const nextState = {
      ...this.state,
      operation: {
        type: "queryOperation" as const,
        operationType: "count" as const,
        source: this.state.operation,
        predicate: predicate ? {} : undefined, // TODO: Parse predicate properly
      },
    };
    return new SelectTerminalHandle(nextState as SelectPlanState<number, TParams>);
  }

  first(predicate?: (item: TRecord) => boolean): SelectTerminalHandle<TRecord, TParams> {
    // TODO: Wire up visitFirstOperation properly
    const nextState = {
      ...this.state,
      operation: {
        type: "queryOperation" as const,
        operationType: "first" as const,
        source: this.state.operation,
        predicate: predicate ? {} : undefined, // TODO: Parse predicate properly
      },
    };
    return new SelectTerminalHandle(nextState as SelectPlanState<TRecord, TParams>);
  }

  last(predicate?: (item: TRecord) => boolean): SelectTerminalHandle<TRecord, TParams> {
    // TODO: Wire up visitLastOperation properly
    const nextState = {
      ...this.state,
      operation: {
        type: "queryOperation" as const,
        operationType: "last" as const,
        source: this.state.operation,
        predicate: predicate ? {} : undefined, // TODO: Parse predicate properly
      },
    };
    return new SelectTerminalHandle(nextState as SelectPlanState<TRecord, TParams>);
  }

  single(predicate?: (item: TRecord) => boolean): SelectTerminalHandle<TRecord, TParams> {
    // TODO: Wire up visitSingleOperation properly
    const nextState = {
      ...this.state,
      operation: {
        type: "queryOperation" as const,
        operationType: "single" as const,
        source: this.state.operation,
        predicate: predicate ? {} : undefined, // TODO: Parse predicate properly
      },
    };
    return new SelectTerminalHandle(nextState as SelectPlanState<TRecord, TParams>);
  }

  sum(_selector?: (item: TRecord) => number): SelectTerminalHandle<number, TParams> {
    // TODO: Implement sum terminal operation
    throw new Error("sum() is not yet implemented for plan handles. Coming soon.");
  }

  avg(_selector?: (item: TRecord) => number): SelectTerminalHandle<number, TParams> {
    // TODO: Implement avg terminal operation
    throw new Error("avg() is not yet implemented for plan handles. Coming soon.");
  }

  min(): SelectTerminalHandle<TRecord, TParams>;
  min<TResult>(_selector: (item: TRecord) => TResult): SelectTerminalHandle<TResult, TParams>;
  min<TResult = TRecord>(_selector?: (item: TRecord) => TResult): SelectTerminalHandle<TRecord | TResult, TParams> {
    // TODO: Implement min terminal operation
    throw new Error("min() is not yet implemented for plan handles. Coming soon.");
  }

  max(): SelectTerminalHandle<TRecord, TParams>;
  max<TResult>(_selector: (item: TRecord) => TResult): SelectTerminalHandle<TResult, TParams>;
  max<TResult = TRecord>(_selector?: (item: TRecord) => TResult): SelectTerminalHandle<TRecord | TResult, TParams> {
    // TODO: Implement max terminal operation
    throw new Error("max() is not yet implemented for plan handles. Coming soon.");
  }

  any(_predicate?: (item: TRecord) => boolean): SelectTerminalHandle<boolean, TParams> {
    // TODO: Implement any terminal operation
    throw new Error("any() is not yet implemented for plan handles. Coming soon.");
  }

  all(_predicate: (item: TRecord) => boolean): SelectTerminalHandle<boolean, TParams> {
    // TODO: Implement all terminal operation
    throw new Error("all() is not yet implemented for plan handles. Coming soon.");
  }
}

// -----------------------------------------------------------------------------
// Terminal Handle
// -----------------------------------------------------------------------------

export class SelectTerminalHandle<TResult, TParams> extends TerminalQuery<TResult> {
  constructor(private readonly state: SelectPlanState<TResult, TParams>) {
    super();
  }

  toSql(params: TParams): SelectPlanSql {
    const merged = mergeParams(this.state.autoParams, params);
    return {
      operation: this.state.operation,
      params: merged,
      autoParamInfos: this.state.autoParamInfos,
    };
  }

  toPlan(): SelectPlan<TResult, TParams> {
    return this.state;
  }

  execute(_params: TParams): Promise<TResult> {
    return Promise.reject(
      new Error("execute() is not implemented yet. Use executeSelectPlan helper once available."),
    );
  }

  // Terminal handles block all fluent methods - no further chaining allowed
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

import type { OrderedQueryable } from "../linq/queryable.js";

type SelectResult = Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>;

type SelectBuilder<TSchema, TParams, TQuery extends SelectResult> =
  | ((queryBuilder: QueryBuilder<TSchema>, params: TParams, helpers: QueryHelpers) => TQuery)
  | ((queryBuilder: QueryBuilder<TSchema>, params: TParams) => TQuery)
  | ((queryBuilder: QueryBuilder<TSchema>) => TQuery);

export function defineSelect<TSchema, TParams, TQuery extends SelectResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams, helpers: QueryHelpers) => TQuery,
  options?: ParseQueryOptions,
): TQuery extends TerminalQuery<infer T>
  ? SelectTerminalHandle<T, TParams>
  : SelectPlanHandle<
      TQuery extends Queryable<infer T>
        ? T
        : TQuery extends OrderedQueryable<infer T>
          ? T
          : never,
      TParams
    >;

export function defineSelect<TSchema, TParams, TQuery extends SelectResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams) => TQuery,
  options?: ParseQueryOptions,
): TQuery extends TerminalQuery<infer T>
  ? SelectTerminalHandle<T, TParams>
  : SelectPlanHandle<
      TQuery extends Queryable<infer T>
        ? T
        : TQuery extends OrderedQueryable<infer T>
          ? T
          : never,
      TParams
    >;

export function defineSelect<TSchema, TQuery extends SelectResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => TQuery,
  options?: ParseQueryOptions,
): TQuery extends TerminalQuery<infer T>
  ? SelectTerminalHandle<T, Record<string, never>>
  : SelectPlanHandle<
      TQuery extends Queryable<infer T>
        ? T
        : TQuery extends OrderedQueryable<infer T>
          ? T
          : never,
      Record<string, never>
    >;

export function defineSelect<
  TSchema,
  TParams = Record<string, never>,
  TQuery extends SelectResult = SelectResult,
>(
  _schema: DatabaseSchema<TSchema>,
  builder: SelectBuilder<TSchema, TParams, TQuery>,
  options?: ParseQueryOptions,
): SelectPlanHandle<unknown, TParams> | SelectTerminalHandle<unknown, TParams> {
  const parseResult = parseQuery(builder, options);
  if (!parseResult) {
    throw new Error("Failed to parse select plan");
  }

  const initialState = createInitialState<unknown, TParams>(parseResult, options);

  // Check if this is a terminal operation
  const isTerminal = [
    "count",
    "longCount",
    "first",
    "firstOrDefault",
    "single",
    "singleOrDefault",
    "last",
    "lastOrDefault",
    "min",
    "max",
    "sum",
    "average",
    "any",
    "all",
  ].includes(parseResult.operation.operationType);

  if (isTerminal) {
    return new SelectTerminalHandle(initialState);
  }

  return new SelectPlanHandle(initialState);
}

// Keep compatibility with legacy helpers used by adapters.
export function defineSelectPlan<TSchema, TParams, TQuery extends SelectResult>(
  schema: DatabaseSchema<TSchema>,
  builder: SelectBuilder<TSchema, TParams, TQuery>,
  options?: ParseQueryOptions,
): SelectPlan<unknown, TParams> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineSelect<TSchema, TParams, TQuery>(schema, builder as any, options).toPlan();
}

// -----------------------------------------------------------------------------
// Helper functions for individual operations
// -----------------------------------------------------------------------------

function appendWhere<TRecord, TParams>(
  state: SelectPlanState<TRecord, TParams>,
  predicate: (...args: unknown[]) => boolean,
): SelectPlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const lambda = parseLambdaExpression(predicate as (...args: unknown[]) => unknown, "where");
  const call = createMethodCall("where", lambda);
  const result = visitWhereOperation(call, state.operation, visitorContext);

  if (!result) {
    throw new Error("Failed to append where clause to select plan");
  }

  visitorContext.autoParams = mergeAutoParams(visitorContext.autoParams, result.autoParams);

  return createState(state, result.operation, visitorContext);
}

function appendSelect<TRecord, TParams, TResult>(
  state: SelectPlanState<TRecord, TParams>,
  selector: (item: TRecord) => TResult,
): SelectPlanState<TResult, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const lambda = parseLambdaExpression(selector as (...args: unknown[]) => unknown, "select");
  const call = createMethodCall("select", lambda);
  const result = visitSelectOperation(call, state.operation, visitorContext);

  if (!result) {
    throw new Error("Failed to append select clause to plan");
  }

  return createState(
    state as unknown as SelectPlanState<TResult, TParams>,
    result.operation,
    visitorContext,
  );
}

function appendOrderBy<TRecord, TParams>(
  state: SelectPlanState<TRecord, TParams>,
  selector: (item: TRecord) => unknown,
  method: "orderBy" | "orderByDescending",
): SelectPlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const lambda = parseLambdaExpression(selector as (...args: unknown[]) => unknown, method);
  const call = createMethodCall(method, lambda);
  const result = visitOrderByOperation(call, state.operation, method, visitorContext);

  if (!result) {
    throw new Error(`Failed to append ${method} clause to plan`);
  }

  return createState(state, result.operation, visitorContext);
}

function appendThenBy<TRecord, TParams>(
  state: SelectPlanState<TRecord, TParams>,
  selector: (item: TRecord) => unknown,
  method: "thenBy" | "thenByDescending",
): SelectPlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const lambda = parseLambdaExpression(selector as (...args: unknown[]) => unknown, method);
  const call = createMethodCall(method, lambda);
  const result = visitThenByOperation(call, state.operation, method, visitorContext);

  if (!result) {
    throw new Error(`Failed to append ${method} clause to plan`);
  }

  return createState(state, result.operation, visitorContext);
}

function appendTake<TRecord, TParams>(
  state: SelectPlanState<TRecord, TParams>,
  count: number,
): SelectPlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const literal = createNumericLiteral(count);
  const call = createMethodCall("take", literal);
  const result = visitTakeOperation(call, state.operation, "take", visitorContext);

  if (!result) {
    throw new Error("Failed to append take clause to plan");
  }

  return createState(state, result.operation, visitorContext);
}

function appendSkip<TRecord, TParams>(
  state: SelectPlanState<TRecord, TParams>,
  count: number,
): SelectPlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const literal = createNumericLiteral(count);
  const call = createMethodCall("skip", literal);
  const result = visitSkipOperation(call, state.operation, "skip", visitorContext);

  if (!result) {
    throw new Error("Failed to append skip clause to plan");
  }

  return createState(state, result.operation, visitorContext);
}

function appendDistinct<TRecord, TParams>(
  state: SelectPlanState<TRecord, TParams>,
): SelectPlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const call = createMethodCall("distinct");
  const result = visitDistinctOperation(call, state.operation, "distinct", visitorContext);

  if (!result) {
    throw new Error("Failed to append distinct clause to plan");
  }

  return createState(state, result.operation, visitorContext);
}

function appendReverse<TRecord, TParams>(
  state: SelectPlanState<TRecord, TParams>,
): SelectPlanState<TRecord, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const call = createMethodCall("reverse");
  const result = visitReverseOperation(call, state.operation, "reverse", visitorContext);

  if (!result) {
    throw new Error("Failed to append reverse clause to plan");
  }

  return createState(state, result.operation, visitorContext);
}

function appendGroupBy<TRecord, TParams>(
  state: SelectPlanState<TRecord, TParams>,
  keySelector: (item: unknown) => unknown,
): SelectPlanState<unknown, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);
  const lambda = parseLambdaExpression(keySelector, "groupBy");
  const call = createMethodCall("groupBy", lambda);
  const result = visitGroupByOperation(call, state.operation, "groupBy", visitorContext);

  if (!result) {
    throw new Error("Failed to append groupBy to plan");
  }

  visitorContext.autoParams = mergeAutoParams(visitorContext.autoParams, result.autoParams);

  return createState(
    state as unknown as SelectPlanState<unknown, TParams>,
    result.operation,
    visitorContext,
  );
}

function appendJoin<TRecord, TParams>(
  state: SelectPlanState<TRecord, TParams>,
  _inner: Queryable<unknown>,
  outerKeySelector: (item: unknown) => unknown,
  innerKeySelector: (item: unknown) => unknown,
  resultSelector: (outer: unknown, inner: unknown) => unknown,
): SelectPlanState<unknown, TParams> {
  const visitorContext = restoreVisitorContext(state.contextSnapshot);

  // The join visitor expects a 2-arg form (inner, predicate) or 4-arg form
  // For now, let's implement a simplified version that creates the proper AST
  // TODO: This needs refinement to handle the actual join visitor requirements

  // Parse the lambdas to get AST representations
  const outerKeyLambda = parseLambdaExpression(outerKeySelector, "outerKeySelector");
  const innerKeyLambda = parseLambdaExpression(innerKeySelector, "innerKeySelector");
  const resultLambda = parseLambdaExpression(resultSelector, "resultSelector");

  // Create a placeholder inner expression (in real implementation, we'd parse the Queryable)
  // TODO: Handle inner Queryable properly - may need to extract its operation tree
  const innerExpr = {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: { type: "Identifier", name: "q" },
      property: { type: "Identifier", name: "from" },
      computed: false,
      optional: false,
    },
    arguments: [{ type: "Literal", value: "innerTable" }], // Placeholder
    optional: false,
  } as CallExpression;

  // Create the join call with 4-argument form
  const call = {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: { type: "Identifier", name: "__plan" },
      property: { type: "Identifier", name: "join" },
      computed: false,
      optional: false,
    },
    arguments: [innerExpr, outerKeyLambda, innerKeyLambda, resultLambda],
    optional: false,
  } as CallExpression;

  const result = visitJoinOperation(call, state.operation, "join", visitorContext);

  if (!result) {
    throw new Error("Failed to append join to plan");
  }

  visitorContext.autoParams = mergeAutoParams(visitorContext.autoParams, result.autoParams);

  return createState(
    state as unknown as SelectPlanState<unknown, TParams>,
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

function createNumericLiteral(value: number): NumericLiteral {
  return {
    type: "NumericLiteral",
    value,
  } as NumericLiteral;
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
