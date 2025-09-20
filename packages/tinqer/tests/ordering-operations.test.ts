/**
 * Tests for ordering operations: orderBy, orderByDescending, thenBy, thenByDescending
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";

describe("Ordering Operations", () => {
  describe("orderBy()", () => {
    it("should parse orderBy with simple property", () => {
      const query = () => from<{ id: number; name: string }>("users").orderBy((x) => x.name);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      expect((result as any).keySelector).to.equal("name");
      expect((result as any).descending).to.equal(false);
    });

    it("should parse orderBy with numeric property", () => {
      const query = () => from<{ id: number; age: number }>("users").orderBy((x) => x.age);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      expect((result as any).keySelector).to.equal("age");
      expect((result as any).descending).to.equal(false);
    });

    it("should parse orderBy after where", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users")
          .where((x) => x.age >= 18)
          .orderBy((x) => x.name);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      const source = (result as any).source;
      expect(source.operationType).to.equal("where");
    });

    it("should parse orderBy before select", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users")
          .orderBy((x) => x.age)
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const source = (result as any).source;
      expect(source.operationType).to.equal("orderBy");
    });

    it("should parse orderBy with computed expression", () => {
      const query = () =>
        from<{ firstName: string; lastName: string }>("users").orderBy(
          (x) => x.firstName + x.lastName,
        );
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      const keySelector = (result as any).keySelector;
      expect(keySelector.type).to.equal("concat");
    });
  });

  describe("orderByDescending()", () => {
    it("should parse orderByDescending with simple property", () => {
      const query = () =>
        from<{ id: number; createdAt: Date }>("posts").orderByDescending((x) => x.createdAt);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      expect((result as any).keySelector).to.equal("createdAt");
      expect((result as any).descending).to.equal(true);
    });

    it("should parse orderByDescending with numeric property", () => {
      const query = () =>
        from<{ id: number; salary: number }>("employees").orderByDescending((x) => x.salary);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("orderBy");
      expect((result as any).keySelector).to.equal("salary");
      expect((result as any).descending).to.equal(true);
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
      expect((result as any).keySelector).to.equal("name");
      expect((result as any).descending).to.equal(false);

      const source = (result as any).source;
      expect(source.operationType).to.equal("orderBy");
      expect(source.keySelector).to.equal("category");
    });

    it("should parse multiple thenBy operations", () => {
      const query = () =>
        from<{ country: string; city: string; street: string }>("addresses")
          .orderBy((x) => x.country)
          .thenBy((x) => x.city)
          .thenBy((x) => x.street);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("thenBy");
      expect((result as any).keySelector).to.equal("street");

      const thenBy1 = (result as any).source;
      expect(thenBy1.operationType).to.equal("thenBy");
      expect(thenBy1.keySelector).to.equal("city");

      const orderBy = thenBy1.source;
      expect(orderBy.operationType).to.equal("orderBy");
      expect(orderBy.keySelector).to.equal("country");
    });

    it("should parse thenBy with computed expression", () => {
      const query = () =>
        from<{ category: string; price: number; discount: number }>("products")
          .orderBy((x) => x.category)
          .thenBy((x) => x.price - x.discount);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("thenBy");
      const keySelector = (result as any).keySelector;
      expect(keySelector.type).to.equal("arithmetic");
      expect(keySelector.operator).to.equal("-");
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
      expect((result as any).keySelector).to.equal("salary");
      expect((result as any).descending).to.equal(true);
    });

    it("should parse mixed thenBy and thenByDescending", () => {
      const query = () =>
        from<{ category: string; rating: number; price: number }>("products")
          .orderBy((x) => x.category)
          .thenByDescending((x) => x.rating)
          .thenBy((x) => x.price);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("thenBy");
      expect((result as any).descending).to.equal(false);

      const thenByDesc = (result as any).source;
      expect(thenByDesc.operationType).to.equal("thenBy");
      expect(thenByDesc.descending).to.equal(true);
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
      const thenBy = (result as any).source;
      expect(thenBy.operationType).to.equal("thenBy");
      const orderBy = thenBy.source;
      expect(orderBy.operationType).to.equal("orderBy");
      const where = orderBy.source;
      expect(where.operationType).to.equal("where");
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
      expect((result as any).count).to.equal(10);
      const orderBy = (result as any).source;
      expect(orderBy.operationType).to.equal("orderBy");
      expect(orderBy.descending).to.equal(true);
    });
  });
});
