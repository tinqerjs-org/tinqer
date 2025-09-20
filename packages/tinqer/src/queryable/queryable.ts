/**
 * Queryable Class
 * Fluent API for building type-safe queries with LINQ-style type safety
 */

/**
 * Helper types for strict type safety
 * These can be extended to enforce property-level type constraints
 */
// Reserved for future type constraints

import type {
  Expression,
  WhereExpression,
  SelectExpression,
  GroupByExpression,
  HavingExpression,
  LimitOffsetExpression,
  OrderByExpression,
  LambdaExpression,
  LogicalExpression,
  BinaryExpression,
  CallExpression,
  ConstantExpression,
} from "../types/expressions.js";
import type {
  QueryExpression,
  SourceExpression,
  JoinExpression,
  OrderExpression,
} from "../types/query-expressions.js";
import { OxcParser } from "../parser/oxc-parser.js";
import { AstConverter, ConversionContext } from "../converter/ast-converter.js";

/**
 * Type-safe queryable with strict typing similar to .NET LINQ
 * @template T The entity type being queried
 */
export class Queryable<T> {
  private parser: OxcParser;
  private tableName: string;
  private whereExpressions: WhereExpression[] = [];
  private selectExpression?: SelectExpression;
  private joinExpressions: JoinExpression[] = [];
  private orderByExpressions: OrderExpression[] = [];
  private groupByExpression?: GroupByExpression;
  private havingExpression?: HavingExpression;
  private limitExpression?: LimitOffsetExpression;
  private offsetExpression?: LimitOffsetExpression;
  private distinctFlag?: boolean;

  constructor(tableName: string, parser?: OxcParser) {
    this.tableName = tableName;
    this.parser = parser || new OxcParser();
  }

  /**
   * Static factory method for better type inference
   */
  static from<TEntity>(tableName: string): Queryable<TEntity> {
    return new Queryable<TEntity>(tableName);
  }

  /**
   * Filters a sequence of values based on a predicate
   * @param predicate A function to test each element for a condition
   */
  where(predicate: ((item: T) => boolean) | string): Queryable<T> {
    const lambdaString = typeof predicate === "string" ? predicate : predicate.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast as never, context);

    // Extract lambda body if it's a lambda
    let whereExpr: WhereExpression;
    if (expression.type === "lambda") {
      whereExpr = (expression as LambdaExpression).body as WhereExpression;
    } else {
      whereExpr = expression as WhereExpression;
    }

    const newQueryable = this.clone();
    newQueryable.whereExpressions.push(whereExpr);
    return newQueryable;
  }

  /**
   * Projects each element of a sequence into a new form
   * @param selector A transform function to apply to each element
   */
  select<TResult>(selector: ((source: T) => TResult) | string): Queryable<TResult> {
    const lambdaString = typeof selector === "string" ? selector : selector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast as never, context);

    // Extract lambda body if it's a lambda
    let selectExpr: SelectExpression;
    if (expression.type === "lambda") {
      selectExpr = (expression as LambdaExpression).body as SelectExpression;
    } else {
      selectExpr = expression as SelectExpression;
    }

    const newQueryable = new Queryable<TResult>(this.tableName, this.parser);
    newQueryable.whereExpressions = [...this.whereExpressions];
    newQueryable.selectExpression = selectExpr;
    newQueryable.joinExpressions = [...this.joinExpressions];
    newQueryable.orderByExpressions = [...this.orderByExpressions];
    newQueryable.groupByExpression = this.groupByExpression;
    newQueryable.havingExpression = this.havingExpression;
    newQueryable.limitExpression = this.limitExpression;
    newQueryable.offsetExpression = this.offsetExpression;
    newQueryable.distinctFlag = this.distinctFlag;
    return newQueryable;
  }

  /**
   * Correlates the elements of two sequences based on matching keys
   * @param inner The sequence to join to the first sequence
   * @param outerKeySelector A function to extract the join key from each element of the first sequence
   * @param innerKeySelector A function to extract the join key from each element of the second sequence
   * @param resultSelector A function to create a result element from two matching elements
   */
  join<TInner, TKey, TResult>(
    inner: Queryable<TInner>,
    outerKeySelector: ((outer: T) => TKey) | string,
    innerKeySelector: ((inner: TInner) => TKey) | string,
    resultSelector: ((outer: T, inner: TInner) => TResult) | string,
  ): Queryable<TResult> {
    return this.addJoin<TInner, TKey, TResult>(
      "INNER",
      inner,
      outerKeySelector,
      innerKeySelector,
      resultSelector as ((outer: T, inner: TInner | null) => TResult) | string,
    );
  }

  /**
   * LEFT JOIN - Type-safe join with nullable inner
   */
  leftJoin<TInner, TKey, TResult>(
    inner: Queryable<TInner>,
    outerKeySelector: ((outer: T) => TKey) | string,
    innerKeySelector: ((inner: TInner) => TKey) | string,
    resultSelector: ((outer: T, inner: TInner | null) => TResult) | string,
  ): Queryable<TResult> {
    return this.addJoin<TInner, TKey, TResult>("LEFT", inner, outerKeySelector, innerKeySelector, resultSelector);
  }

  private addJoin<TInner, TKey, TResult>(
    kind: "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS",
    inner: Queryable<TInner>,
    outerKeySelector: ((outer: T) => TKey) | string,
    innerKeySelector: ((inner: TInner) => TKey) | string,
    resultSelector: ((outer: T, inner: TInner | null) => TResult) | string,
  ): Queryable<TResult> {
    // Parse outer key selector
    const outerKeyString =
      typeof outerKeySelector === "string" ? outerKeySelector : outerKeySelector.toString();
    const outerAst = this.parser.parse(outerKeyString);
    const outerContext: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };
    const outerKeyExpression = AstConverter.convert(outerAst as never, outerContext);

    // Extract lambda body if it's a lambda
    const outerKeyExpr = outerKeyExpression.type === "lambda"
      ? (outerKeyExpression as LambdaExpression).body
      : outerKeyExpression;

    // Parse inner key selector
    const innerKeyString =
      typeof innerKeySelector === "string" ? innerKeySelector : innerKeySelector.toString();
    const innerAst = this.parser.parse(innerKeyString);
    const innerContext: ConversionContext = {
      parameterOrigin: { type: "table", ref: inner.tableName },
    };
    const innerKeyExpression = AstConverter.convert(innerAst as never, innerContext);

    // Extract lambda body if it's a lambda
    const innerKeyExpr = innerKeyExpression.type === "lambda"
      ? (innerKeyExpression as LambdaExpression).body
      : innerKeyExpression;

    // Build ON condition as binary expression
    const onCondition: BinaryExpression = {
      type: "binary",
      operator: "==",
      left: outerKeyExpr,
      right: innerKeyExpr,
    };

    // Parse result selector
    const resultString =
      typeof resultSelector === "string" ? resultSelector : resultSelector.toString();
    const resultAst = this.parser.parse(resultString);
    const resultContext: ConversionContext = {
      parameterOrigin: { type: "joined" },
    };
    const resultExpression = AstConverter.convert(resultAst as never, resultContext);

    // Extract lambda body if it's a lambda
    const resultExpr: SelectExpression = resultExpression.type === "lambda"
      ? (resultExpression as LambdaExpression).body as SelectExpression
      : resultExpression as SelectExpression;

    // Create JOIN expression
    const join: JoinExpression = {
      type: "join",
      kind,
      table: inner.tableName,
      on: onCondition,
    };

    // Create new Queryable with JOIN
    const newQueryable = new Queryable<TResult>(this.tableName, this.parser);
    newQueryable.whereExpressions = [...this.whereExpressions];
    newQueryable.selectExpression = resultExpr; // Result selector becomes SELECT
    newQueryable.joinExpressions = [...this.joinExpressions, join];
    newQueryable.orderByExpressions = [...this.orderByExpressions];
    newQueryable.groupByExpression = this.groupByExpression;
    newQueryable.havingExpression = this.havingExpression;
    newQueryable.limitExpression = this.limitExpression;
    newQueryable.offsetExpression = this.offsetExpression;
    newQueryable.distinctFlag = this.distinctFlag;
    return newQueryable;
  }

  /**
   * ORDER BY ascending - Strictly typed key selector
   */
  orderBy<TKey>(keySelector: ((item: T) => TKey) | string): Queryable<T> {
    const lambdaString = typeof keySelector === "string" ? keySelector : keySelector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast as never, context);

    // Extract lambda body if it's a lambda
    let orderByExpr: OrderByExpression;
    if (expression.type === "lambda") {
      orderByExpr = (expression as LambdaExpression).body as OrderByExpression;
    } else {
      orderByExpr = expression as OrderByExpression;
    }

    const orderExpr: OrderExpression = {
      type: "order",
      expression: orderByExpr,
      direction: "ASC",
    };

    const newQueryable = this.clone();
    newQueryable.orderByExpressions.push(orderExpr);
    return newQueryable;
  }

  /**
   * ORDER BY descending - Strictly typed key selector
   */
  orderByDescending<TKey>(keySelector: ((item: T) => TKey) | string): Queryable<T> {
    const lambdaString = typeof keySelector === "string" ? keySelector : keySelector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast as never, context);

    // Extract lambda body if it's a lambda
    let orderByExpr: OrderByExpression;
    if (expression.type === "lambda") {
      orderByExpr = (expression as LambdaExpression).body as OrderByExpression;
    } else {
      orderByExpr = expression as OrderByExpression;
    }

    const orderExpr: OrderExpression = {
      type: "order",
      expression: orderByExpr,
      direction: "DESC",
    };

    const newQueryable = this.clone();
    newQueryable.orderByExpressions.push(orderExpr);
    return newQueryable;
  }

  /**
   * GROUP BY - Strictly typed grouping key
   */
  groupBy<TKey>(keySelector: ((item: T) => TKey) | string): Queryable<T> {
    const lambdaString = typeof keySelector === "string" ? keySelector : keySelector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast as never, context);

    // Extract lambda body if it's a lambda
    let groupByExpr: GroupByExpression;
    if (expression.type === "lambda") {
      groupByExpr = (expression as LambdaExpression).body as GroupByExpression;
    } else {
      groupByExpr = expression as GroupByExpression;
    }

    const newQueryable = this.clone();
    newQueryable.groupByExpression = groupByExpr;
    return newQueryable;
  }

  /**
   * HAVING
   */
  having(predicate: ((item: T) => boolean) | string): Queryable<T> {
    const lambdaString = typeof predicate === "string" ? predicate : predicate.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast as never, context);

    // Extract lambda body if it's a lambda
    let havingExpr: HavingExpression;
    if (expression.type === "lambda") {
      havingExpr = (expression as LambdaExpression).body as HavingExpression;
    } else {
      havingExpr = expression as HavingExpression;
    }

    const newQueryable = this.clone();
    newQueryable.havingExpression = havingExpr;
    return newQueryable;
  }

  /**
   * Returns a specified number of contiguous elements from the start
   */
  take(count: number | string): Queryable<T> {
    const newQueryable = this.clone();

    if (typeof count === "number") {
      // Direct number - store as constant
      newQueryable.limitExpression = {
        type: "constant",
        value: count,
      } as ConstantExpression;
    } else {
      // Parse expression string
      const lambdaString = count;
      const ast = this.parser.parse(lambdaString);

      const context: ConversionContext = {
        externalParams: new Set(["params"]), // Allow params access
      };

      const expression = AstConverter.convert(ast as never, context);

      // Extract lambda body if it's a lambda
      if (expression.type === "lambda") {
        newQueryable.limitExpression = (expression as LambdaExpression).body as LimitOffsetExpression;
      } else {
        newQueryable.limitExpression = expression as LimitOffsetExpression;
      }
    }

    return newQueryable;
  }

  /**
   * Bypasses a specified number of elements and returns the remaining
   */
  skip(count: number | string): Queryable<T> {
    const newQueryable = this.clone();

    if (typeof count === "number") {
      // Direct number - store as constant
      newQueryable.offsetExpression = {
        type: "constant",
        value: count,
      } as ConstantExpression;
    } else {
      // Parse expression string
      const lambdaString = count;
      const ast = this.parser.parse(lambdaString);

      const context: ConversionContext = {
        externalParams: new Set(["params"]), // Allow params access
      };

      const expression = AstConverter.convert(ast as never, context);

      // Extract lambda body if it's a lambda
      if (expression.type === "lambda") {
        newQueryable.offsetExpression = (expression as LambdaExpression).body as LimitOffsetExpression;
      } else {
        newQueryable.offsetExpression = expression as LimitOffsetExpression;
      }
    }

    return newQueryable;
  }

  /**
   * DISTINCT
   */
  distinct(): Queryable<T> {
    const newQueryable = this.clone();
    newQueryable.distinctFlag = true;
    return newQueryable;
  }

  /**
   * Determines whether any element of a sequence satisfies a condition
   */
  any(predicate?: ((source: T) => boolean) | string): QueryExpression {
    const query = this.build();

    if (predicate) {
      // Add the predicate as a WHERE condition
      const whereQuery = this.where(predicate);
      return whereQuery.any();
    }

    // EXISTS query
    query.select = {
      type: "constant",
      value: 1
    } as ConstantExpression;

    return query;
  }

  /**
   * Determines whether all elements of a sequence satisfy a condition
   */
  all(predicate: ((source: T) => boolean) | string): QueryExpression {
    // ALL can be implemented as NOT EXISTS (WHERE NOT predicate)
    const negatedQuery = this.where(`(item) => !(${predicate})`);
    const query = negatedQuery.build();

    query.select = {
      type: "constant",
      value: 1
    } as ConstantExpression;

    return query;
  }

  /**
   * Returns the first element of a sequence
   */
  first(predicate?: ((source: T) => boolean) | string): QueryExpression {
    let query = this as Queryable<T>;

    if (predicate) {
      query = query.where(predicate);
    }

    return query.take(1).build();
  }

  /**
   * Returns the first element of a sequence, or a default value if empty
   */
  firstOrDefault(predicate?: ((source: T) => boolean) | string): QueryExpression {
    // Same as first() but with different null handling at execution
    return this.first(predicate);
  }

  /**
   * Returns the number of elements in a sequence
   */
  count(predicate?: ((source: T) => boolean) | string): QueryExpression {
    let query: Queryable<T> = this;

    if (predicate) {
      query = query.where(predicate);
    }

    const builtQuery = query.build();
    builtQuery.select = {
      type: "call",
      method: "COUNT",
      arguments: [{ type: "constant", value: "*" } as ConstantExpression],
    } as CallExpression;
    return builtQuery;
  }

  /**
   * Returns the only element of a sequence, throws if != 1 element
   */
  single(predicate?: ((source: T) => boolean) | string): QueryExpression {
    let query = this as Queryable<T>;

    if (predicate) {
      query = query.where(predicate);
    }

    // Single should verify exactly one element (handled at execution)
    return query.take(2).build(); // Take 2 to check for multiple
  }

  /**
   * Returns the only element or default if empty, throws if > 1 element
   */
  singleOrDefault(predicate?: ((source: T) => boolean) | string): QueryExpression {
    return this.single(predicate);
  }

  /**
   * Determines whether a sequence contains a specified element
   */
  contains<TValue>(value: TValue): QueryExpression {
    // Implement as WHERE item == value
    return this.where(`(item) => item === ${JSON.stringify(value)}`).any();
  }

  /**
   * Computes the sum of a sequence of numeric values
   */
  sum(selector: ((item: T) => number) | string): QueryExpression {
    const lambdaString = typeof selector === "string" ? selector : selector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast as never, context);

    // Extract lambda body
    let sumExpr: Expression;
    if (expression.type === "lambda") {
      sumExpr = (expression as LambdaExpression).body;
    } else {
      sumExpr = expression;
    }

    const query = this.build();
    query.select = {
      type: "call",
      method: "SUM",
      arguments: [sumExpr],
    } as CallExpression;
    return query;
  }

  /**
   * AVG aggregate - Strictly typed numeric selector
   */
  avg(selector: ((item: T) => number) | string): QueryExpression {
    const lambdaString = typeof selector === "string" ? selector : selector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast as never, context);

    // Extract lambda body
    let avgExpr: Expression;
    if (expression.type === "lambda") {
      avgExpr = (expression as LambdaExpression).body;
    } else {
      avgExpr = expression;
    }

    const query = this.build();
    query.select = {
      type: "call",
      method: "AVG",
      arguments: [avgExpr],
    } as CallExpression;
    return query;
  }

  /**
   * MIN aggregate - Works with any comparable type
   */
  min<TValue>(selector: ((item: T) => TValue) | string): QueryExpression {
    const lambdaString = typeof selector === "string" ? selector : selector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast as never, context);

    // Extract lambda body
    let minExpr: Expression;
    if (expression.type === "lambda") {
      minExpr = (expression as LambdaExpression).body;
    } else {
      minExpr = expression;
    }

    const query = this.build();
    query.select = {
      type: "call",
      method: "MIN",
      arguments: [minExpr],
    } as CallExpression;
    return query;
  }

  /**
   * MAX aggregate - Works with any comparable type
   */
  max<TValue>(selector: ((item: T) => TValue) | string): QueryExpression {
    const lambdaString = typeof selector === "string" ? selector : selector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast as never, context);

    // Extract lambda body
    let maxExpr: Expression;
    if (expression.type === "lambda") {
      maxExpr = (expression as LambdaExpression).body;
    } else {
      maxExpr = expression;
    }

    const query = this.build();
    query.select = {
      type: "call",
      method: "MAX",
      arguments: [maxExpr],
    } as CallExpression;
    return query;
  }

  /**
   * Build the QueryExpression
   */
  build(): QueryExpression {
    // Combine WHERE expressions with AND
    let whereExpr: WhereExpression | undefined;
    if (this.whereExpressions.length === 1) {
      whereExpr = this.whereExpressions[0];
    } else if (this.whereExpressions.length > 1) {
      whereExpr = this.whereExpressions.reduce((acc, expr) => ({
        type: "logical",
        operator: "&&" as const,
        left: acc,
        right: expr,
      } as LogicalExpression));
    }

    // Build source
    const source: SourceExpression = {
      type: "source",
      source: {
        type: "table",
        name: this.tableName,
      },
    };

    return {
      type: "query",
      operation: "SELECT",
      from: source,
      select: this.selectExpression,
      where: whereExpr,
      groupBy: this.groupByExpression,
      having: this.havingExpression,
      orderBy: this.orderByExpressions.length > 0 ? this.orderByExpressions : undefined,
      joins: this.joinExpressions.length > 0 ? this.joinExpressions : undefined,
      limit: this.limitExpression,
      offset: this.offsetExpression,
      distinct: this.distinctFlag,
    };
  }

  private clone(): Queryable<T> {
    const newQueryable = new Queryable<T>(this.tableName, this.parser);
    newQueryable.whereExpressions = [...this.whereExpressions];
    newQueryable.selectExpression = this.selectExpression;
    newQueryable.joinExpressions = [...this.joinExpressions];
    newQueryable.orderByExpressions = [...this.orderByExpressions];
    newQueryable.groupByExpression = this.groupByExpression;
    newQueryable.havingExpression = this.havingExpression;
    newQueryable.limitExpression = this.limitExpression;
    newQueryable.offsetExpression = this.offsetExpression;
    newQueryable.distinctFlag = this.distinctFlag;
    return newQueryable;
  }
}
