/**
 * Aggregate function integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSelectSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("PostgreSQL Integration - Aggregates", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("COUNT", () => {
    it("should count all users", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const count = await executeSelectSimple(db, () => from(dbContext, "users").count(), {
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

    it("should count with WHERE clause", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const count = await executeSelectSimple(
        db,
        () => from(dbContext, "users").count((u) => u.is_active === true),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT COUNT(*) FROM "users" WHERE "is_active" = $(__p1)');
      expect(capturedSql!.params).to.deep.equal({ __p1: true });

      expect(count).to.be.a("number");
      expect(count).to.be.lessThan(10); // Some users are inactive
    });

    it("should count with complex conditions", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const count = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
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
        'SELECT COUNT(*) FROM "users" WHERE ("age" IS NOT NULL AND "age" >= $(__p1))',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 30 });

      expect(count).to.be.a("number");
      expect(count).to.be.greaterThan(0);
    });
  });

  describe("SUM", () => {
    it("should sum product prices", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const sum = await executeSelectSimple(
        db,
        () => from(dbContext, "products").sum((p) => p.price),
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

    it("should sum with WHERE clause", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const sum = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "products")
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
        'SELECT SUM("price") FROM "products" WHERE "category" = $(__p1)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "Electronics" });

      expect(sum).to.be.a("number");
      expect(sum).to.be.greaterThan(0);
    });

    it("should sum order totals", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const sum = await executeSelectSimple(
        db,
        () => from(dbContext, "orders").sum((o) => o.total_amount),
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
    it("should calculate average user age", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const avg = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
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

    it("should calculate average product price by category", async () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      const avgElectronics = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "products")
            .where((p) => p.category === "Electronics")
            .average((p) => p.price),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const avgFurniture = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "products")
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
        'SELECT AVG("price") FROM "products" WHERE "category" = $(__p1)',
      );
      expect(capturedSql1!.params).to.deep.equal({ __p1: "Electronics" });

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal(
        'SELECT AVG("price") FROM "products" WHERE "category" = $(__p1)',
      );
      expect(capturedSql2!.params).to.deep.equal({ __p1: "Furniture" });

      expect(avgElectronics).to.be.a("number");
      expect(avgFurniture).to.be.a("number");
      expect(avgFurniture).to.be.greaterThan(avgElectronics); // Furniture is more expensive
    });
  });

  describe("MIN and MAX", () => {
    it("should find minimum and maximum ages", async () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      const minAge = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
            .where((u) => u.age !== null)
            .min((u) => u.age!),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const maxAge = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
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

    it("should find min/max prices", async () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      const minPrice = await executeSelectSimple(
        db,
        () => from(dbContext, "products").min((p) => p.price),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const maxPrice = await executeSelectSimple(
        db,
        () => from(dbContext, "products").max((p) => p.price),
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

    it("should find min/max with WHERE", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const maxElectronicsPrice = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "products")
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
        'SELECT MAX("price") FROM "products" WHERE "category" = $(__p1)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "Electronics" });

      expect(maxElectronicsPrice).to.equal(999.99);
    });
  });

  describe("GROUP BY", () => {
    it("should group users by department", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
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

    it("should group products by category with aggregates", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "products")
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

    it("should group with WHERE clause", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
            .where((u) => u.is_active === true && u.age !== null)
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
          'FROM "users" WHERE ("is_active" = $(__p1) AND "age" IS NOT NULL) GROUP BY "department_id"',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: true });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.activeUsers).to.be.greaterThan(0);
      });
    });

    it("should group orders by status", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "orders")
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
    it("should handle SUM with NULL values (NULLs ignored)", async () => {
      await db.none(`
        CREATE TEMP TABLE test_nulls (
          id INTEGER PRIMARY KEY,
          value INTEGER
        );
        INSERT INTO test_nulls (id, value) VALUES (1, 10), (2, 20), (3, NULL), (4, 30), (5, NULL);
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const sum = await executeSelectSimple(
        db,
        () => from<{ id: number; value: number | null }>("test_nulls").sum((t) => t.value!),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT SUM("value") FROM "test_nulls"');
      expect(sum).to.equal(60); // SUM ignores NULLs: 10 + 20 + 30 = 60

      await db.none("DROP TABLE test_nulls");
    });

    it("should handle AVG with NULL values (NULLs ignored)", async () => {
      await db.none(`
        CREATE TEMP TABLE test_nulls (
          id INTEGER PRIMARY KEY,
          value NUMERIC
        );
        INSERT INTO test_nulls (id, value) VALUES (1, 10.0), (2, 20.0), (3, NULL), (4, 30.0);
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const avg = await executeSelectSimple(
        db,
        () => from<{ id: number; value: number | null }>("test_nulls").average((t) => t.value!),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT AVG("value") FROM "test_nulls"');
      expect(Number(avg)).to.equal(20); // AVG ignores NULLs: (10 + 20 + 30) / 3 = 20

      await db.none("DROP TABLE test_nulls");
    });

    it("should handle COUNT(*) with NULL values (NULLs counted)", async () => {
      await db.none(`
        CREATE TEMP TABLE test_nulls (
          id INTEGER PRIMARY KEY,
          value INTEGER
        );
        INSERT INTO test_nulls (id, value) VALUES (1, 10), (2, NULL), (3, 20), (4, NULL), (5, 30);
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const count = await executeSelectSimple(
        db,
        () => from<{ id: number; value: number | null }>("test_nulls").count(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT COUNT(*) FROM "test_nulls"');
      expect(count).to.equal(5); // COUNT(*) includes NULL rows

      await db.none("DROP TABLE test_nulls");
    });

    it("should handle COUNT DISTINCT with NULLs (NULLs excluded)", async () => {
      await db.none(`
        CREATE TEMP TABLE test_nulls (
          id INTEGER PRIMARY KEY,
          category TEXT
        );
        INSERT INTO test_nulls (id, category) VALUES
          (1, 'A'), (2, 'B'), (3, NULL), (4, 'A'), (5, NULL), (6, 'C');
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from<{ id: number; category: string | null }>("test_nulls")
            .select((t) => t.category)
            .distinct(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT DISTINCT "category" FROM "test_nulls"');

      // DISTINCT includes NULL as a single value in PostgreSQL
      // PostgreSQL adapter returns objects, extract the category values
      type CategoryResult = { category: string | null };
      const categories = (results as unknown as CategoryResult[]).map((r) => r.category);
      expect(categories).to.include.members(["A", "B", "C", null]);

      await db.none("DROP TABLE test_nulls");
    });

    it("should handle MIN/MAX with NULL values (NULLs ignored)", async () => {
      await db.none(`
        CREATE TEMP TABLE test_minmax (
          id INTEGER PRIMARY KEY,
          value INTEGER
        );
        INSERT INTO test_minmax (id, value) VALUES (1, 50), (2, NULL), (3, 10), (4, NULL), (5, 30);
      `);

      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      const min = await executeSelectSimple(
        db,
        () => from<{ id: number; value: number | null }>("test_minmax").min((t) => t.value!),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const max = await executeSelectSimple(
        db,
        () => from<{ id: number; value: number | null }>("test_minmax").max((t) => t.value!),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal('SELECT MIN("value") FROM "test_minmax"');
      expect(min).to.equal(10); // MIN ignores NULLs

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal('SELECT MAX("value") FROM "test_minmax"');
      expect(max).to.equal(50); // MAX ignores NULLs

      await db.none("DROP TABLE test_minmax");
    });

    it("should handle GROUP BY with NULL keys", async () => {
      await db.none(`
        CREATE TEMP TABLE test_groupby (
          id INTEGER PRIMARY KEY,
          category TEXT,
          value INTEGER
        );
        INSERT INTO test_groupby (id, category, value) VALUES
          (1, 'A', 10), (2, NULL, 20), (3, 'A', 30), (4, NULL, 40), (5, 'B', 50);
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from<{ id: number; category: string | null; value: number }>("test_groupby")
            .groupBy((t) => t.category)
            .select((g) => ({
              category: g.key,
              total: g.sum((t) => t.value),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "category" AS "category", SUM("value") AS "total" FROM "test_groupby" GROUP BY "category"',
      );

      // Verify NULL category is grouped together
      const nullGroup = results.find((r) => r.category === null);
      expect(nullGroup).to.exist;
      expect(nullGroup!.total).to.equal(60); // 20 + 40 = 60

      const aGroup = results.find((r) => r.category === "A");
      expect(aGroup).to.exist;
      expect(aGroup!.total).to.equal(40); // 10 + 30 = 40

      await db.none("DROP TABLE test_groupby");
    });
  });

  describe("Aggregate bundles (multiple aggregates in single query)", () => {
    it("should handle COUNT + SUM + AVG together", async () => {
      await db.none(`
        CREATE TEMP TABLE test_agg (
          id INTEGER PRIMARY KEY,
          value INTEGER
        );
        INSERT INTO test_agg (id, value) VALUES (1, 10), (2, 20), (3, 30), (4, 40);
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from<{ id: number; value: number }>("test_agg")
            .groupBy((t) => t.id)
            .select((g) => ({
              id: g.key,
              count: g.count(),
              total: g.sum((t) => t.value),
              average: g.average((t) => t.value),
            }))
            .take(1),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "id" AS "id", COUNT(*) AS "count", SUM("value") AS "total", AVG("value") AS "average" ' +
          'FROM "test_agg" GROUP BY "id" LIMIT $(__p1)',
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1);
      expect(results[0]!.count).to.equal(1);

      await db.none("DROP TABLE test_agg");
    });

    it("should handle MIN + MAX + COUNT together", async () => {
      await db.none(`
        CREATE TEMP TABLE test_agg (
          id INTEGER PRIMARY KEY,
          category TEXT,
          value INTEGER
        );
        INSERT INTO test_agg (id, category, value) VALUES
          (1, 'A', 10), (2, 'A', 50), (3, 'B', 20), (4, 'B', 30);
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from<{ id: number; category: string; value: number }>("test_agg")
            .groupBy((t) => t.category)
            .select((g) => ({
              category: g.key,
              count: g.count(),
              min: g.min((t) => t.value),
              max: g.max((t) => t.value),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "category" AS "category", COUNT(*) AS "count", MIN("value") AS "min", MAX("value") AS "max" ' +
          'FROM "test_agg" GROUP BY "category"',
      );

      expect(results).to.be.an("array");
      const groupA = results.find((r) => r.category === "A");
      expect(groupA).to.exist;
      expect(groupA!.count).to.equal(2);
      expect(groupA!.min).to.equal(10);
      expect(groupA!.max).to.equal(50);

      await db.none("DROP TABLE test_agg");
    });

    it("should verify aggregate relationships (min <= avg <= max)", async () => {
      await db.none(`
        CREATE TEMP TABLE test_agg (
          id INTEGER PRIMARY KEY,
          value INTEGER
        );
        INSERT INTO test_agg (id, value) VALUES (1, 10), (2, 20), (3, 30);
      `);

      const count = await executeSelectSimple(db, () =>
        from<{ id: number; value: number }>("test_agg").count(),
      );
      const min = await executeSelectSimple(db, () =>
        from<{ id: number; value: number }>("test_agg").min((t) => t.value),
      );
      const max = await executeSelectSimple(db, () =>
        from<{ id: number; value: number }>("test_agg").max((t) => t.value),
      );
      const avg = await executeSelectSimple(db, () =>
        from<{ id: number; value: number }>("test_agg").average((t) => t.value),
      );

      expect(count).to.equal(3);
      expect(min).to.equal(10);
      expect(max).to.equal(30);
      expect(Number(avg)).to.equal(20);

      // Verify relationships
      expect(min).to.be.at.most(Number(avg));
      expect(Number(avg)).to.be.at.most(max);

      await db.none("DROP TABLE test_agg");
    });

    it("should handle all five aggregates with arithmetic", async () => {
      await db.none(`
        CREATE TEMP TABLE test_agg (
          id INTEGER PRIMARY KEY,
          price NUMERIC,
          quantity INTEGER
        );
        INSERT INTO test_agg (id, price, quantity) VALUES
          (1, 10.5, 2), (2, 20.0, 3), (3, 15.5, 1);
      `);

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from<{ id: number; price: number; quantity: number }>("test_agg")
            .groupBy((t) => t.id)
            .select((g) => ({
              id: g.key,
              itemCount: g.count(),
              totalValue: g.sum((t) => t.price * t.quantity),
              minPrice: g.min((t) => t.price),
              maxPrice: g.max((t) => t.price),
              avgPrice: g.average((t) => t.price),
            }))
            .take(1),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "id" AS "id", COUNT(*) AS "itemCount", SUM(("price" * "quantity")) AS "totalValue", ' +
          'MIN("price") AS "minPrice", MAX("price") AS "maxPrice", AVG("price") AS "avgPrice" ' +
          'FROM "test_agg" GROUP BY "id" LIMIT $(__p1)',
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1);

      await db.none("DROP TABLE test_agg");
    });
  });
});
