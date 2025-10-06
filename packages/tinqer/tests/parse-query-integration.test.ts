/**
 * Tests for parseQuery function
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery } from "../dist/index.js";
import type { QueryDSL } from "../dist/index.js";
import {
  asFromOperation,
  asWhereOperation,
  asSelectOperation,
  asOrderByOperation,
  asTakeOperation,
  getOperation,
} from "./test-utils/operation-helpers.js";
import type { ParamRef } from "../dist/query-tree/operations.js";
import type {
  ComparisonExpression,
  ObjectExpression,
  LogicalExpression,
  BooleanMethodExpression,
  ColumnExpression,
} from "../dist/expressions/expression.js";
import { type TestSchema } from "./test-schema.js";

describe("Parse Query Integration Tests", () => {
  it("should parse a simple from query", () => {
    const query = (ctx: QueryDSL<TestSchema>) => ctx.from("users");
    const result = parseQuery(query);

    expect(getOperation(result)).to.not.be.null;
    expect(getOperation(result)?.operationType).to.equal("from");
    const fromOp = asFromOperation(getOperation(result));
    expect(fromOp.table).to.equal("users");
  });

  it("should parse a where clause", () => {
    const query = (ctx: QueryDSL<TestSchema>) => ctx.from("users").where((x) => x.age >= 18);
    const result = parseQuery(query);

    expect(getOperation(result)).to.not.be.null;
    expect(getOperation(result)?.operationType).to.equal("where");
    const whereOp = asWhereOperation(getOperation(result));
    expect(whereOp.source.operationType).to.equal("from");
    const predicate = whereOp.predicate as ComparisonExpression;
    expect(predicate.type).to.equal("comparison");
  });

  it("should parse a select projection", () => {
    const query = (ctx: QueryDSL<TestSchema>) =>
      ctx.from("users").select((x) => ({
        id: x.id,
        name: x.name,
      }));
    const result = parseQuery(query);

    expect(getOperation(result)).to.not.be.null;
    expect(getOperation(result)?.operationType).to.equal("select");
    const selectOp = asSelectOperation(getOperation(result));
    const objectSelector = selectOp.selector as ObjectExpression;
    expect(objectSelector.type).to.equal("object");
  });

  it("should parse a complex query chain", () => {
    const query = (ctx: QueryDSL<TestSchema>) =>
      ctx
        .from("users")
        .where((x) => x.age >= 18 && x.isActive)
        .select((x) => ({ id: x.id, name: x.name }))
        .orderBy((x) => x.name)
        .take(10);
    const result = parseQuery(query);

    expect(getOperation(result)).to.not.be.null;
    expect(getOperation(result)?.operationType).to.equal("take");
    const takeOp = asTakeOperation(getOperation(result));
    const takeParam = takeOp.count as ParamRef;
    expect(takeParam.type).to.equal("param");
    expect(takeParam.param).to.equal("__p2");
    expect(result?.autoParams).to.deep.equal({ __p1: 18, __p2: 10 });

    const orderByOp = asOrderByOperation(takeOp.source);
    expect(orderByOp.operationType).to.equal("orderBy");
    expect(orderByOp.keySelector).to.equal("name");

    const selectOp = asSelectOperation(orderByOp.source);
    expect(selectOp.operationType).to.equal("select");

    const whereOp = asWhereOperation(selectOp.source);
    expect(whereOp.operationType).to.equal("where");
    const predicate = whereOp.predicate as LogicalExpression;
    expect(predicate.type).to.equal("logical");

    const fromOp = asFromOperation(whereOp.source);
    expect(fromOp.operationType).to.equal("from");
    expect(fromOp.table).to.equal("users");
  });

  it("should parse query with external parameters", () => {
    const query = (ctx: QueryDSL<TestSchema>, p: { minAge: number }) =>
      ctx.from("users").where((x) => x.age >= p.minAge);
    const result = parseQuery(query);

    expect(getOperation(result)).to.not.be.null;
    expect(getOperation(result)?.operationType).to.equal("where");
    const whereOp = asWhereOperation(getOperation(result));
    const predicate = whereOp.predicate as ComparisonExpression;
    expect(predicate.type).to.equal("comparison");
    const leftColumn = predicate.left as ColumnExpression;
    expect(leftColumn.type).to.equal("column");
    expect(leftColumn.name).to.equal("age");
    const rightParam = predicate.right as ParamRef;
    expect(rightParam.type).to.equal("param");
    expect(rightParam.param).to.equal("p");
    expect(rightParam.property).to.equal("minAge");
  });

  it("should parse terminal operations", () => {
    const query1 = (ctx: QueryDSL<TestSchema>) => ctx.from("users").count();
    const result1 = parseQuery(query1);
    expect(getOperation(result1)?.operationType).to.equal("count");

    const query2 = (ctx: QueryDSL<TestSchema>) => ctx.from("users").first();
    const result2 = parseQuery(query2);
    expect(getOperation(result2)?.operationType).to.equal("first");
  });

  it("should parse string methods", () => {
    const query = (ctx: QueryDSL<TestSchema>) =>
      ctx.from("users").where((x) => x.name.startsWith("John"));
    const result = parseQuery(query);

    expect(getOperation(result)).to.not.be.null;
    const whereOp = asWhereOperation(getOperation(result));
    const predicate = whereOp.predicate as BooleanMethodExpression;
    expect(predicate.type).to.equal("booleanMethod");
    expect(predicate.method).to.equal("startsWith");
    expect(predicate.object.type).to.equal("column");
    const objectColumn = predicate.object as ColumnExpression;
    expect(objectColumn.name).to.equal("name");
  });
});
