/**
 * Tests for simple grouping operations: groupBy
 * Only tests basic SQL GROUP BY functionality
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";

describe("Simple Grouping Operations", () => {
  describe("groupBy()", () => {
    it("should parse simple groupBy with column selector", () => {
      const query = () =>
        from<{ id: number; category: string; price: number }>("products").groupBy(
          (x) => x.category,
        );
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("groupBy");
      expect((result as any).keySelector).to.equal("category");
    });

    it("should parse groupBy with different column", () => {
      const query = () =>
        from<{ id: number; department: string; salary: number }>("employees").groupBy(
          (x) => x.department,
        );
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("groupBy");
      expect((result as any).keySelector).to.equal("department");
    });

    it("should parse groupBy after where", () => {
      const query = () =>
        from<{ id: number; category: string; price: number; inStock: boolean }>("products")
          .where((x) => x.inStock)
          .groupBy((x) => x.category);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("groupBy");
      const source = (result as any).source;
      expect(source.operationType).to.equal("where");
    });

    it("should parse groupBy before select", () => {
      const query = () =>
        from<{ category: string; price: number }>("products")
          .groupBy((x) => x.category)
          .select((g) => ({ category: g.key }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const source = (result as any).source;
      expect(source.operationType).to.equal("groupBy");
    });

    it("should parse groupBy with ordering", () => {
      const query = () =>
        from<{ category: string; price: number }>("products")
          .groupBy((x) => x.category)
          .orderBy((g) => g.key);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      const source = (result as any).source;
      expect(source.operationType).to.equal("groupBy");
    });
  });
});
