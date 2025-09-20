/**
 * Tests for ordering operations: orderBy, orderByDescending, thenBy, thenByDescending
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import {
  asOrderByOperation,
  asThenByOperation,
  asTakeOperation,
  asSelectOperation,
} from "./test-utils/operation-helpers.js";
import type { ConcatExpression, ArithmeticExpression } from "../src/expressions/expression.js";

describe("Ordering Operations", () => {
  describe("orderBy()", () => {
    it("should parse orderBy with simple property", () => {
      const query = () => from<{ id: number; name: string }>("users").orderBy((x) => x.name);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(result);
      expect(orderByOp.keySelector).to.equal("name");
      expect(orderByOp.descending).to.equal(false);
    });

    it("should parse orderBy with numeric property", () => {
      const query = () => from<{ id: number; age: number }>("users").orderBy((x) => x.age);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(result);
      expect(orderByOp.keySelector).to.equal("age");
      expect(orderByOp.descending).to.equal(false);
    });

    it("should parse orderBy after where", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users")
          .where((x) => x.age >= 18)
          .orderBy((x) => x.name);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(result);
      expect(orderByOp.source.operationType).to.equal("where");
    });

    it("should parse orderBy before select", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users")
          .orderBy((x) => x.age)
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const selectOp = asSelectOperation(result);
      expect(selectOp.source.operationType).to.equal("orderBy");
    });

    it("should parse orderBy with computed expression", () => {
      const query = () =>
        from<{ firstName: string; lastName: string }>("users").orderBy(
          (x) => x.firstName + x.lastName,
        );
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(result);
      const concatExpr = orderByOp.keySelector as ConcatExpression;
      expect(concatExpr.type).to.equal("concat");
    });
  });

  describe("orderByDescending()", () => {
    it("should parse orderByDescending with simple property", () => {
      const query = () =>
        from<{ id: number; createdAt: Date }>("posts").orderByDescending((x) => x.createdAt);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(result);
      expect(orderByOp.keySelector).to.equal("createdAt");
      expect(orderByOp.descending).to.equal(true);
    });

    it("should parse orderByDescending with numeric property", () => {
      const query = () =>
        from<{ id: number; salary: number }>("employees").orderByDescending((x) => x.salary);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(result);
      expect(orderByOp.keySelector).to.equal("salary");
      expect(orderByOp.descending).to.equal(true);
    });
  });

  describe("thenBy()", () => {
    it("should parse orderBy followed by thenBy", () => {
      const query = () =>
        from<{ id: number; category: string; name: string }>("products")
          .orderBy((x) => x.category)
          .thenBy((x) => x.name);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("thenBy");
      const thenByOp = asThenByOperation(result);
      expect(thenByOp.keySelector).to.equal("name");
      expect(thenByOp.descending).to.equal(false);

      const orderByOp = asOrderByOperation(thenByOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
      expect(orderByOp.keySelector).to.equal("category");
    });

    it("should parse multiple thenBy operations", () => {
      const query = () =>
        from<{ country: string; city: string; street: string }>("addresses")
          .orderBy((x) => x.country)
          .thenBy((x) => x.city)
          .thenBy((x) => x.street);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("thenBy");
      const lastThenByOp = asThenByOperation(result);
      expect(lastThenByOp.keySelector).to.equal("street");

      const middleThenByOp = asThenByOperation(lastThenByOp.source);
      expect(middleThenByOp.operationType).to.equal("thenBy");
      expect(middleThenByOp.keySelector).to.equal("city");

      const orderByOp = asOrderByOperation(middleThenByOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
      expect(orderByOp.keySelector).to.equal("country");
    });

    it("should parse thenBy with computed expression", () => {
      const query = () =>
        from<{ category: string; price: number; discount: number }>("products")
          .orderBy((x) => x.category)
          .thenBy((x) => x.price - x.discount);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("thenBy");
      const thenByOp = asThenByOperation(result);
      const arithmeticExpr = thenByOp.keySelector as ArithmeticExpression;
      expect(arithmeticExpr.type).to.equal("arithmetic");
      expect(arithmeticExpr.operator).to.equal("-");
    });
  });

  describe("thenByDescending()", () => {
    it("should parse orderBy followed by thenByDescending", () => {
      const query = () =>
        from<{ department: string; salary: number }>("employees")
          .orderBy((x) => x.department)
          .thenByDescending((x) => x.salary);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("thenBy");
      const thenByOp = asThenByOperation(result);
      expect(thenByOp.keySelector).to.equal("salary");
      expect(thenByOp.descending).to.equal(true);
    });

    it("should parse mixed thenBy and thenByDescending", () => {
      const query = () =>
        from<{ category: string; rating: number; price: number }>("products")
          .orderBy((x) => x.category)
          .thenByDescending((x) => x.rating)
          .thenBy((x) => x.price);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("thenBy");
      const finalThenByOp = asThenByOperation(result);
      expect(finalThenByOp.descending).to.equal(false);

      const thenByDescOp = asThenByOperation(finalThenByOp.source);
      expect(thenByDescOp.operationType).to.equal("thenBy");
      expect(thenByDescOp.descending).to.equal(true);
    });
  });

  describe("Complex ordering scenarios", () => {
    it("should parse ordering with where and select", () => {
      const query = () =>
        from<{ id: number; name: string; age: number; isActive: boolean }>("users")
          .where((x) => x.isActive)
          .orderBy((x) => x.age)
          .thenBy((x) => x.name)
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const selectOp = asSelectOperation(result);
      const thenByOp = asThenByOperation(selectOp.source);
      expect(thenByOp.operationType).to.equal("thenBy");
      const orderByOp = asOrderByOperation(thenByOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
      expect(orderByOp.source.operationType).to.equal("where");
    });

    it("should parse ordering with external parameters", () => {
      const query = (p: { sortField: string }) =>
        from<{ id: number; name: string; age: number }>("users").orderBy(
          (x) => x[p.sortField as keyof typeof x],
        );
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      // Note: Dynamic field access might be parsed differently
    });

    it("should parse ordering with take", () => {
      const query = () =>
        from<{ id: number; score: number }>("scores")
          .orderByDescending((x) => x.score)
          .take(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeOp = asTakeOperation(result);
      expect(takeOp.count).to.equal(10);
      const orderByOp = asOrderByOperation(takeOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
      expect(orderByOp.descending).to.equal(true);
    });
  });
});
