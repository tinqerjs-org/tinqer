/**
 * Tests for simple grouping operations: groupBy
 * Only tests basic SQL GROUP BY functionality
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery } from "../dist/index.js";
import type { QueryBuilder } from "../dist/index.js";
import {
  asGroupByOperation,
  asSelectOperation,
  asOrderByOperation,
  getOperation,
} from "./test-utils/operation-helpers.js";
import { type TestSchema } from "./test-schema.js";

describe("GROUP BY Operation", () => {
  describe("groupBy()", () => {
    it("should parse simple groupBy with column selector", () => {
      const query = (q: QueryBuilder<TestSchema>) => q.from("products").groupBy((x) => x.category);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("groupBy");
      const groupByOp = asGroupByOperation(getOperation(result));
      expect(groupByOp.keySelector).to.deep.equal({ type: "column", name: "category" });
    });

    it("should parse groupBy with different column", () => {
      const query = (q: QueryBuilder<TestSchema>) =>
        q.from("employees").groupBy((x) => x.department);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("groupBy");
      const groupByOp = asGroupByOperation(getOperation(result));
      expect(groupByOp.keySelector).to.deep.equal({ type: "column", name: "department" });
    });

    it("should parse groupBy after where", () => {
      const query = (q: QueryBuilder<TestSchema>) =>
        q
          .from("products")
          .where((x) => x.inStock)
          .groupBy((x) => x.category);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("groupBy");
      const groupByOp = asGroupByOperation(getOperation(result));
      expect(groupByOp.source.operationType).to.equal("where");
    });

    it("should parse groupBy before select", () => {
      const query = (q: QueryBuilder<TestSchema>) =>
        q
          .from("products")
          .groupBy((x) => x.category)
          .select((g) => ({ category: g.key }));
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("select");
      const selectOp = asSelectOperation(getOperation(result));
      expect(selectOp.source.operationType).to.equal("groupBy");
    });

    it("should parse groupBy with ordering", () => {
      const query = (q: QueryBuilder<TestSchema>) =>
        q
          .from("products")
          .groupBy((x) => x.category)
          .orderBy((g) => g.key);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("orderBy");
      const orderByOp = asOrderByOperation(getOperation(result));
      expect(orderByOp.source.operationType).to.equal("groupBy");
    });
  });
});
