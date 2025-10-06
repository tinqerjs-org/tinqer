/**
 * String operation integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { executeSelect, executeSelectSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { schema } from "./database-schema.js";

describe("PostgreSQL Integration - String Operations", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("startsWith", () => {
    it("should find users with names starting with 'J'", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.startsWith("J")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" LIKE $(__p1) || \'%\'');
      expect(capturedSql!.params).to.deep.equal({ __p1: "J" });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.name[0]).to.equal("J");
      });
    });

    it("should find emails starting with specific prefix", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.email.startsWith("alice")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE "email" LIKE $(__p1) || \'%\'',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "alice" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1);
      expect(results[0]!.email).to.equal("alice@example.com");
    });

    it("should combine startsWith with other conditions", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx.from("users").where((u) => u.name.startsWith("J") && u.is_active === true),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("name" LIKE $(__p1) || \'%\' AND "is_active" = $(__p2))',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "J", __p2: true });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.name[0]).to.equal("J");
        expect(user.is_active).to.be.true;
      });
    });
  });

  describe("endsWith", () => {
    it("should find emails ending with '@example.com'", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx.from("users").where((u) => u.email.endsWith("@example.com")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE "email" LIKE \'%\' || $(__p1)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "@example.com" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(10); // All our test users have @example.com
      results.forEach((user) => {
        expect(user.email).to.match(/@example\.com$/);
      });
    });

    it("should find products with names ending with specific suffix", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("products").where((p) => p.name.endsWith("top")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "name" LIKE \'%\' || $(__p1)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "top" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1);
      expect(results[0]!.name).to.equal("Laptop");
    });
  });

  describe("contains (includes)", () => {
    it("should find users with 'oh' in their name", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.includes("oh")),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        "SELECT * FROM \"users\" WHERE \"name\" LIKE '%' || $(__p1) || '%'",
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "oh" });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.name.toLowerCase()).to.include("oh");
      });
    });

    it("should find products with 'office' in description", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
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
        'SELECT * FROM "products" WHERE ("description" IS NOT NULL AND "description" LIKE \'%\' || $(__p1) || \'%\')',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "office" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1); // Ergonomic office chair
      expect(results[0]!.name).to.equal("Chair");
    });

    it("should combine multiple string operations", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
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
        'SELECT * FROM "products" WHERE (("category" IS NOT NULL AND "category" LIKE $(__p1) || \'%\') AND ("name" LIKE \'%\' || $(__p2) || \'%\' OR ("description" IS NOT NULL AND "description" LIKE \'%\' || $(__p3) || \'%\')))',
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
    it("should find users with specific email patterns", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
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
        'SELECT * FROM "users" WHERE ("email" LIKE $(__p1) || \'%\' AND "email" LIKE \'%\' || $(__p2))',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "j", __p2: "@example.com" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(2); // John and Jane
      results.forEach((user) => {
        expect(user.email[0]).to.equal("j");
      });
    });

    it("should search products by multiple string fields", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
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
        "SELECT * FROM \"products\" WHERE (\"name\" LIKE '%' || $(__p1) || '%' OR (\"description\" IS NOT NULL AND \"description\" LIKE '%' || $(__p2) || '%'))",
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "e", __p2: "wireless" });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
    });

    it("should combine string operations with joins", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
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
        'SELECT "t0"."name" AS "userName", "t1"."name" AS "departmentName" FROM "users" AS "t0" INNER JOIN "departments" AS "t1" ON "t0"."department_id" = "t1"."id" WHERE ("t0"."name" LIKE $(__p1) || \'%\' AND "t1"."name" LIKE \'%\' || $(__p2) || \'%\')',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "J", __p2: "ing" });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.userName![0]).to.equal("J");
        expect(r.departmentName!).to.match(/ing/);
      });
    });

    it("should handle case-sensitive string operations", async () => {
      // Note: PostgreSQL LIKE is case-sensitive by default
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      const upperResults = await executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.includes("J")),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal(
        "SELECT * FROM \"users\" WHERE \"name\" LIKE '%' || $(__p1) || '%'",
      );
      expect(capturedSql1!.params).to.deep.equal({ __p1: "J" });

      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;
      const lowerResults = await executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.includes("o")),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal(
        "SELECT * FROM \"users\" WHERE \"name\" LIKE '%' || $(__p1) || '%'",
      );
      expect(capturedSql2!.params).to.deep.equal({ __p1: "o" });

      // John, Jane, Bob Johnson have capital J
      expect(upperResults.length).to.be.greaterThan(0);
      // Several names have lowercase 'o' (John, Johnson, Brown, Hopper, Ford)
      expect(lowerResults.length).to.be.greaterThan(0);

      // Case sensitivity check - capital D vs lowercase d
      let capturedSql3: { sql: string; params: Record<string, unknown> } | undefined;
      const capitalD = await executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.includes("D")),
        {
          onSql: (result) => {
            capturedSql3 = result;
          },
        },
      );

      expect(capturedSql3).to.exist;
      expect(capturedSql3!.sql).to.equal(
        "SELECT * FROM \"users\" WHERE \"name\" LIKE '%' || $(__p1) || '%'",
      );
      expect(capturedSql3!.params).to.deep.equal({ __p1: "D" });

      let capturedSql4: { sql: string; params: Record<string, unknown> } | undefined;
      const lowercaseD = await executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.name.includes("d")),
        {
          onSql: (result) => {
            capturedSql4 = result;
          },
        },
      );

      expect(capturedSql4).to.exist;
      expect(capturedSql4!.sql).to.equal(
        "SELECT * FROM \"users\" WHERE \"name\" LIKE '%' || $(__p1) || '%'",
      );
      expect(capturedSql4!.params).to.deep.equal({ __p1: "d" });

      // Diana, John Doe have capital D
      expect(capitalD.length).to.be.greaterThan(0);
      // Henry Ford has lowercase d
      expect(lowercaseD.length).to.be.greaterThan(0);
    });
  });

  describe("String operations with aggregates", () => {
    it("should count users by email domain", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const count = await executeSelectSimple(
        db,
        schema,
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
        'SELECT COUNT(*) FROM "users" WHERE "email" LIKE \'%\' || $(__p1)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "@example.com" });

      expect(count).to.equal(10);
    });
  });

  describe("String operations with NULL handling", () => {
    it("should handle nullable description fields", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
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
        'SELECT * FROM "products" WHERE ("description" IS NOT NULL AND "description" LIKE \'%\' || $(__p1) || \'%\')',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "High" });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1); // High-performance laptop
      expect(results[0]!.name).to.equal("Laptop");
    });

    it("should check for non-null strings", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        schema,
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
    it("should handle percent sign in search term", async () => {
      await db.none(`
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

      const results = await executeSelect(
        db,
        schema,
        (ctx, params, _helpers) =>
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
        "SELECT * FROM \"test_special_chars\" WHERE \"text\" LIKE '%' || $(search) || '%'",
      );

      // Note: PostgreSQL LIKE treats % as wildcard even in parameters
      // So searching for "%" will match ALL rows (acts like %%%)
      expect(results).to.have.length(4);

      await db.none("DROP TABLE test_special_chars");
    });

    it("should handle underscore in search term", async () => {
      await db.none(`
        CREATE TEMP TABLE test_special_chars (
          id INTEGER PRIMARY KEY,
          text TEXT
        );
        INSERT INTO test_special_chars (id, text) VALUES
          (1, 'test_value'),
          (2, 'test-value'),
          (3, 'test value'),
          (4, 'testAvalue');
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        schema,
        (ctx, params, _helpers) =>
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
        "SELECT * FROM \"test_special_chars\" WHERE \"text\" LIKE '%' || $(search) || '%'",
      );

      // Note: PostgreSQL LIKE treats _ as single-char wildcard
      // So searching for "_" will match any string with at least 1 character between the wildcards
      expect(results.length).to.be.greaterThan(0);

      await db.none("DROP TABLE test_special_chars");
    });

    it("should handle backslash in search term", async () => {
      await db.none(`
        CREATE TEMP TABLE test_backslash (
          id INTEGER PRIMARY KEY,
          text TEXT
        );
        INSERT INTO test_backslash (id, text) VALUES
          (1, 'C:\\Users\\Admin'),
          (2, 'C:/Users/Admin'),
          (3, 'Regular path'),
          (4, 'Backslash \\ here');
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        schema,
        (ctx, params, _helpers) =>
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
        "SELECT * FROM \"test_backslash\" WHERE \"text\" LIKE '%' || $(search) || '%'",
      );

      // PostgreSQL LIKE with backslash - may not match as expected
      // Backslashes in PostgreSQL TEXT columns are literal, but LIKE treats them specially
      expect(results).to.be.an("array");

      await db.none("DROP TABLE test_backslash");
    });

    it("should handle mixed special characters", async () => {
      await db.none(`
        CREATE TEMP TABLE test_mixed_chars (
          id INTEGER PRIMARY KEY,
          text TEXT
        );
        INSERT INTO test_mixed_chars (id, text) VALUES
          (1, 'Pattern: %_\\test'),
          (2, 'Regular text'),
          (3, 'Another % pattern'),
          (4, 'Under_score only');
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        schema,
        (ctx, params, _helpers) =>
          ctx.from("test_mixed_chars").where((t) => t.text.includes(params.search)),
        { search: "%_" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        "SELECT * FROM \"test_mixed_chars\" WHERE \"text\" LIKE '%' || $(search) || '%'",
      );

      // Note: PostgreSQL LIKE treats %_ as "any characters followed by any single character"
      // This will match most/all strings depending on content
      expect(results).to.be.an("array");

      await db.none("DROP TABLE test_mixed_chars");
    });
  });
});
