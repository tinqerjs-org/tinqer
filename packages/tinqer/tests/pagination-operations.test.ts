/**
 * Tests for pagination operations: take, skip, takeWhile, skipWhile
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import {
  asTakeOperation,
  asSkipOperation,
  asOrderByOperation,
  asSelectOperation,
} from "./test-utils/operation-helpers.js";
import type { ParamRef } from "../src/query-tree/operations.js";
import type { ArithmeticExpression } from "../src/expressions/expression.js";

describe("Pagination Operations", () => {
  describe("take()", () => {
    it("should parse take with constant number", () => {
      const query = () => from<{ id: number; name: string }>("users").take(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      expect(takeOp.count).to.equal(10);
    });

    it("should parse take(0)", () => {
      const query = () => from<{ id: number }>("users").take(0);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      expect(takeOp.count).to.equal(0);
    });

    it("should parse take with large number", () => {
      const query = () => from<{ id: number }>("users").take(1000000);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      expect(takeOp.count).to.equal(1000000);
    });

    it("should parse take after where", () => {
      const query = () =>
        from<{ id: number; isActive: boolean }>("users")
          .where((x) => x.isActive)
          .take(5);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      expect(takeOp.count).to.equal(5);
      expect(takeOp.source.operationType).to.equal("where");
    });

    it("should parse take after orderBy", () => {
      const query = () =>
        from<{ id: number; score: number }>("scores")
          .orderByDescending((x) => x.score)
          .take(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      const orderByOp = asOrderByOperation(takeOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
      expect(orderByOp.descending).to.equal(true);
    });

    it("should parse take before select", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users")
          .take(10)
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const selectOp = asSelectOperation(result);
      expect(selectOp.source.operationType).to.equal("take");
    });

    it("should parse take with external parameter", () => {
      const query = (p: { limit: number }) => from<{ id: number }>("users").take(p.limit);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      const paramRef = takeOp.count as ParamRef;
      expect(paramRef.type).to.equal("param");
      expect(paramRef.param).to.equal("p");
      expect(paramRef.property).to.equal("limit");
    });
  });

  describe("skip()", () => {
    it("should parse skip with constant number", () => {
      const query = () => from<{ id: number; name: string }>("users").skip(20);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("skip");
      const skipOp = asSkipOperation(result);
      expect(skipOp.count).to.equal(20);
    });

    it("should parse skip(0)", () => {
      const query = () => from<{ id: number }>("users").skip(0);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("skip");
      const skipOp = asSkipOperation(result);
      expect(skipOp.count).to.equal(0);
    });

    it("should parse skip after orderBy", () => {
      const query = () =>
        from<{ id: number; createdAt: Date }>("posts")
          .orderBy((x) => x.createdAt)
          .skip(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("skip");
      const skipOp = asSkipOperation(result);
      expect(skipOp.source.operationType).to.equal("orderBy");
    });

    it("should parse skip before take (pagination pattern)", () => {
      const query = () => from<{ id: number; name: string }>("users").skip(20).take(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      expect(takeOp.count).to.equal(10);
      const skipOp = asSkipOperation(takeOp.source);
      expect(skipOp.operationType).to.equal("skip");
      expect(skipOp.count).to.equal(20);
    });

    it("should parse complex pagination with ordering", () => {
      const query = () =>
        from<{ id: number; name: string; createdAt: Date }>("users")
          .orderBy((x) => x.createdAt)
          .skip(50)
          .take(25);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      expect(takeOp.count).to.equal(25);
      const skipOp = asSkipOperation(takeOp.source);
      expect(skipOp.operationType).to.equal("skip");
      expect(skipOp.count).to.equal(50);
      expect(skipOp.source.operationType).to.equal("orderBy");
    });

    it("should parse skip with external parameter", () => {
      const query = (p: { offset: number }) => from<{ id: number }>("users").skip(p.offset);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("skip");
      const skipOp = asSkipOperation(result);
      const paramRef = skipOp.count as ParamRef;
      expect(paramRef.type).to.equal("param");
      expect(paramRef.param).to.equal("p");
      expect(paramRef.property).to.equal("offset");
    });

    it("should parse pagination with both external parameters", () => {
      const query = (p: { page: number; pageSize: number }) =>
        from<{ id: number }>("users")
          .skip(p.page * p.pageSize)
          .take(p.pageSize);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      const takeParamRef = takeOp.count as ParamRef;
      expect(takeParamRef.type).to.equal("param");
      expect(takeParamRef.property).to.equal("pageSize");

      const skipOp = asSkipOperation(takeOp.source);
      expect(skipOp.operationType).to.equal("skip");
      const arithmeticExpr = skipOp.count as unknown as ArithmeticExpression;
      expect(arithmeticExpr.type).to.equal("arithmetic");
      expect(arithmeticExpr.operator).to.equal("*");
    });
  });

  describe("Complex pagination scenarios", () => {
    it("should parse multiple pagination operations", () => {
      const query = () =>
        from<{ id: number; value: number }>("items")
          .skipWhile((x) => x.value < 10)
          .take(100)
          .skip(20)
          .take(10);
      const result = parseQuery(query);

      // Last take
      expect(result?.operationType).to.equal("take");
      const lastTakeOp = asTakeOperation(result);
      expect(lastTakeOp.count).to.equal(10);

      // Skip before last take
      const skipOp = asSkipOperation(lastTakeOp.source);
      expect(skipOp.operationType).to.equal("skip");
      expect(skipOp.count).to.equal(20);

      // First take
      const firstTakeOp = asTakeOperation(skipOp.source);
      expect(firstTakeOp.operationType).to.equal("take");
      expect(firstTakeOp.count).to.equal(100);

      // SkipWhile at the beginning
      expect(firstTakeOp.source.operationType).to.equal("skipWhile");
    });

    it("should parse pagination with filtering and ordering", () => {
      const query = () =>
        from<{ id: number; category: string; price: number; inStock: boolean }>("products")
          .where((x) => x.inStock)
          .orderByDescending((x) => x.price)
          .skip(10)
          .take(20)
          .select((x) => ({ id: x.id, price: x.price }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const selectOp = asSelectOperation(result);
      const takeOp = asTakeOperation(selectOp.source);
      expect(takeOp.operationType).to.equal("take");
      const skipOp = asSkipOperation(takeOp.source);
      expect(skipOp.operationType).to.equal("skip");
      const orderByOp = asOrderByOperation(skipOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
      expect(orderByOp.source.operationType).to.equal("where");
    });
  });
});
