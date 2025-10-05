/**
 * IN Operator SQL Generation Tests
 * Verifies that array.includes() generates correct IN clause SQL
 */

import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
import { createContext } from "@webpods/tinqer";

interface User {
  id: number;
  name: string;
  role: string;
  age: number;
}

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
}

interface Schema {
  users: User;
  products: Product;
}

const db = createContext<Schema>();

describe("IN Operator", () => {
  describe("Basic IN operations", () => {
    it("should generate SQL for array.includes() with numbers", () => {
      const result = selectStatement(
        db,
        (ctx) => ctx.from("users").where((u) => [1, 2, 3, 4, 5].includes(u.id)),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE "id" IN ($(__p1), $(__p2), $(__p3), $(__p4), $(__p5))',
      );
      expect(result.params).to.deep.equal({
        __p1: 1,
        __p2: 2,
        __p3: 3,
        __p4: 4,
        __p5: 5,
      });
    });

    it("should generate SQL for array.includes() with strings", () => {
      const result = selectStatement(
        db,
        (ctx) => ctx.from("users").where((u) => ["admin", "user", "guest"].includes(u.role)),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE "role" IN ($(__p1), $(__p2), $(__p3))',
      );
      expect(result.params).to.deep.equal({
        __p1: "admin",
        __p2: "user",
        __p3: "guest",
      });
    });

    it("should handle single item array", () => {
      const result = selectStatement(
        db,
        (ctx) => ctx.from("products").where((p) => ["electronics"].includes(p.category)),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "products" WHERE "category" IN ($(__p1))');
      expect(result.params).to.deep.equal({
        __p1: "electronics",
      });
    });

    it("should handle empty array as FALSE", () => {
      const result = selectStatement(
        db,
        (ctx) => ctx.from("users").where((u) => ([] as number[]).includes(u.id)),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE FALSE');
      expect(result.params).to.deep.equal({});
    });
  });

  describe("IN with other conditions", () => {
    it("should combine IN with AND conditions", () => {
      const result = selectStatement(
        db,
        (ctx) => ctx.from("users").where((u) => [1, 2, 3].includes(u.id) && u.age > 18),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("id" IN ($(__p1), $(__p2), $(__p3)) AND "age" > $(__p4))',
      );
      expect(result.params).to.deep.equal({
        __p1: 1,
        __p2: 2,
        __p3: 3,
        __p4: 18,
      });
    });

    it("should combine IN with OR conditions", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("products")
            .where((p) => ["electronics", "computers"].includes(p.category) || p.price < 100),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "products" WHERE ("category" IN ($(__p1), $(__p2)) OR "price" < $(__p3))',
      );
      expect(result.params).to.deep.equal({
        __p1: "electronics",
        __p2: "computers",
        __p3: 100,
      });
    });

    it("should handle multiple IN conditions", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("users")
            .where((u) => [1, 2, 3].includes(u.id) && ["admin", "moderator"].includes(u.role)),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("id" IN ($(__p1), $(__p2), $(__p3)) AND "role" IN ($(__p4), $(__p5)))',
      );
      expect(result.params).to.deep.equal({
        __p1: 1,
        __p2: 2,
        __p3: 3,
        __p4: "admin",
        __p5: "moderator",
      });
    });
  });

  describe("IN with other SQL operations", () => {
    it("should work with SELECT and ORDER BY", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("users")
            .where((u) => ["admin", "moderator"].includes(u.role))
            .select((u) => ({ id: u.id, name: u.name }))
            .orderBy((u) => u.name),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE "role" IN ($(__p1), $(__p2)) ORDER BY "name" ASC',
      );
      expect(result.params).to.deep.equal({
        __p1: "admin",
        __p2: "moderator",
      });
    });

    it("should work with GROUP BY", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("products")
            .where((p) => ["electronics", "computers", "phones"].includes(p.category))
            .groupBy((p) => p.category)
            .select((g) => ({ category: g.key, count: g.count() })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "category" AS "category", COUNT(*) AS "count" FROM "products" WHERE "category" IN ($(__p1), $(__p2), $(__p3)) GROUP BY "category"',
      );
      expect(result.params).to.deep.equal({
        __p1: "electronics",
        __p2: "computers",
        __p3: "phones",
      });
    });

    it("should work with TAKE and SKIP", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("users")
            .where((u) => [1, 2, 3, 4, 5].includes(u.id))
            .orderBy((u) => u.id)
            .skip(10)
            .take(5),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE "id" IN ($(__p1), $(__p2), $(__p3), $(__p4), $(__p5)) ORDER BY "id" ASC LIMIT $(__p7) OFFSET $(__p6)',
      );
      expect(result.params).to.deep.equal({
        __p1: 1,
        __p2: 2,
        __p3: 3,
        __p4: 4,
        __p5: 5,
        __p7: 5,
        __p6: 10,
      });
    });
  });

  describe("NOT IN operations", () => {
    it("should generate NOT IN with negation", () => {
      const result = selectStatement(
        db,
        (ctx) => ctx.from("users").where((u) => ![1, 2, 3].includes(u.id)),
        {},
      );

      expect(result.sql).to.equal(
        `SELECT * FROM "users" WHERE NOT ("id" IN ($(__p1), $(__p2), $(__p3)))`,
      );
      expect(result.params).to.deep.equal({
        __p1: 1,
        __p2: 2,
        __p3: 3,
      });
    });

    it("should handle negated empty array as TRUE", () => {
      const result = selectStatement(
        db,
        (ctx) => ctx.from("users").where((u) => !([] as number[]).includes(u.id)),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE NOT FALSE');
      expect(result.params).to.deep.equal({});
    });
  });
});
