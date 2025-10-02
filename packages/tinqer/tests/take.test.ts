/**
 * Tests for TAKE operation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../dist/index.js";
import {
  asTakeOperation,
  asWhereOperation,
  asOrderByOperation,
  asSelectOperation,
  getOperation,
} from "./test-utils/operation-helpers.js";
import type { ParamRef } from "../dist/query-tree/operations.js";
import { db } from "./test-schema.js";

describe("TAKE Operation", () => {
  it("should parse take with constant number", () => {
    const query = () => from(db, "users").take(10);
    const result = parseQuery(query);

    expect(getOperation(result)?.operationType).to.equal("take");
    const takeOp = asTakeOperation(getOperation(result));
    const countParam = takeOp.count as ParamRef;
    expect(countParam.type).to.equal("param");
    expect(countParam.param).to.equal("__p1");
    expect(result?.autoParams).to.deep.equal({ __p1: 10 });
  });

  it("should parse take(0)", () => {
    const query = () => from(db, "users").take(0);
    const result = parseQuery(query);

    const takeOp = asTakeOperation(getOperation(result));
    const countParam = takeOp.count as ParamRef;
    expect(countParam.type).to.equal("param");
    expect(countParam.param).to.equal("__p1");
    expect(result?.autoParams).to.deep.equal({ __p1: 0 });
  });

  it("should parse take with large number", () => {
    const query = () => from(db, "users").take(1000000);
    const result = parseQuery(query);

    const takeOp = asTakeOperation(getOperation(result));
    const countParam = takeOp.count as ParamRef;
    expect(countParam.type).to.equal("param");
    expect(countParam.param).to.equal("__p1");
    expect(result?.autoParams).to.deep.equal({ __p1: 1000000 });
  });

  it("should parse take after where", () => {
    const query = () =>
      from(db, "users")
        .where((x) => x.isActive)
        .take(5);
    const result = parseQuery(query);

    expect(getOperation(result)?.operationType).to.equal("take");
    const takeOp = asTakeOperation(getOperation(result));
    const countParam = takeOp.count as ParamRef;
    expect(countParam.type).to.equal("param");
    expect(countParam.param).to.equal("__p1");
    expect(result?.autoParams).to.deep.equal({ __p1: 5 });
    const whereOp = asWhereOperation(takeOp.source);
    expect(whereOp.operationType).to.equal("where");
  });

  it("should parse take after orderBy", () => {
    const query = () =>
      from(db, "users")
        .orderBy((x) => x.name)
        .take(10);
    const result = parseQuery(query);

    expect(getOperation(result)?.operationType).to.equal("take");
    const takeOp = asTakeOperation(getOperation(result));
    const countParam = takeOp.count as ParamRef;
    expect(countParam.type).to.equal("param");
    expect(countParam.param).to.equal("__p1");
    expect(result?.autoParams).to.deep.equal({ __p1: 10 });
    const orderByOp = asOrderByOperation(takeOp.source);
    expect(orderByOp.operationType).to.equal("orderBy");
  });

  it("should parse take before select", () => {
    const query = () =>
      from(db, "users")
        .take(5)
        .select((x) => x.name);
    const result = parseQuery(query);

    expect(getOperation(result)?.operationType).to.equal("select");
    const selectOp = asSelectOperation(getOperation(result));
    const takeOp = asTakeOperation(selectOp.source);
    expect(takeOp.operationType).to.equal("take");
    const countParam = takeOp.count as ParamRef;
    expect(countParam.type).to.equal("param");
    expect(countParam.param).to.equal("__p1");
    expect(result?.autoParams).to.deep.equal({ __p1: 5 });
  });

  it("should parse take with external parameter", () => {
    const query = (p: { limit: number }) => from(db, "users").take(p.limit);
    const result = parseQuery(query);

    const takeOp = asTakeOperation(getOperation(result));
    const paramRef = takeOp.count as ParamRef;
    expect(paramRef.type).to.equal("param");
    expect(paramRef.param).to.equal("p");
    expect(paramRef.property).to.equal("limit");
  });
});
