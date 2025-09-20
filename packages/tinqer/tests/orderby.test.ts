/**
 * Tests for ORDER BY operations
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import {
  asOrderByOperation,
  asSelectOperation,
  asWhereOperation,
  asTakeOperation,
} from "./test-utils/operation-helpers.js";
import type { ConcatExpression } from "../src/expressions/expression.js";

describe("ORDER BY Operations", () => {
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
