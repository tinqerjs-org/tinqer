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

      expect(result.sql).to.equal("SELECT * FROM \"users\" AS t0 WHERE name LIKE $(_name1) || '%'");
      expect(result.params).to.deep.equal({ _name1: "John" });
    });

    it("should handle startsWith with parameter", () => {
      const result = query(
        (p: { prefix: string }) => from<User>("users").where((u) => u.email.startsWith(p.prefix)),
        { prefix: "admin@" },
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"users\" AS t0 WHERE email LIKE $(prefix) || '%'",
      );
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
      expect(result.params).to.have.property("_name1", "Pro");
      expect(result.params).to.have.property("_sku1", "SKU");
    });
  });

  describe("endsWith", () => {
    it("should generate SQL for endsWith", () => {
      const result = query(() => from<User>("users").where((u) => u.email.endsWith(".com")), {});

      expect(result.sql).to.equal(
        "SELECT * FROM \"users\" AS t0 WHERE email LIKE '%' || $(_email1)",
      );
      expect(result.params).to.deep.equal({ _email1: ".com" });
    });

    it("should handle endsWith with parameter", () => {
      const result = query(
        (p: { suffix: string }) => from<User>("users").where((u) => u.name.endsWith(p.suffix)),
        { suffix: "son" },
      );

      expect(result.sql).to.equal("SELECT * FROM \"users\" AS t0 WHERE name LIKE '%' || $(suffix)");
      expect(result.params).to.deep.equal({ suffix: "son" });
    });

    it("should handle endsWith in combination with other conditions", () => {
      const result = query(
        () => from<User>("users").where((u) => u.id > 100 && u.email.endsWith("@example.com")),
        {},
      );

      expect(result.sql).to.contain("id > $(_id1)");
      expect(result.sql).to.contain("LIKE '%' || $(_email1)");
      expect(result.params).to.deep.equal({ _id1: 100, _email1: "@example.com" });
    });
  });

  describe("contains", () => {
    it("should generate SQL for contains", () => {
      const result = query(
        () => from<Product>("products").where((p) => p.description.includes("premium")),
        {},
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"products\" AS t0 WHERE description LIKE '%' || $(_description1) || '%'",
      );
      expect(result.params).to.deep.equal({ _description1: "premium" });
    });

    it("should handle contains with parameter", () => {
      const result = query(
        (p: { keyword: string }) =>
          from<Product>("products").where((pr) => pr.name.includes(p.keyword)),
        { keyword: "laptop" },
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"products\" AS t0 WHERE name LIKE '%' || $(keyword) || '%'",
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

      expect(result.sql).to.contain("name LIKE '%' || $(_name1) || '%'");
      expect(result.sql).to.contain("description LIKE '%' || $(_description1) || '%'");
      expect(result.params).to.deep.equal({ _name1: "Pro", _description1: "quality" });
    });
  });

  describe("Complex string operations", () => {
    it("should combine multiple string operations", () => {
      const result = query(
        () =>
          from<User>("users").where(
            (u) =>
              u.name.startsWith("Dr.") &&
              u.email.endsWith(".edu") &&
              u.bio?.includes("professor") == true,
          ),
        {},
      );

      expect(result.sql).to.contain("name LIKE $(_name1) || '%'");
      expect(result.sql).to.contain("email LIKE '%' || $(_email1)");
      expect(result.sql).to.contain("bio LIKE '%' || $(_bio1) || '%'");
      expect(result.params).to.deep.equal({
        _name1: "Dr.",
        _email1: ".edu",
        _bio1: "professor",
        _value1: true,
      });
    });

    it("should handle string operations with SELECT", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.name.startsWith("A"))
            .select((u) => ({ id: u.id, name: u.name })),
        {},
      );

      expect(result.sql).to.equal(
        "SELECT id AS id, name AS name FROM \"users\" AS t0 WHERE name LIKE $(_name1) || '%'",
      );
      expect(result.params).to.deep.equal({ _name1: "A" });
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
        "SELECT * FROM \"products\" AS t0 WHERE sku LIKE $(_sku1) || '%' ORDER BY name ASC LIMIT $(_limit1)",
      );
      expect(result.params).to.deep.equal({ _sku1: "ELEC", _limit1: 10 });
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
        "SELECT key AS name, COUNT(*) AS count FROM \"products\" AS t0 WHERE name LIKE '%' || $(_name1) || '%' GROUP BY name",
      );
      expect(result.params).to.deep.equal({ _name1: "Phone" });
    });

    it("should handle case-sensitive string operations", () => {
      const result = query(
        () =>
          from<User>("users").where(
            (u) => u.email.startsWith("Admin") || u.email.startsWith("admin"),
          ),
        {},
      );

      expect(result.sql).to.contain("email LIKE $(_email1) || '%'");
      expect(result.sql).to.contain("email LIKE $(_email2) || '%'");
      expect(result.params).to.deep.equal({ _email1: "Admin", _email2: "admin" });
    });

    it("should handle empty string checks", () => {
      const result = query(() => from<User>("users").where((u) => u.bio == ""), {});

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE bio = $(_bio1)');
      expect(result.params).to.deep.equal({ _bio1: "" });
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
              (u, p) => ({ userName: u.name, productName: p.name }),
            ),
        {},
      );

      expect(result.sql).to.contain("name LIKE $(_name1) || '%'");
      expect(result.sql).to.contain("name LIKE '%' || $(_name2) || '%'");
      expect(result.params).to.deep.equal({ _name1: "John", _name2: "Book" });
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
      expect(result.params).to.have.property("_value1", "johnsmith@test.com");
    });
  });

  describe("Null string handling", () => {
    it("should handle nullable string comparisons", () => {
      const result = query(() => from<User>("users").where((u) => u.bio == null), {});

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE bio IS NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should handle nullable string with string operations", () => {
      const result = query(
        () => from<User>("users").where((u) => u.bio != null && u.bio.includes("developer")),
        {},
      );

      expect(result.sql).to.contain("bio IS NOT NULL");
      expect(result.sql).to.contain("bio LIKE '%' || $(_bio1) || '%'");
      expect(result.params).to.deep.equal({ _bio1: "developer" });
    });
  });
});
