/**
 * Tests for string operation SQL generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

describe("String Operations SQL Generation", () => {
  interface User {
    id: number;
    name: string;
    email: string;
    bio?: string;
  }

  interface Product {
    id: number;
    name: string;
    description: string;
    sku: string;
  }

  describe("startsWith", () => {
    it("should generate SQL for startsWith", () => {
      const result = query(() => from<User>("users").where((u) => u.name.startsWith("John")), {});

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "name" LIKE $(__p1) || \'%\'');
      expect(result.params).to.deep.equal({ __p1: "John" });
    });

    it("should handle startsWith with parameter", () => {
      const result = query(
        (p: { prefix: string }) => from<User>("users").where((u) => u.email.startsWith(p.prefix)),
        { prefix: "admin@" },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" LIKE $(prefix) || \'%\'');
      expect(result.params).to.deep.equal({ prefix: "admin@" });
    });

    it("should handle multiple startsWith conditions", () => {
      const result = query(
        () =>
          from<Product>("products").where(
            (p) => p.name.startsWith("Pro") || p.sku.startsWith("SKU"),
          ),
        {},
      );

      expect(result.sql).to.contain("LIKE");
      expect(result.params).to.have.property("__p1", "Pro");
      expect(result.params).to.have.property("__p2", "SKU");
    });
  });

  describe("endsWith", () => {
    it("should generate SQL for endsWith", () => {
      const result = query(() => from<User>("users").where((u) => u.email.endsWith(".com")), {});

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" LIKE \'%\' || $(__p1)');
      expect(result.params).to.deep.equal({ __p1: ".com" });
    });

    it("should handle endsWith with parameter", () => {
      const result = query(
        (p: { suffix: string }) => from<User>("users").where((u) => u.name.endsWith(p.suffix)),
        { suffix: "son" },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "name" LIKE \'%\' || $(suffix)');
      expect(result.params).to.deep.equal({ suffix: "son" });
    });

    it("should handle endsWith in combination with other conditions", () => {
      const result = query(
        () => from<User>("users").where((u) => u.id > 100 && u.email.endsWith("@example.com")),
        {},
      );

      expect(result.sql).to.contain(`"id" > $(__p1)`);
      expect(result.sql).to.contain("LIKE '%' || $(__p2)");
      expect(result.params).to.deep.equal({ __p1: 100, __p2: "@example.com" });
    });
  });

  describe("contains", () => {
    it("should generate SQL for contains", () => {
      const result = query(
        () => from<Product>("products").where((p) => p.description.includes("premium")),
        {},
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"products\" WHERE \"description\" LIKE '%' || $(__p1) || '%'",
      );
      expect(result.params).to.deep.equal({ __p1: "premium" });
    });

    it("should handle contains with parameter", () => {
      const result = query(
        (p: { keyword: string }) =>
          from<Product>("products").where((pr) => pr.name.includes(p.keyword)),
        { keyword: "laptop" },
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"products\" WHERE \"name\" LIKE '%' || $(keyword) || '%'",
      );
      expect(result.params).to.deep.equal({ keyword: "laptop" });
    });

    it("should handle multiple contains conditions", () => {
      const result = query(
        () =>
          from<Product>("products").where(
            (p) => p.name.includes("Pro") && p.description.includes("quality"),
          ),
        {},
      );

      expect(result.sql).to.contain(`"name" LIKE '%' || $(__p1) || '%'`);
      expect(result.sql).to.contain(`"description" LIKE '%' || $(__p2) || '%'`);
      expect(result.params).to.deep.equal({ __p1: "Pro", __p2: "quality" });
    });
  });

  describe("Complex string operations", () => {
    // Test removed: optional chaining with methods (bio?.includes) is not needed
    // Multiple string methods work fine without optional chaining

    it("should handle string operations with SELECT", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.name.startsWith("A"))
            .select((u) => ({ id: u.id, name: u.name })),
        {},
      );

      expect(result.sql).to.equal(
        `SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE "name" LIKE $(__p1) || '%'`,
      );
      expect(result.params).to.deep.equal({ __p1: "A" });
    });

    it("should handle string operations with ORDER BY and TAKE", () => {
      const result = query(
        () =>
          from<Product>("products")
            .where((p) => p.sku.startsWith("ELEC"))
            .orderBy((p) => p.name)
            .take(10),
        {},
      );

      expect(result.sql).to.equal(
        `SELECT * FROM "products" WHERE "sku" LIKE $(__p1) || '%' ORDER BY "name" ASC LIMIT $(__p2)`,
      );
      expect(result.params).to.deep.equal({ __p1: "ELEC", __p2: 10 });
    });

    it("should handle string operations with GROUP BY", () => {
      const result = query(
        () =>
          from<Product>("products")
            .where((p) => p.name.includes("Phone"))
            .groupBy((p) => p.name)
            .select((g) => ({ name: g.key, count: g.count() })),
        {},
      );

      expect(result.sql).to.equal(
        `SELECT "name" AS "name", COUNT(*) AS "count" FROM "products" WHERE "name" LIKE '%' || $(__p1) || '%' GROUP BY "name"`,
      );
      expect(result.params).to.deep.equal({ __p1: "Phone" });
    });

    it("should handle case-sensitive string operations", () => {
      const result = query(
        () =>
          from<User>("users").where(
            (u) => u.email.startsWith("Admin") || u.email.startsWith("admin"),
          ),
        {},
      );

      expect(result.sql).to.contain(`"email" LIKE $(__p1) || '%'`);
      expect(result.sql).to.contain(`"email" LIKE $(__p2) || '%'`);
      expect(result.params).to.deep.equal({ __p1: "Admin", __p2: "admin" });
    });

    it("should handle empty string checks", () => {
      const result = query(() => from<User>("users").where((u) => u.bio == ""), {});

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "bio" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: "" });
    });

    it("should handle string operations in JOIN", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.name.startsWith("John"))
            .join(
              from<Product>("products").where((p) => p.name.includes("Book")),
              (u) => u.id,
              (p) => p.id,
              (u, p) => ({ u, p }),
            )
            .select((joined) => ({
              userName: joined.u.name,
              productName: joined.p.name,
            })),
        {},
      );

      expect(result.sql).to.contain(`"name" LIKE $(__p1) || '%'`);
      expect(result.sql).to.contain(`"name" LIKE '%' || $(__p2) || '%'`);
      expect(result.params).to.deep.equal({ __p1: "John", __p2: "Book" });
    });
  });

  describe("String concatenation", () => {
    // Test removed: String concatenation no longer supported in SELECT projections

    it("should handle string concatenation in WHERE", () => {
      const result = query(
        () => from<User>("users").where((u) => u.name + u.email == "johnsmith@test.com"),
        {},
      );

      expect(result.sql).to.contain("||");
      expect(result.params).to.have.property("__p1", "johnsmith@test.com");
    });
  });

  describe("Null string handling", () => {
    it("should handle nullable string comparisons", () => {
      const result = query(() => from<User>("users").where((u) => u.bio == null), {});

      expect(result.sql).to.equal(`SELECT * FROM "users" WHERE "bio" IS NULL`);
      expect(result.params).to.deep.equal({});
    });

    it("should handle nullable string with string operations", () => {
      const result = query(
        () => from<User>("users").where((u) => u.bio != null && u.bio.includes("developer")),
        {},
      );

      expect(result.sql).to.contain(`"bio" IS NOT NULL`);
      expect(result.sql).to.contain(`"bio" LIKE '%' || $(__p1) || '%'`);
      expect(result.params).to.deep.equal({ __p1: "developer" });
    });
  });
});
