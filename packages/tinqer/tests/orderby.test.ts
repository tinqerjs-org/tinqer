/**
 * Tests for ORDER BY operations
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery } from "../dist/index.js";
import type { QueryBuilder } from "../dist/index.js";
import {
  asOrderByOperation,
  asSelectOperation,
  asTakeOperation,
  getOperation,
} from "./test-utils/operation-helpers.js";
import type { ConcatExpression } from "../dist/expressions/expression.js";
import type { ParamRef } from "../dist/query-tree/operations.js";
import { type TestSchema } from "./test-schema.js";

describe("ORDER BY Operations", () => {
  describe("orderBy()", () => {
    it("should parse orderBy with simple property", () => {
      const query = (q: QueryBuilder<TestSchema>) => q.from("users").orderBy((x) => x.name);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(getOperation(result));
      expect(orderByOp.keySelector).to.equal("name");
      expect(orderByOp.descending).to.equal(false);
    });

    it("should parse orderBy with numeric property", () => {
      const query = (q: QueryBuilder<TestSchema>) => q.from("users").orderBy((x) => x.age);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(getOperation(result));
      expect(orderByOp.keySelector).to.equal("age");
      expect(orderByOp.descending).to.equal(false);
    });

    it("should parse orderBy after where", () => {
      const query = (q: QueryBuilder<TestSchema>) =>
        q
          .from("users")
          .where((x) => x.age >= 18)
          .orderBy((x) => x.name);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(getOperation(result));
      expect(orderByOp.source.operationType).to.equal("where");
    });

    it("should parse orderBy before select", () => {
      const query = (q: QueryBuilder<TestSchema>) =>
        q
          .from("users")
          .orderBy((x) => x.age)
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("select");
      const selectOp = asSelectOperation(getOperation(result));
      expect(selectOp.source.operationType).to.equal("orderBy");
    });

    it("should parse orderBy with computed expression", () => {
      const query = (q: QueryBuilder<TestSchema>) =>
        q.from("users").orderBy((x) => x.firstName + x.lastName);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(getOperation(result));
      const concatExpr = orderByOp.keySelector as ConcatExpression;
      expect(concatExpr.type).to.equal("concat");
    });
  });

  describe("orderByDescending()", () => {
    it("should parse orderByDescending with simple property", () => {
      const query = (q: QueryBuilder<TestSchema>) =>
        q.from("users").orderByDescending((x) => x.createdAt);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(getOperation(result));
      expect(orderByOp.keySelector).to.equal("createdAt");
      expect(orderByOp.descending).to.equal(true);
    });

    it("should parse orderByDescending with numeric property", () => {
      const query = (q: QueryBuilder<TestSchema>) =>
        q.from("employees").orderByDescending((x) => x.salary);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(getOperation(result));
      expect(orderByOp.keySelector).to.equal("salary");
      expect(orderByOp.descending).to.equal(true);
    });

    it("should parse ordering with take", () => {
      const query = (q: QueryBuilder<TestSchema>) =>
        q
          .from("users")
          .orderByDescending((x) => x.age)
          .take(10);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("take");
      const takeOp = asTakeOperation(getOperation(result));
      const takeParam = takeOp.count as ParamRef;
      expect(takeParam.type).to.equal("param");
      expect(takeParam.param).to.equal("__p1");
      expect(result?.autoParams).to.deep.equal({ __p1: 10 });
      const orderByOp = asOrderByOperation(takeOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
      expect(orderByOp.descending).to.equal(true);
    });
  });
});
