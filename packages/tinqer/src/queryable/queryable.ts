/**
 * Queryable Class
 * Fluent API for building type-safe queries
 */

import type {
  Expression,
  LambdaExpression,
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

export class Queryable<T> {
  private parser: OxcParser;
  private tableName: string;
  private whereExpressions: Expression[] = [];
  private selectExpression?: Expression;
  private joinExpressions: JoinExpression[] = [];
  private orderByExpressions: OrderExpression[] = [];
  private groupByExpression?: Expression;
  private havingExpression?: Expression;
  private limitValue?: number;
  private offsetValue?: number;
  private distinctFlag?: boolean;

  constructor(tableName: string, parser?: OxcParser) {
    this.tableName = tableName;
    this.parser = parser || new OxcParser();
  }

  /**
   * WHERE clause
   */
  where(predicate: ((item: T) => boolean) | string): Queryable<T> {
    const lambdaString = typeof predicate === "string" ? predicate : predicate.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast, context);

    // Extract lambda body if it's a lambda
    let whereExpr: Expression;
    if (expression.type === "lambda") {
      whereExpr = (expression as LambdaExpression).body;
    } else {
      whereExpr = expression;
    }

    const newQueryable = this.clone();
    newQueryable.whereExpressions.push(whereExpr);
    return newQueryable;
  }

  /**
   * SELECT projection
   */
  select<U>(selector: ((item: T) => U) | string): Queryable<U> {
    const lambdaString = typeof selector === "string" ? selector : selector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast, context);

    const newQueryable = new Queryable<U>(this.tableName, this.parser);
    newQueryable.whereExpressions = [...this.whereExpressions];
    newQueryable.selectExpression = expression;
    newQueryable.joinExpressions = [...this.joinExpressions];
    newQueryable.orderByExpressions = [...this.orderByExpressions];
    newQueryable.groupByExpression = this.groupByExpression;
    newQueryable.havingExpression = this.havingExpression;
    newQueryable.limitValue = this.limitValue;
    newQueryable.offsetValue = this.offsetValue;
    newQueryable.distinctFlag = this.distinctFlag;
    return newQueryable;
  }

  /**
   * INNER JOIN
   */
  join<TOther, TResult>(
    other: Queryable<TOther>,
    outerKeySelector: ((item: T) => any) | string,
    innerKeySelector: ((item: TOther) => any) | string,
    resultSelector: ((outer: T, inner: TOther) => TResult) | string,
  ): Queryable<TResult> {
    return this.addJoin("INNER", other, outerKeySelector, innerKeySelector, resultSelector);
  }

  /**
   * LEFT JOIN
   */
  leftJoin<TOther, TResult>(
    other: Queryable<TOther>,
    outerKeySelector: ((item: T) => any) | string,
    innerKeySelector: ((item: TOther) => any) | string,
    resultSelector: ((outer: T, inner: TOther | null) => TResult) | string,
  ): Queryable<TResult> {
    return this.addJoin("LEFT", other, outerKeySelector, innerKeySelector, resultSelector);
  }

  private addJoin<TOther, TResult>(
    kind: "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS",
    other: Queryable<TOther>,
    outerKeySelector: any,
    innerKeySelector: any,
    resultSelector: any,
  ): Queryable<TResult> {
    // Parse outer key selector
    const outerKeyString =
      typeof outerKeySelector === "string" ? outerKeySelector : outerKeySelector.toString();
    const outerAst = this.parser.parse(outerKeyString);
    const outerContext: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };
    const outerKeyExpr = AstConverter.convert(outerAst, outerContext);

    // Parse inner key selector
    const innerKeyString =
      typeof innerKeySelector === "string" ? innerKeySelector : innerKeySelector.toString();
    const innerAst = this.parser.parse(innerKeyString);
    const innerContext: ConversionContext = {
      parameterOrigin: { type: "table", ref: other.tableName },
    };
    const innerKeyExpr = AstConverter.convert(innerAst, innerContext);

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
    const resultExpr = AstConverter.convert(resultAst, resultContext);

    // Create JOIN expression
    const join: JoinExpression = {
      type: "join",
      kind,
      table: other.tableName,
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
    newQueryable.limitValue = this.limitValue;
    newQueryable.offsetValue = this.offsetValue;
    newQueryable.distinctFlag = this.distinctFlag;
    return newQueryable;
  }

  /**
   * ORDER BY ascending
   */
  orderBy<K>(keySelector: ((item: T) => K) | string): Queryable<T> {
    const lambdaString = typeof keySelector === "string" ? keySelector : keySelector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast, context);

    const orderExpr: OrderExpression = {
      type: "order",
      expression,
      direction: "ASC",
    };

    const newQueryable = this.clone();
    newQueryable.orderByExpressions.push(orderExpr);
    return newQueryable;
  }

  /**
   * ORDER BY descending
   */
  orderByDescending<K>(keySelector: ((item: T) => K) | string): Queryable<T> {
    const lambdaString = typeof keySelector === "string" ? keySelector : keySelector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast, context);

    const orderExpr: OrderExpression = {
      type: "order",
      expression,
      direction: "DESC",
    };

    const newQueryable = this.clone();
    newQueryable.orderByExpressions.push(orderExpr);
    return newQueryable;
  }

  /**
   * GROUP BY
   */
  groupBy<K>(keySelector: ((item: T) => K) | string): Queryable<T> {
    const lambdaString = typeof keySelector === "string" ? keySelector : keySelector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast, context);

    const newQueryable = this.clone();
    newQueryable.groupByExpression = expression;
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

    const expression = AstConverter.convert(ast, context);

    // Extract lambda body if it's a lambda
    let havingExpr: Expression;
    if (expression.type === "lambda") {
      havingExpr = (expression as LambdaExpression).body;
    } else {
      havingExpr = expression;
    }

    const newQueryable = this.clone();
    newQueryable.havingExpression = havingExpr;
    return newQueryable;
  }

  /**
   * LIMIT
   */
  take(limit: number): Queryable<T> {
    const newQueryable = this.clone();
    newQueryable.limitValue = limit;
    return newQueryable;
  }

  /**
   * OFFSET
   */
  skip(offset: number): Queryable<T> {
    const newQueryable = this.clone();
    newQueryable.offsetValue = offset;
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
   * COUNT aggregate
   */
  count(): QueryExpression {
    const query = this.build();
    query.select = {
      type: "call",
      method: "COUNT",
      arguments: [{ type: "constant", value: "*" } as ConstantExpression],
    } as CallExpression;
    return query;
  }

  /**
   * SUM aggregate
   */
  sum(selector: ((item: T) => number) | string): QueryExpression {
    const lambdaString = typeof selector === "string" ? selector : selector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast, context);

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
   * AVG aggregate
   */
  avg(selector: ((item: T) => number) | string): QueryExpression {
    const lambdaString = typeof selector === "string" ? selector : selector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast, context);

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
   * MIN aggregate
   */
  min(selector: ((item: T) => any) | string): QueryExpression {
    const lambdaString = typeof selector === "string" ? selector : selector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast, context);

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
   * MAX aggregate
   */
  max(selector: ((item: T) => any) | string): QueryExpression {
    const lambdaString = typeof selector === "string" ? selector : selector.toString();
    const ast = this.parser.parse(lambdaString);

    const context: ConversionContext = {
      parameterOrigin: { type: "table", ref: this.tableName },
    };

    const expression = AstConverter.convert(ast, context);

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
    let whereExpr: Expression | undefined;
    if (this.whereExpressions.length === 1) {
      whereExpr = this.whereExpressions[0];
    } else if (this.whereExpressions.length > 1) {
      whereExpr = this.whereExpressions.reduce((acc, expr) => ({
        type: "logical",
        operator: "&&",
        left: acc,
        right: expr,
      }));
    }

    // Build source
    const source: SourceExpression = {
      type: "source",
      source: {
        type: "table",
        name: this.tableName,
      },
    };

    // Build limit/offset expressions
    const limit =
      this.limitValue !== undefined
        ? ({ type: "constant", value: this.limitValue } as Expression)
        : undefined;

    const offset =
      this.offsetValue !== undefined
        ? ({ type: "constant", value: this.offsetValue } as Expression)
        : undefined;

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
      limit,
      offset,
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
    newQueryable.limitValue = this.limitValue;
    newQueryable.offsetValue = this.offsetValue;
    newQueryable.distinctFlag = this.distinctFlag;
    return newQueryable;
  }
}
