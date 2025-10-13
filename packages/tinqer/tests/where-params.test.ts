/**
 * Additional WHERE predicate coverage for parameter-only logic and undefined comparisons
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery } from "../dist/index.js";
import type { QueryBuilder } from "../dist/index.js";
import { expr } from "./test-utils/expr-helpers.js";
import {
  asOrderByOperation,
  asTakeOperation,
  asWhereOperation,
  getOperation,
} from "./test-utils/operation-helpers.js";
import type { ComparisonExpression, LogicalExpression } from "../dist/expressions/expression.js";
import { type TestSchema } from "./test-schema.js";

describe("WHERE Operation - parameter-focused predicates", () => {
  describe("parameter-only comparisons", () => {
    it("should parse parameter to literal comparison when no table columns are referenced", () => {
      const query = (q: QueryBuilder<TestSchema>, p: { minAge: number }) =>
        q.from("users").where((_user) => p.minAge > 10);

      const result = parseQuery(query);
      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as ComparisonExpression;

      expect(predicate).to.deep.equal(
        expr.gt(expr.parameter("p", "minAge"), expr.parameter("__p1")),
      );
      expect(result?.autoParams).to.deep.equal({ __p1: 10 });
    });

    it("should parse literal to parameter comparison without any column usage", () => {
      const query = (q: QueryBuilder<TestSchema>, p: { maxAge: number }) =>
        q.from("users").where((_user) => 25 < p.maxAge);

      const result = parseQuery(query);
      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as ComparisonExpression;

      expect(predicate).to.deep.equal(
        expr.lt(expr.parameter("__p1"), expr.parameter("p", "maxAge")),
      );
      expect(result?.autoParams).to.deep.equal({ __p1: 25 });
    });

    it("should parse parameter-to-parameter comparison", () => {
      const query = (q: QueryBuilder<TestSchema>, p: { minAge: number; maxAge: number }) =>
        q.from("users").where((_user) => p.minAge < p.maxAge);

      const result = parseQuery(query);
      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as ComparisonExpression;

      expect(predicate).to.deep.equal(
        expr.lt(expr.parameter("p", "minAge"), expr.parameter("p", "maxAge")),
      );
      expect(result?.autoParams).to.deep.equal({});
    });
  });

  describe("mixed predicates", () => {
    it("should allow parameter-only guard combined with column predicate", () => {
      const query = (q: QueryBuilder<TestSchema>, p: { limit: number }) =>
        q.from("users").where((user) => p.limit > 0 && user.age <= p.limit);

      const result = parseQuery(query);
      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as LogicalExpression;

      expect(predicate.left).to.deep.equal(
        expr.gt(expr.parameter("p", "limit"), expr.parameter("__p1")),
      );
      const right = predicate.right as ComparisonExpression;
      expect(right).to.deep.equal(expr.lte(expr.column("age"), expr.parameter("p", "limit")));
      expect(result?.autoParams).to.deep.equal({ __p1: 0 });
    });
  });

  describe("undefined comparisons", () => {
    it("should parse parameter equality against undefined", () => {
      const query = (q: QueryBuilder<TestSchema>, p: { role?: string }) =>
        q.from("users").where((_user) => p.role === undefined);

      const result = parseQuery(query);
      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as ComparisonExpression;

      expect(predicate).to.deep.equal(
        expr.eq(expr.parameter("p", "role"), expr.constant(undefined)),
      );
      expect(result?.autoParams).to.deep.equal({});
    });

    it("should parse parameter inequality against undefined", () => {
      const query = (q: QueryBuilder<TestSchema>, p: { role?: string }) =>
        q.from("users").where((_user) => p.role !== undefined);

      const result = parseQuery(query);
      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as ComparisonExpression;

      expect(predicate).to.deep.equal(
        expr.ne(expr.parameter("p", "role"), expr.constant(undefined)),
      );
      expect(result?.autoParams).to.deep.equal({});
    });

    it("should parse column equality guard that checks for undefined", () => {
      const query = (q: QueryBuilder<TestSchema>, p: { email?: string }) =>
        q.from("users").where((user) => user.email === undefined || user.email === p.email);

      const result = parseQuery(query);
      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as LogicalExpression;

      const left = predicate.left as ComparisonExpression;
      expect(left).to.deep.equal(expr.eq(expr.column("email"), expr.constant(undefined)));
      const right = predicate.right as ComparisonExpression;
      expect(right).to.deep.equal(expr.eq(expr.column("email"), expr.parameter("p", "email")));
      expect(result?.autoParams).to.deep.equal({});
    });

    it("should support query pattern with chained undefined guards", () => {
      const query = (
        q: QueryBuilder<TestSchema>,
        p: {
          userId: number;
          role?: string;
          city?: string;
          minCreated?: Date;
          limit: number;
        },
      ) =>
        q
          .from("users")
          .where(
            (user) =>
              user.id === p.userId &&
              (p.role === undefined || user.role === p.role) &&
              (p.city === undefined || user.city === p.city) &&
              (p.minCreated === undefined || user.createdAt > p.minCreated),
          )
          .orderByDescending((user) => user.createdAt)
          .take(p.limit);

      const result = parseQuery(query);
      const takeOp = asTakeOperation(getOperation(result));
      const orderByOp = asOrderByOperation(takeOp.source);
      const whereOp = asWhereOperation(orderByOp.source);
      const predicate = whereOp.predicate as LogicalExpression;

      expect(predicate.type).to.equal("logical");
      expect(result?.autoParams).to.deep.equal({});
    });
  });
});
