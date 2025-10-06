/**
 * Aggregate function integration tests with real Better SQLite3
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSelectSimple } from "@webpods/tinqer-sql-better-sqlite3";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("Better SQLite3 Integration - Aggregates", () => {
  before(() => {
    setupTestDatabase(db);
  });

  describe("COUNT", () => {
    it("should count all users", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const count = executeSelectSimple(db, dbContext, () => from(dbContext, "users").count(), {
        onSql: (result) => {
          capturedSql = result;
        },
      });

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT COUNT(*) FROM "users"');
      expect(capturedSql!.params).to.deep.equal({});

      expect(count).to.be.a("number");
      expect(count).to.equal(10); // We inserted 10 users
    });

    it("should count with WHERE clause", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const count = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("users").count((u) => u.is_active === 1),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT COUNT(*) FROM "users" WHERE "is_active" = @__p1');
      expect(capturedSql!.params).to.deep.equal({ __p1: 1 });

      expect(count).to.be.a("number");
      expect(count).to.be.lessThan(10); // Some users are inactive
    });

    it("should count with complex conditions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const count = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("users")
            .where((u) => u.age !== null && u.age >= 30)
            .count(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT COUNT(*) FROM "users" WHERE ("age" IS NOT NULL AND "age" >= @__p1)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 30 });

      expect(count).to.be.a("number");
      expect(count).to.be.greaterThan(0);
    });
  });

  describe("SUM", () => {
    it("should sum product prices", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const sum = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("products").sum((p) => p.price),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT SUM("price") FROM "products"');
      expect(capturedSql!.params).to.deep.equal({});

      expect(sum).to.be.a("number");
      expect(sum).to.be.greaterThan(0);
    });

    it("should sum with WHERE clause", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const sum = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("products")
            .where((p) => p.category === "Electronics")
            .sum((p) => p.price),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT SUM("price") FROM "products" WHERE "category" = @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "Electronics" });

      expect(sum).to.be.a("number");
      expect(sum).to.be.greaterThan(0);
    });

    it("should sum order totals", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const sum = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("orders").sum((o) => o.total_amount),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT SUM("total_amount") FROM "orders"');
      expect(capturedSql!.params).to.deep.equal({});

      expect(sum).to.be.a("number");
      expect(sum).to.be.greaterThan(0);
    });
  });

  describe("AVERAGE", () => {
    it("should calculate average user age", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const avg = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("users")
            .where((u) => u.age !== null)
            .average((u) => u.age!),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT AVG("age") FROM "users" WHERE "age" IS NOT NULL');
      expect(capturedSql!.params).to.deep.equal({});

      expect(avg).to.be.a("number");
      expect(avg).to.be.greaterThan(20);
      expect(avg).to.be.lessThan(50);
    });

    it("should calculate average product price by category", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      const avgElectronics = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("products")
            .where((p) => p.category === "Electronics")
            .average((p) => p.price),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const avgFurniture = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("products")
            .where((p) => p.category === "Furniture")
            .average((p) => p.price),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal(
        'SELECT AVG("price") FROM "products" WHERE "category" = @__p1',
      );
      expect(capturedSql1!.params).to.deep.equal({ __p1: "Electronics" });

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal(
        'SELECT AVG("price") FROM "products" WHERE "category" = @__p1',
      );
      expect(capturedSql2!.params).to.deep.equal({ __p1: "Furniture" });

      expect(avgElectronics).to.be.a("number");
      expect(avgFurniture).to.be.a("number");
      expect(avgFurniture).to.be.greaterThan(avgElectronics); // Furniture is more expensive
    });
  });

  describe("MIN and MAX", () => {
    it("should find minimum and maximum ages", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      const minAge = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("users")
            .where((u) => u.age !== null)
            .min((u) => u.age!),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const maxAge = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("users")
            .where((u) => u.age !== null)
            .max((u) => u.age!),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal('SELECT MIN("age") FROM "users" WHERE "age" IS NOT NULL');
      expect(capturedSql1!.params).to.deep.equal({});

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal('SELECT MAX("age") FROM "users" WHERE "age" IS NOT NULL');
      expect(capturedSql2!.params).to.deep.equal({});

      expect(minAge).to.be.a("number");
      expect(maxAge).to.be.a("number");
      expect(minAge).to.be.lessThan(maxAge);
      expect(minAge).to.equal(25); // Jane is 25
      expect(maxAge).to.equal(55); // Henry is 55
    });

    it("should find min/max prices", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      const minPrice = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("products").min((p) => p.price),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const maxPrice = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("products").max((p) => p.price),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal('SELECT MIN("price") FROM "products"');
      expect(capturedSql1!.params).to.deep.equal({});

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal('SELECT MAX("price") FROM "products"');
      expect(capturedSql2!.params).to.deep.equal({});

      expect(minPrice).to.be.a("number");
      expect(maxPrice).to.be.a("number");
      expect(minPrice).to.equal(1.99); // Pen
      expect(maxPrice).to.equal(999.99); // Laptop
    });

    it("should find min/max with WHERE", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const maxElectronicsPrice = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("products")
            .where((p) => p.category === "Electronics")
            .max((p) => p.price),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT MAX("price") FROM "products" WHERE "category" = @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "Electronics" });

      expect(maxElectronicsPrice).to.equal(999.99);
    });
  });

  describe("GROUP BY", () => {
    it("should group users by department", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("users")
            .groupBy((u) => u.department_id)
            .select((g) => ({
              department: g.key,
              count: g.count(),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "department_id" AS "department", COUNT(*) AS "count" FROM "users" GROUP BY "department_id"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);
      expect(totalCount).to.equal(10); // Total users
    });

    it("should group products by category with aggregates", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("products")
            .groupBy((p) => p.category)
            .select((g) => ({
              category: g.key,
              count: g.count(),
              avgPrice: g.average((p) => p.price),
              totalStock: g.sum((p) => p.stock),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "category" AS "category", COUNT(*) AS "count", AVG("price") AS "avgPrice", SUM("stock") AS "totalStock" ' +
          'FROM "products" GROUP BY "category"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r).to.have.property("category");
        expect(r).to.have.property("count");
        expect(r).to.have.property("avgPrice");
        expect(r).to.have.property("totalStock");
      });
    });

    it("should group with WHERE clause", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("users")
            .where((u) => u.is_active === 1 && u.age !== null)
            .groupBy((u) => u.department_id)
            .select((g) => ({
              department: g.key,
              activeUsers: g.count(),
              avgAge: g.average((u) => u.age!),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "department_id" AS "department", COUNT(*) AS "activeUsers", AVG("age") AS "avgAge" ' +
          'FROM "users" WHERE ("is_active" = @__p1 AND "age" IS NOT NULL) GROUP BY "department_id"',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 1 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.activeUsers).to.be.greaterThan(0);
      });
    });

    it("should group orders by status", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("orders")
            .groupBy((o) => o.status)
            .select((g) => ({
              status: g.key,
              orderCount: g.count(),
              totalRevenue: g.sum((o) => o.total_amount),
              avgOrderValue: g.average((o) => o.total_amount),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "status" AS "status", COUNT(*) AS "orderCount", SUM("total_amount") AS "totalRevenue", AVG("total_amount") AS "avgOrderValue" ' +
          'FROM "orders" GROUP BY "status"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      const statuses = results.map((r) => r.status);
      expect(statuses).to.include.members(["completed", "pending", "shipped"]);
    });
  });

  describe("NULL-aware aggregates", () => {
    it("should handle SUM with NULL values (NULLs ignored)", () => {
      // Insert test data with NULL values
      db.exec(`
        CREATE TEMP TABLE test_nulls (
          id INTEGER PRIMARY KEY,
          value INTEGER
        );
        INSERT INTO test_nulls (id, value) VALUES (1, 10), (2, 20), (3, NULL), (4, 30), (5, NULL);
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const sum = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("test_nulls").sum((t) => t.value!),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT SUM("value") FROM "test_nulls"');
      expect(capturedSql!.params).to.deep.equal({});

      // SUM should ignore NULLs: 10 + 20 + 30 = 60
      expect(sum).to.equal(60);

      db.exec("DROP TABLE test_nulls");
    });

    it("should handle AVG with NULL values (NULLs ignored)", () => {
      // Insert test data with NULL values
      db.exec(`
        CREATE TEMP TABLE test_avg_nulls (
          id INTEGER PRIMARY KEY,
          score REAL
        );
        INSERT INTO test_avg_nulls (id, score) VALUES (1, 100.0), (2, 80.0), (3, NULL), (4, 90.0), (5, NULL);
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const avg = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("test_avg_nulls").average((t) => t.score!),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT AVG("score") FROM "test_avg_nulls"');
      expect(capturedSql!.params).to.deep.equal({});

      // AVG should ignore NULLs: (100 + 80 + 90) / 3 = 90
      expect(avg).to.equal(90);

      db.exec("DROP TABLE test_avg_nulls");
    });

    it("should handle COUNT with NULL values (all rows counted)", () => {
      // Insert test data with NULL values
      db.exec(`
        CREATE TEMP TABLE test_count_nulls (
          id INTEGER PRIMARY KEY,
          name TEXT
        );
        INSERT INTO test_count_nulls (id, name) VALUES (1, 'Alice'), (2, NULL), (3, 'Bob'), (4, NULL), (5, 'Charlie');
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const count = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("test_count_nulls").count(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT COUNT(*) FROM "test_count_nulls"');
      expect(capturedSql!.params).to.deep.equal({});

      // COUNT(*) counts all rows including NULLs
      expect(count).to.equal(5);

      db.exec("DROP TABLE test_count_nulls");
    });

    it("should handle COUNT DISTINCT with NULL values (NULLs excluded)", () => {
      // Insert test data with duplicate and NULL values
      db.exec(`
        CREATE TEMP TABLE test_distinct_nulls (
          id INTEGER PRIMARY KEY,
          category TEXT
        );
        INSERT INTO test_distinct_nulls (id, category) VALUES
          (1, 'A'), (2, 'B'), (3, 'A'), (4, NULL), (5, 'B'), (6, NULL), (7, 'C');
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("test_distinct_nulls")
            .select((t) => t.category)
            .distinct(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT DISTINCT "category" FROM "test_distinct_nulls"');
      expect(capturedSql!.params).to.deep.equal({});

      // DISTINCT should return unique values: A, B, C, NULL
      expect(results).to.be.an("array");
      expect(results).to.have.length(4);
      // SQLite adapter returns objects, extract the category values
      type CategoryResult = { category: string | null };
      const categories = (results as unknown as CategoryResult[]).map((r) => r.category);
      expect(categories).to.include.members(["A", "B", "C", null]);

      db.exec("DROP TABLE test_distinct_nulls");
    });

    it("should handle MIN/MAX with NULL values (NULLs ignored)", () => {
      // Insert test data with NULL values
      db.exec(`
        CREATE TEMP TABLE test_minmax_nulls (
          id INTEGER PRIMARY KEY,
          price REAL
        );
        INSERT INTO test_minmax_nulls (id, price) VALUES (1, 10.5), (2, NULL), (3, 5.0), (4, NULL), (5, 20.0);
      `);

      let capturedSqlMin: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSqlMax: { sql: string; params: Record<string, unknown> } | undefined;

      const minPrice = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("test_minmax_nulls").min((t) => t.price!),
        {
          onSql: (result) => {
            capturedSqlMin = result;
          },
        },
      );

      const maxPrice = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("test_minmax_nulls").max((t) => t.price!),
        {
          onSql: (result) => {
            capturedSqlMax = result;
          },
        },
      );

      expect(capturedSqlMin).to.exist;
      expect(capturedSqlMin!.sql).to.equal('SELECT MIN("price") FROM "test_minmax_nulls"');
      expect(capturedSqlMax).to.exist;
      expect(capturedSqlMax!.sql).to.equal('SELECT MAX("price") FROM "test_minmax_nulls"');

      // MIN/MAX should ignore NULLs
      expect(minPrice).to.equal(5.0);
      expect(maxPrice).to.equal(20.0);

      db.exec("DROP TABLE test_minmax_nulls");
    });

    it("should handle GROUP BY with NULL keys", () => {
      // Insert test data with NULL in grouping column
      db.exec(`
        CREATE TEMP TABLE test_group_nulls (
          id INTEGER PRIMARY KEY,
          category TEXT,
          amount INTEGER
        );
        INSERT INTO test_group_nulls (id, category, amount) VALUES
          (1, 'A', 10), (2, NULL, 5), (3, 'A', 20), (4, NULL, 15), (5, 'B', 30);
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("test_group_nulls")
            .groupBy((t) => t.category)
            .select((g) => ({
              category: g.key,
              total: g.sum((t) => t.amount),
              count: g.count(),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "category" AS "category", SUM("amount") AS "total", COUNT(*) AS "count" FROM "test_group_nulls" GROUP BY "category"',
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(3); // A, B, NULL

      // Find the NULL group
      const nullGroup = results.find((r) => r.category === null);
      expect(nullGroup).to.exist;
      expect(nullGroup!.total).to.equal(20); // 5 + 15
      expect(nullGroup!.count).to.equal(2);

      db.exec("DROP TABLE test_group_nulls");
    });
  });

  describe("Aggregate bundles (multiple aggregates in single SELECT)", () => {
    it("should handle COUNT + SUM + AVG together", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("products")
            .groupBy((p) => p.category)
            .select((g) => ({
              category: g.key,
              totalCount: g.count(),
              totalValue: g.sum((p) => p.price * p.stock),
              avgPrice: g.average((p) => p.price),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "category" AS "category", COUNT(*) AS "totalCount", ' +
          'SUM(("price" * "stock")) AS "totalValue", AVG("price") AS "avgPrice" ' +
          'FROM "products" GROUP BY "category"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);

      // Verify each result has all aggregate values
      results.forEach((r) => {
        expect(r).to.have.property("category");
        expect(r).to.have.property("totalCount");
        expect(r).to.have.property("totalValue");
        expect(r).to.have.property("avgPrice");
        expect(r.totalCount).to.be.a("number");
        expect(r.totalValue).to.be.a("number");
        expect(r.avgPrice).to.be.a("number");
      });
    });

    it("should handle MIN + MAX + COUNT together", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("orders")
            .groupBy((o) => o.status)
            .select((g) => ({
              status: g.key,
              orderCount: g.count(),
              minAmount: g.min((o) => o.total_amount),
              maxAmount: g.max((o) => o.total_amount),
              totalRevenue: g.sum((o) => o.total_amount),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "status" AS "status", COUNT(*) AS "orderCount", ' +
          'MIN("total_amount") AS "minAmount", MAX("total_amount") AS "maxAmount", ' +
          'SUM("total_amount") AS "totalRevenue" ' +
          'FROM "orders" GROUP BY "status"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");

      // Verify aggregate relationships
      results.forEach((r) => {
        expect(r.minAmount).to.be.lessThanOrEqual(r.maxAmount);
        expect(r.orderCount).to.be.greaterThan(0);
        expect(r.totalRevenue).to.be.greaterThanOrEqual(r.maxAmount);
      });
    });

    it("should handle all five aggregate functions together without grouping", () => {
      // Create a simple temp table for this test
      db.exec(`
        CREATE TEMP TABLE test_agg_all (
          id INTEGER PRIMARY KEY,
          value INTEGER
        );
        INSERT INTO test_agg_all (id, value) VALUES (1, 10), (2, 20), (3, 30), (4, 40), (5, 50);
      `);

      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql3: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql4: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql5: { sql: string; params: Record<string, unknown> } | undefined;

      // Get each aggregate separately (Tinqer terminal operations)
      const count = executeSelectSimple(db, dbContext, (ctx) => ctx.from("test_agg_all").count(), {
        onSql: (result) => {
          capturedSql1 = result;
        },
      });
      const min = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("test_agg_all").min((t) => t.value),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );
      const max = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("test_agg_all").max((t) => t.value),
        {
          onSql: (result) => {
            capturedSql3 = result;
          },
        },
      );
      const avg = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("test_agg_all").average((t) => t.value),
        {
          onSql: (result) => {
            capturedSql4 = result;
          },
        },
      );
      const sum = executeSelectSimple(
        db,
        dbContext,
        (ctx) => ctx.from("test_agg_all").sum((t) => t.value),
        {
          onSql: (result) => {
            capturedSql5 = result;
          },
        },
      );

      // Verify SQL generation
      expect(capturedSql1!.sql).to.equal('SELECT COUNT(*) FROM "test_agg_all"');
      expect(capturedSql2!.sql).to.equal('SELECT MIN("value") FROM "test_agg_all"');
      expect(capturedSql3!.sql).to.equal('SELECT MAX("value") FROM "test_agg_all"');
      expect(capturedSql4!.sql).to.equal('SELECT AVG("value") FROM "test_agg_all"');
      expect(capturedSql5!.sql).to.equal('SELECT SUM("value") FROM "test_agg_all"');

      // Verify aggregate relationships
      expect(count).to.equal(5);
      expect(min).to.equal(10);
      expect(max).to.equal(50);
      expect(avg).to.equal(30); // (10+20+30+40+50)/5
      expect(sum).to.equal(150); // 10+20+30+40+50
      expect(min).to.be.lessThan(max);
      expect(avg).to.be.greaterThan(min);
      expect(avg).to.be.lessThan(max);

      db.exec("DROP TABLE test_agg_all");
    });

    it("should handle aggregates with WHERE filter", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        dbContext,
        (ctx) =>
          ctx
            .from("products")
            .where((p) => p.category === "Electronics")
            .groupBy((p) => p.category)
            .select((g) => ({
              category: g.key,
              count: g.count(),
              totalStock: g.sum((p) => p.stock),
              avgPrice: g.average((p) => p.price),
              cheapest: g.min((p) => p.price),
              mostExpensive: g.max((p) => p.price),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "category" AS "category", COUNT(*) AS "count", SUM("stock") AS "totalStock", ' +
          'AVG("price") AS "avgPrice", MIN("price") AS "cheapest", MAX("price") AS "mostExpensive" ' +
          'FROM "products" WHERE "category" = @__p1 GROUP BY "category"',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "Electronics" });

      expect(results).to.be.an("array");
      expect(results).to.have.length(1);

      const electronics = results[0]!;
      expect(electronics.category).to.equal("Electronics");
      expect(electronics.cheapest).to.be.lessThanOrEqual(electronics.mostExpensive);
      expect(electronics.avgPrice).to.be.greaterThanOrEqual(electronics.cheapest);
      expect(electronics.avgPrice).to.be.lessThanOrEqual(electronics.mostExpensive);
    });
  });
});
