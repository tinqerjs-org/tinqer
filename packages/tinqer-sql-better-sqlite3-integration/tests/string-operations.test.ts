/**
 * String operation integration tests with real Better SQLite3
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { executeSelect, executeSelectSimple } from "@webpods/tinqer-sql-better-sqlite3";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("Better SQLite3 Integration - String Operations", () => {
  before(() => {
    setupTestDatabase(db);
  });

  describe("startsWith", () => {
    it("should find users with names starting with 'J'", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.startsWith("J")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" LIKE @__p1 || \'%\'');
      expect(capturedSql!.params).to.deep.equal({ __p1: "J" });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.name[0]).to.equal("J");
      });
    });

    it("should find emails starting with specific prefix", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.email.startsWith("alice")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" LIKE @__p1 || \'%\'');
      expect(capturedSql!.params).to.deep.equal({ __p1: "alice" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1);
      expect(results[0]!.email).to.equal("alice@example.com");
    });

    it("should combine startsWith with other conditions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) =>
          ctx.from("users").where((u) => u.name.startsWith("J") && u.is_active === 1),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("name" LIKE @__p1 || \'%\' AND "is_active" = @__p2)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "J", __p2: 1 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.name[0]).to.equal("J");
        expect(user.is_active).to.equal(1);
      });
    });
  });

  describe("endsWith", () => {
    it("should find emails ending with '@example.com'", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) =>
          ctx.from("users").where((u) => u.email.endsWith("@example.com")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" LIKE \'%\' || @__p1');
      expect(capturedSql!.params).to.deep.equal({ __p1: "@example.com" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(10); // All our test users have @example.com
      results.forEach((user) => {
        expect(user.email).to.match(/@example\.com$/);
      });
    });

    it("should find products with names ending with specific suffix", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) => ctx.from("products").where((p) => p.name.endsWith("top")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "name" LIKE \'%\' || @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "top" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1);
      expect(results[0]!.name).to.equal("Laptop");
    });
  });

  describe("contains (includes)", () => {
    it("should find users with 'oh' in their name", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.includes("oh")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        "SELECT * FROM \"users\" WHERE \"name\" LIKE '%' || @__p1 || '%'",
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "oh" });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.name.toLowerCase()).to.include("oh");
      });
    });

    it("should find products with 'office' in description", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) =>
          ctx
            .from("products")
            .where((p) => p.description !== null && p.description.includes("office")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE ("description" IS NOT NULL AND "description" LIKE \'%\' || @__p1 || \'%\')',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "office" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1); // Ergonomic office chair
      expect(results[0]!.name).to.equal("Chair");
    });

    it("should combine multiple string operations", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) =>
          ctx
            .from("products")
            .where(
              (p) =>
                p.category !== null &&
                p.category.startsWith("Electr") &&
                (p.name.includes("e") ||
                  (p.description !== null && p.description.includes("performance"))),
            ),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE (("category" IS NOT NULL AND "category" LIKE @__p1 || \'%\') AND ("name" LIKE \'%\' || @__p2 || \'%\' OR ("description" IS NOT NULL AND "description" LIKE \'%\' || @__p3 || \'%\')))',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "Electr", __p2: "e", __p3: "performance" });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((product) => {
        expect(product.category).to.equal("Electronics");
      });
    });
  });

  describe("Complex string queries", () => {
    it("should find users with specific email patterns", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) =>
          ctx
            .from("users")
            .where((u) => u.email.startsWith("j") && u.email.endsWith("@example.com")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("email" LIKE @__p1 || \'%\' AND "email" LIKE \'%\' || @__p2)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "j", __p2: "@example.com" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(2); // John and Jane
      results.forEach((user) => {
        expect(user.email[0]).to.equal("j");
      });
    });

    it("should search products by multiple string fields", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) =>
          ctx
            .from("products")
            .where(
              (p) =>
                p.name.includes("e") ||
                (p.description !== null && p.description.includes("wireless")),
            ),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        "SELECT * FROM \"products\" WHERE (\"name\" LIKE '%' || @__p1 || '%' OR (\"description\" IS NOT NULL AND \"description\" LIKE '%' || @__p2 || '%'))",
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "e", __p2: "wireless" });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
    });

    it("should combine string operations with joins", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) =>
          ctx
            .from("users")
            .join(
              ctx.from("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .where((joined) => joined.u.name.startsWith("J") && joined.d.name.includes("ing"))
            .select((joined) => ({
              userName: joined.u.name,
              departmentName: joined.d.name,
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."name" AS "userName", "t1"."name" AS "departmentName" FROM "users" AS "t0" INNER JOIN "departments" AS "t1" ON "t0"."department_id" = "t1"."id" WHERE ("t0"."name" LIKE @__p1 || \'%\' AND "t1"."name" LIKE \'%\' || @__p2 || \'%\')',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "J", __p2: "ing" });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.userName![0]).to.equal("J");
        expect(r.departmentName!).to.match(/ing/);
      });
    });

    it("should handle case-sensitive string operations", () => {
      // Note: PostgreSQL LIKE is case-sensitive by default
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      const upperResults = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.includes("J")),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal(
        "SELECT * FROM \"users\" WHERE \"name\" LIKE '%' || @__p1 || '%'",
      );
      expect(capturedSql1!.params).to.deep.equal({ __p1: "J" });

      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;
      const lowerResults = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.includes("o")),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal(
        "SELECT * FROM \"users\" WHERE \"name\" LIKE '%' || @__p1 || '%'",
      );
      expect(capturedSql2!.params).to.deep.equal({ __p1: "o" });

      // John, Jane, Bob Johnson have capital J
      expect(upperResults.length).to.be.greaterThan(0);
      // Several names have lowercase 'o' (John, Johnson, Brown, Hopper, Ford)
      expect(lowerResults.length).to.be.greaterThan(0);

      // Case sensitivity check - capital D vs lowercase d
      let capturedSql3: { sql: string; params: Record<string, unknown> } | undefined;
      const capitalD = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.includes("D")),
        {
          onSql: (result) => {
            capturedSql3 = result;
          },
        },
      );

      expect(capturedSql3).to.exist;
      expect(capturedSql3!.sql).to.equal(
        "SELECT * FROM \"users\" WHERE \"name\" LIKE '%' || @__p1 || '%'",
      );
      expect(capturedSql3!.params).to.deep.equal({ __p1: "D" });

      let capturedSql4: { sql: string; params: Record<string, unknown> } | undefined;
      const lowercaseD = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.includes("d")),
        {
          onSql: (result) => {
            capturedSql4 = result;
          },
        },
      );

      expect(capturedSql4).to.exist;
      expect(capturedSql4!.sql).to.equal(
        "SELECT * FROM \"users\" WHERE \"name\" LIKE '%' || @__p1 || '%'",
      );
      expect(capturedSql4!.params).to.deep.equal({ __p1: "d" });

      // Diana, John Doe have capital D
      expect(capitalD.length).to.be.greaterThan(0);
      // Henry Ford has lowercase d
      expect(lowercaseD.length).to.be.greaterThan(0);
    });
  });

  describe("String operations with aggregates", () => {
    it("should count users by email domain", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const count = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) =>
          ctx
            .from("users")
            .where((u) => u.email.endsWith("@example.com"))
            .count(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT COUNT(*) FROM "users" WHERE "email" LIKE \'%\' || @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "@example.com" });

      expect(count).to.equal(10);
    });
  });

  describe("String operations with NULL handling", () => {
    it("should handle nullable description fields", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) =>
          ctx
            .from("products")
            .where((p) => p.description !== null && p.description.includes("High")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE ("description" IS NOT NULL AND "description" LIKE \'%\' || @__p1 || \'%\')',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "High" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1); // High-performance laptop
      expect(results[0]!.name).to.equal("Laptop");
    });

    it("should check for non-null strings", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) => ctx.from("products").where((p) => p.description !== null),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "products" WHERE "description" IS NOT NULL');
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.equal(10); // All products have descriptions
    });
  });

  describe("String pattern escaping", () => {
    it("should handle percent sign in search term", () => {
      // Insert test data with percent signs
      db.exec(`
        CREATE TEMP TABLE test_special_chars (
          id INTEGER PRIMARY KEY,
          text TEXT
        );
        INSERT INTO test_special_chars (id, text) VALUES
          (1, '100% cotton'),
          (2, '50% off sale'),
          (3, 'Regular product'),
          (4, '%percent% everywhere');
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx.from("test_special_chars").where((t) => t.text.includes(params.search)),
        { search: "%" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        "SELECT * FROM \"test_special_chars\" WHERE \"text\" LIKE '%' || @search || '%'",
      );
      expect(capturedSql!.params).to.deep.equal({ search: "%" });

      // Note: SQLite LIKE treats % as wildcard even in parameters
      // So searching for "%" will match ALL rows (acts like %%%)
      expect(results).to.be.an("array");
      expect(results).to.have.length(4); // All rows match because % is wildcard
      expect(results.map((r: { id: number }) => r.id).sort()).to.deep.equal([1, 2, 3, 4]);

      db.exec("DROP TABLE test_special_chars");
    });

    it("should handle underscore in search term", () => {
      // Insert test data with underscores
      db.exec(`
        CREATE TEMP TABLE test_special_chars (
          id INTEGER PRIMARY KEY,
          text TEXT
        );
        INSERT INTO test_special_chars (id, text) VALUES
          (1, 'test_file'),
          (2, 'test-file'),
          (3, 'testfile'),
          (4, 'my_test_file');
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        dbContext,
        (ctx, params: { search: string }, _helpers) =>
          ctx.from("test_special_chars").where((t) => t.text.includes(params.search)),
        { search: "_" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        "SELECT * FROM \"test_special_chars\" WHERE \"text\" LIKE '%' || @search || '%'",
      );

      // Note: SQLite LIKE treats _ as wildcard even in parameters
      // So searching for "_" will match ALL rows (acts like %_%)
      expect(results).to.be.an("array");
      expect(results).to.have.length(4); // All rows match because _ is wildcard for any single char
      expect(results.map((r: { id: number }) => r.id).sort()).to.deep.equal([1, 2, 3, 4]);

      db.exec("DROP TABLE test_special_chars");
    });

    it("should handle backslash in search term", () => {
      // Insert test data with backslashes
      db.exec(`
        CREATE TEMP TABLE test_backslash (
          id INTEGER PRIMARY KEY,
          text TEXT
        );
        INSERT INTO test_backslash (id, text) VALUES
          (1, 'C:\\Users\\Admin'),
          (2, 'C:/Users/Admin'),
          (3, '/home/user'),
          (4, 'D:\\Program Files\\App');
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        dbContext,
        (ctx, params: { search: string }, _helpers) =>
          ctx.from("test_backslash").where((t) => t.text.includes(params.search)),
        { search: "\\" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        "SELECT * FROM \"test_backslash\" WHERE \"text\" LIKE '%' || @search || '%'",
      );
      expect(capturedSql!.params).to.deep.equal({ search: "\\" });

      // Should find Windows paths with backslashes
      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Rows 1 and 4
      expect(results.map((r) => r.id).sort()).to.deep.equal([1, 4]);

      db.exec("DROP TABLE test_backslash");
    });

    it("should handle multiple special characters together", () => {
      // Insert test data with mixed special characters
      db.exec(`
        CREATE TEMP TABLE test_mixed_chars (
          id INTEGER PRIMARY KEY,
          text TEXT
        );
        INSERT INTO test_mixed_chars (id, text) VALUES
          (1, 'Price: $10 (50% off)'),
          (2, 'File: data_2024_%backup.sql'),
          (3, 'Path: C:\\temp\\%data%\\file_01.txt'),
          (4, 'Normal text here');
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Search for pattern containing both % and _
      const results = executeSelect(
        db,
        dbContext,
        (ctx, params: { search: string }, _helpers) =>
          ctx.from("test_mixed_chars").where((t) => t.text.includes(params.search)),
        { search: "%_" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.params).to.deep.equal({ search: "%_" });

      // Should find rows containing literal "%_" pattern
      expect(results).to.be.an("array");
      const matchingIds = results.map((r) => r.id);
      expect(matchingIds).to.include(2); // Contains "_%"

      db.exec("DROP TABLE test_mixed_chars");
    });
  });
});
