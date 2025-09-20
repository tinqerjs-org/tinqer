/**
 * Tests for SKIP and SKIP WHILE operations
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import {
  asSkipOperation,
  asOrderByOperation,
  asTakeOperation,
} from "./test-utils/operation-helpers.js";
import type { ParamRef } from "../src/query-tree/operations.js";
import type { ArithmeticExpression } from "../src/expressions/expression.js";

describe("SKIP Operations", () => {
  describe("skip()", () => {
    it("should parse skip with constant number", () => {
      const query = () => from<{ id: number }>("users").skip(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("skip");
      const skipOp = asSkipOperation(result);
      expect(skipOp.count).to.equal(10);
    });

    it("should parse skip(0)", () => {
      const query = () => from<{ id: number }>("users").skip(0);
      const result = parseQuery(query);

      const skipOp = asSkipOperation(result);
      expect(skipOp.count).to.equal(0);
    });

    it("should parse skip after orderBy", () => {
      const query = () =>
        from<{ id: number; name: string }>("users")
          .orderBy((x) => x.name)
          .skip(20);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("skip");
      const skipOp = asSkipOperation(result);
      expect(skipOp.count).to.equal(20);
      const orderByOp = asOrderByOperation(skipOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
    });

    it("should parse skip before take (pagination pattern)", () => {
      const query = () => from<{ id: number }>("users").skip(20).take(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      expect(takeOp.count).to.equal(10);
      const skipOp = asSkipOperation(takeOp.source);
      expect(skipOp.operationType).to.equal("skip");
      expect(skipOp.count).to.equal(20);
    });

    it("should parse skip with external parameter", () => {
      const query = (p: { offset: number }) => from<{ id: number }>("users").skip(p.offset);
      const result = parseQuery(query);

      const skipOp = asSkipOperation(result);
      const paramRef = skipOp.count as ParamRef;
      expect(paramRef.type).to.equal("param");
      expect(paramRef.param).to.equal("p");
      expect(paramRef.property).to.equal("offset");
    });

    it("should parse skip with arithmetic expression", () => {
      const query = (p: { page: number; pageSize: number }) =>
        from<{ id: number }>("users").skip((p.page - 1) * p.pageSize);
      const result = parseQuery(query);

      const skipOp = asSkipOperation(result);
      const arithmeticExpr = skipOp.count as unknown as ArithmeticExpression;
      expect(arithmeticExpr.type).to.equal("arithmetic");
      expect(arithmeticExpr.operator).to.equal("*");
    });

    it("should parse complex pagination with ordering", () => {
      const query = () =>
        from<{ id: number; createdAt: Date }>("posts")
          .orderBy((x) => x.createdAt)
          .skip(10)
          .take(25);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      expect(takeOp.count).to.equal(25);
      const skipOp = asSkipOperation(takeOp.source);
      expect(skipOp.operationType).to.equal("skip");
      expect(skipOp.count).to.equal(10);
      expect(skipOp.source.operationType).to.equal("orderBy");
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
});
