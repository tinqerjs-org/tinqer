/**
 * Tests for pagination operations: take, skip, takeWhile, skipWhile
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";

describe("Pagination Operations", () => {
  describe("take()", () => {
    it("should parse take with constant number", () => {
      const query = () => from<{ id: number; name: string }>("users").take(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      expect((result as any).count).to.equal(10);
    });

    it("should parse take(0)", () => {
      const query = () => from<{ id: number }>("users").take(0);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      expect((result as any).count).to.equal(0);
    });

    it("should parse take with large number", () => {
      const query = () => from<{ id: number }>("users").take(1000000);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      expect((result as any).count).to.equal(1000000);
    });

    it("should parse take after where", () => {
      const query = () =>
        from<{ id: number; isActive: boolean }>("users")
          .where((x) => x.isActive)
          .take(5);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      expect((result as any).count).to.equal(5);
      const source = (result as any).source;
      expect(source.operationType).to.equal("where");
    });

    it("should parse take after orderBy", () => {
      const query = () =>
        from<{ id: number; score: number }>("scores")
          .orderByDescending((x) => x.score)
          .take(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const source = (result as any).source;
      expect(source.operationType).to.equal("orderBy");
      expect(source.descending).to.equal(true);
    });

    it("should parse take before select", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users")
          .take(10)
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const source = (result as any).source;
      expect(source.operationType).to.equal("take");
    });

    it("should parse take with external parameter", () => {
      const query = (p: { limit: number }) => from<{ id: number }>("users").take(p.limit);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const count = (result as any).count;
      expect(count.type).to.equal("param");
      expect(count.param).to.equal("p");
      expect(count.property).to.equal("limit");
    });
  });

  describe("skip()", () => {
    it("should parse skip with constant number", () => {
      const query = () => from<{ id: number; name: string }>("users").skip(20);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("skip");
      expect((result as any).count).to.equal(20);
    });

    it("should parse skip(0)", () => {
      const query = () => from<{ id: number }>("users").skip(0);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("skip");
      expect((result as any).count).to.equal(0);
    });

    it("should parse skip after orderBy", () => {
      const query = () =>
        from<{ id: number; createdAt: Date }>("posts")
          .orderBy((x) => x.createdAt)
          .skip(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("skip");
      const source = (result as any).source;
      expect(source.operationType).to.equal("orderBy");
    });

    it("should parse skip before take (pagination pattern)", () => {
      const query = () => from<{ id: number; name: string }>("users").skip(20).take(10);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      expect((result as any).count).to.equal(10);
      const source = (result as any).source;
      expect(source.operationType).to.equal("skip");
      expect(source.count).to.equal(20);
    });

    it("should parse complex pagination with ordering", () => {
      const query = () =>
        from<{ id: number; name: string; createdAt: Date }>("users")
          .orderBy((x) => x.createdAt)
          .skip(50)
          .take(25);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      expect((result as any).count).to.equal(25);
      const skip = (result as any).source;
      expect(skip.operationType).to.equal("skip");
      expect(skip.count).to.equal(50);
      const orderBy = skip.source;
      expect(orderBy.operationType).to.equal("orderBy");
    });

    it("should parse skip with external parameter", () => {
      const query = (p: { offset: number }) => from<{ id: number }>("users").skip(p.offset);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("skip");
      const count = (result as any).count;
      expect(count.type).to.equal("param");
      expect(count.param).to.equal("p");
      expect(count.property).to.equal("offset");
    });

    it("should parse pagination with both external parameters", () => {
      const query = (p: { page: number; pageSize: number }) =>
        from<{ id: number }>("users")
          .skip(p.page * p.pageSize)
          .take(p.pageSize);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("take");
      const takeCount = (result as any).count;
      expect(takeCount.type).to.equal("param");
      expect(takeCount.property).to.equal("pageSize");

      const skip = (result as any).source;
      expect(skip.operationType).to.equal("skip");
      const skipCount = skip.count;
      expect(skipCount.type).to.equal("arithmetic");
      expect(skipCount.operator).to.equal("*");
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
      expect((result as any).count).to.equal(10);

      // Skip before last take
      const skip = (result as any).source;
      expect(skip.operationType).to.equal("skip");
      expect(skip.count).to.equal(20);

      // First take
      const take1 = skip.source;
      expect(take1.operationType).to.equal("take");
      expect(take1.count).to.equal(100);

      // SkipWhile at the beginning
      const skipWhile = take1.source;
      expect(skipWhile.operationType).to.equal("skipWhile");
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
      const take = (result as any).source;
      expect(take.operationType).to.equal("take");
      const skip = take.source;
      expect(skip.operationType).to.equal("skip");
      const orderBy = skip.source;
      expect(orderBy.operationType).to.equal("orderBy");
      const where = orderBy.source;
      expect(where.operationType).to.equal("where");
    });
  });
});
