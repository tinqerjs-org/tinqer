/**
 * Tests for THEN BY operations
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import {
  asOrderByOperation,
  asThenByOperation,
  asSelectOperation,
  asWhereOperation,
} from "./test-utils/operation-helpers.js";
import type { ArithmeticExpression } from "../src/expressions/expression.js";

describe("THEN BY Operations", () => {
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
});
