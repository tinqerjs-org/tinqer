/**
 * Tests for SKIP and SKIP WHILE operations
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery } from "../dist/index.js";
import type { QueryDSL } from "../dist/index.js";
import {
  asSkipOperation,
  asOrderByOperation,
  asTakeOperation,
  getOperation,
} from "./test-utils/operation-helpers.js";
import type { ParamRef } from "../dist/query-tree/operations.js";
import type { ArithmeticExpression } from "../dist/expressions/expression.js";
import { type TestSchema } from "./test-schema.js";

describe("SKIP Operations", () => {
  describe("skip()", () => {
    it("should parse skip with constant number", () => {
      const query = (ctx: QueryDSL<TestSchema>) => ctx.from("users").skip(10);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("skip");
      const skipOp = asSkipOperation(getOperation(result));
      const countParam = skipOp.count as ParamRef;
      expect(countParam.type).to.equal("param");
      expect(countParam.param).to.equal("__p1");
      expect(result?.autoParams).to.deep.equal({ __p1: 10 });
    });

    it("should parse skip(0)", () => {
      const query = (ctx: QueryDSL<TestSchema>) => ctx.from("users").skip(0);
      const result = parseQuery(query);

      const skipOp = asSkipOperation(getOperation(result));
      const countParam = skipOp.count as ParamRef;
      expect(countParam.type).to.equal("param");
      expect(countParam.param).to.equal("__p1");
      expect(result?.autoParams).to.deep.equal({ __p1: 0 });
    });

    it("should parse skip after orderBy", () => {
      const query = (ctx: QueryDSL<TestSchema>) =>
        ctx
          .from("users")
          .orderBy((x) => x.name)
          .skip(20);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("skip");
      const skipOp = asSkipOperation(getOperation(result));
      const countParam = skipOp.count as ParamRef;
      expect(countParam.type).to.equal("param");
      expect(countParam.param).to.equal("__p1");
      expect(result?.autoParams).to.deep.equal({ __p1: 20 });
      const orderByOp = asOrderByOperation(skipOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
    });

    it("should parse skip before take (pagination pattern)", () => {
      const query = (ctx: QueryDSL<TestSchema>) => ctx.from("users").skip(20).take(10);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("take");
      const takeOp = asTakeOperation(getOperation(result));
      const takeParam = takeOp.count as ParamRef;
      expect(takeParam.type).to.equal("param");
      expect(takeParam.param).to.equal("__p2");
      const skipOp = asSkipOperation(takeOp.source);
      expect(skipOp.operationType).to.equal("skip");
      const skipParam = skipOp.count as ParamRef;
      expect(skipParam.type).to.equal("param");
      expect(skipParam.param).to.equal("__p1");
      expect(result?.autoParams).to.deep.equal({ __p1: 20, __p2: 10 });
    });

    it("should parse skip with external parameter", () => {
      const query = (ctx: QueryDSL<TestSchema>, p: { offset: number }) =>
        ctx.from("users").skip(p.offset);
      const result = parseQuery(query);

      const skipOp = asSkipOperation(getOperation(result));
      const paramRef = skipOp.count as ParamRef;
      expect(paramRef.type).to.equal("param");
      expect(paramRef.param).to.equal("p");
      expect(paramRef.property).to.equal("offset");
    });

    it("should parse skip with arithmetic expression", () => {
      const query = (ctx: QueryDSL<TestSchema>, p: { page: number; pageSize: number }) =>
        ctx.from("users").skip((p.page - 1) * p.pageSize);
      const result = parseQuery(query);

      const skipOp = asSkipOperation(getOperation(result));
      const arithmeticExpr = skipOp.count as unknown as ArithmeticExpression;
      expect(arithmeticExpr.type).to.equal("arithmetic");
      expect(arithmeticExpr.operator).to.equal("*");
    });

    it("should parse complex pagination with ordering", () => {
      const query = (ctx: QueryDSL<TestSchema>) =>
        ctx
          .from("users")
          .orderBy((x) => x.createdAt)
          .skip(10)
          .take(25);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("take");
      const takeOp = asTakeOperation(getOperation(result));
      const takeParam = takeOp.count as ParamRef;
      expect(takeParam.type).to.equal("param");
      expect(takeParam.param).to.equal("__p2");
      const skipOp = asSkipOperation(takeOp.source);
      expect(skipOp.operationType).to.equal("skip");
      const skipParam = skipOp.count as ParamRef;
      expect(skipParam.type).to.equal("param");
      expect(skipParam.param).to.equal("__p1");
      expect(skipOp.source.operationType).to.equal("orderBy");
      expect(result?.autoParams).to.deep.equal({ __p1: 10, __p2: 25 });
    });

    it("should parse pagination with both external parameters", () => {
      const query = (ctx: QueryDSL<TestSchema>, p: { page: number; pageSize: number }) =>
        ctx
          .from("users")
          .skip(p.page * p.pageSize)
          .take(p.pageSize);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("take");
      const takeOp = asTakeOperation(getOperation(result));
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
