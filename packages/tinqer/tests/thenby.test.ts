/**
 * Tests for THEN BY operations
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import {
  asOrderByOperation,
  asThenByOperation,
  getOperation,
} from "./test-utils/operation-helpers.js";
import type { ArithmeticExpression } from "../src/expressions/expression.js";
import { db } from "./test-schema.js";

describe("THEN BY Operations", () => {
  describe("thenBy()", () => {
    it("should parse orderBy followed by thenBy", () => {
      const query = () =>
        from(db, "products")
          .orderBy((x) => x.category)
          .thenBy((x) => x.name);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("thenBy");
      const thenByOp = asThenByOperation(getOperation(result));
      expect(thenByOp.keySelector).to.equal("name");
      expect(thenByOp.descending).to.equal(false);

      const orderByOp = asOrderByOperation(thenByOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
      expect(orderByOp.keySelector).to.equal("category");
    });

    it("should parse multiple thenBy operations", () => {
      const query = () =>
        from(db, "users")
          .orderBy((x) => x.country)
          .thenBy((x) => x.city)
          .thenBy((x) => x.name);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("thenBy");
      const lastThenByOp = asThenByOperation(getOperation(result));
      expect(lastThenByOp.keySelector).to.equal("name");

      const middleThenByOp = asThenByOperation(lastThenByOp.source);
      expect(middleThenByOp.operationType).to.equal("thenBy");
      expect(middleThenByOp.keySelector).to.equal("city");

      const orderByOp = asOrderByOperation(middleThenByOp.source);
      expect(orderByOp.operationType).to.equal("orderBy");
      expect(orderByOp.keySelector).to.equal("country");
    });

    it("should parse thenBy with computed expression", () => {
      const query = () =>
        from(db, "products")
          .orderBy((x) => x.category)
          .thenBy((x) => x.price - x.cost);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("thenBy");
      const thenByOp = asThenByOperation(getOperation(result));
      const arithmeticExpr = thenByOp.keySelector as ArithmeticExpression;
      expect(arithmeticExpr.type).to.equal("arithmetic");
      expect(arithmeticExpr.operator).to.equal("-");
    });
  });

  describe("thenByDescending()", () => {
    it("should parse orderBy followed by thenByDescending", () => {
      const query = () =>
        from(db, "employees")
          .orderBy((x) => x.department)
          .thenByDescending((x) => x.salary);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("thenBy");
      const thenByOp = asThenByOperation(getOperation(result));
      expect(thenByOp.keySelector).to.equal("salary");
      expect(thenByOp.descending).to.equal(true);
    });

    it("should parse mixed thenBy and thenByDescending", () => {
      const query = () =>
        from(db, "products")
          .orderBy((x) => x.category)
          .thenByDescending((x) => x.price)
          .thenBy((x) => x.cost);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("thenBy");
      const finalThenByOp = asThenByOperation(getOperation(result));
      expect(finalThenByOp.descending).to.equal(false);

      const thenByDescOp = asThenByOperation(finalThenByOp.source);
      expect(thenByDescOp.operationType).to.equal("thenBy");
      expect(thenByDescOp.descending).to.equal(true);
    });
  });
});
