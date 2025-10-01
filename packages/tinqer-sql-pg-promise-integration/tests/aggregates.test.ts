/**
 * Aggregate function integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSimple } from "@webpods/tinqer-sql-pg-promise";
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

      const count = await executeSimple(db, () => from(dbContext, "users").count(), {
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

      const count = await executeSimple(
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

      const count = await executeSimple(
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

      const sum = await executeSimple(db, () => from(dbContext, "products").sum((p) => p.price), {
        onSql: (result) => {
          capturedSql = result;
        },
      });

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT SUM("price") FROM "products"');
      expect(capturedSql!.params).to.deep.equal({});

      expect(sum).to.be.a("number");
      expect(sum).to.be.greaterThan(0);
    });

    it("should sum with WHERE clause", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const sum = await executeSimple(
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

      const sum = await executeSimple(
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

      const avg = await executeSimple(
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

      const avgElectronics = await executeSimple(
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

      const avgFurniture = await executeSimple(
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

      const minAge = await executeSimple(
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

      const maxAge = await executeSimple(
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

      const minPrice = await executeSimple(
        db,
        () => from(dbContext, "products").min((p) => p.price),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const maxPrice = await executeSimple(
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

      const maxElectronicsPrice = await executeSimple(
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

      const results = await executeSimple(
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

      const results = await executeSimple(
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

      const results = await executeSimple(
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

      const results = await executeSimple(
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
});
