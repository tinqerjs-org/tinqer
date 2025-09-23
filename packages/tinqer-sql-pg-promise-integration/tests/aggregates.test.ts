/**
 * Aggregate function integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";

describe("PostgreSQL Integration - Aggregates", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("COUNT", () => {
    it("should count all users", async () => {
      const count = await executeSimple(db, () => from(db, "users").count());

      expect(count).to.be.a("number");
      expect(count).to.equal(10); // We inserted 10 users
    });

    it("should count with WHERE clause", async () => {
      const count = await executeSimple(db, () =>
        from(db, "users").count((u) => u.is_active === true),
      );

      expect(count).to.be.a("number");
      expect(count).to.be.lessThan(10); // Some users are inactive
    });

    it("should count with complex conditions", async () => {
      const count = await executeSimple(db, () =>
        from(db, "users")
          .where((u) => u.age >= 30)
          .count(),
      );

      expect(count).to.be.a("number");
      expect(count).to.be.greaterThan(0);
    });
  });

  describe("SUM", () => {
    it("should sum product prices", async () => {
      const sum = await executeSimple(db, () => from(db, "products").sum((p) => p.price));

      expect(sum).to.be.a("number");
      expect(sum).to.be.greaterThan(0);
    });

    it("should sum with WHERE clause", async () => {
      const sum = await executeSimple(db, () =>
        from(db, "products")
          .where((p) => p.category === "Electronics")
          .sum((p) => p.price),
      );

      expect(sum).to.be.a("number");
      expect(sum).to.be.greaterThan(0);
    });

    it("should sum order totals", async () => {
      const sum = await executeSimple(db, () => from(db, "orders").sum((o) => o.total_amount));

      expect(sum).to.be.a("number");
      expect(sum).to.be.greaterThan(0);
    });
  });

  describe("AVERAGE", () => {
    it("should calculate average user age", async () => {
      const avg = await executeSimple(db, () => from(db, "users").average((u) => u.age));

      expect(avg).to.be.a("number");
      expect(avg).to.be.greaterThan(20);
      expect(avg).to.be.lessThan(50);
    });

    it("should calculate average product price by category", async () => {
      const avgElectronics = await executeSimple(db, () =>
        from(db, "products")
          .where((p) => p.category === "Electronics")
          .average((p) => p.price),
      );

      const avgFurniture = await executeSimple(db, () =>
        from(db, "products")
          .where((p) => p.category === "Furniture")
          .average((p) => p.price),
      );

      expect(avgElectronics).to.be.a("number");
      expect(avgFurniture).to.be.a("number");
      expect(avgFurniture).to.be.greaterThan(avgElectronics); // Furniture is more expensive
    });
  });

  describe("MIN and MAX", () => {
    it("should find minimum and maximum ages", async () => {
      const minAge = await executeSimple(db, () => from(db, "users").min((u) => u.age));
      const maxAge = await executeSimple(db, () => from(db, "users").max((u) => u.age));

      expect(minAge).to.be.a("number");
      expect(maxAge).to.be.a("number");
      expect(minAge).to.be.lessThan(maxAge);
      expect(minAge).to.equal(25); // Jane is 25
      expect(maxAge).to.equal(55); // Henry is 55
    });

    it("should find min/max prices", async () => {
      const minPrice = await executeSimple(db, () => from(db, "products").min((p) => p.price));
      const maxPrice = await executeSimple(db, () => from(db, "products").max((p) => p.price));

      expect(minPrice).to.be.a("number");
      expect(maxPrice).to.be.a("number");
      expect(minPrice).to.equal(1.99); // Pen
      expect(maxPrice).to.equal(999.99); // Laptop
    });

    it("should find min/max with WHERE", async () => {
      const maxElectronicsPrice = await executeSimple(db, () =>
        from(db, "products")
          .where((p) => p.category === "Electronics")
          .max((p) => p.price),
      );

      expect(maxElectronicsPrice).to.equal(999.99);
    });
  });

  describe("GROUP BY", () => {
    it("should group users by department", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users")
          .groupBy((u) => u.department_id)
          .select((g) => ({
            department: g.key,
            count: g.count(),
          })),
      );

      expect(results).to.be.an("array");
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);
      expect(totalCount).to.equal(10); // Total users
    });

    it("should group products by category with aggregates", async () => {
      const results = await executeSimple(db, () =>
        from(db, "products")
          .groupBy((p) => p.category)
          .select((g) => ({
            category: g.key,
            count: g.count(),
            avgPrice: g.average((p) => p.price),
            totalStock: g.sum((p) => p.stock),
          })),
      );

      expect(results).to.be.an("array");
      results.forEach((r) => {
        expect(r).to.have.property("category");
        expect(r).to.have.property("count");
        expect(r).to.have.property("avgPrice");
        expect(r).to.have.property("totalStock");
      });
    });

    it("should group with WHERE clause", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users")
          .where((u) => u.is_active === true)
          .groupBy((u) => u.department_id)
          .select((g) => ({
            department: g.key,
            activeUsers: g.count(),
            avgAge: g.average((u) => u.age),
          })),
      );

      expect(results).to.be.an("array");
      results.forEach((r) => {
        expect(r.activeUsers).to.be.greaterThan(0);
      });
    });

    it("should group orders by status", async () => {
      const results = await executeSimple(db, () =>
        from(db, "orders")
          .groupBy((o) => o.status)
          .select((g) => ({
            status: g.key,
            orderCount: g.count(),
            totalRevenue: g.sum((o) => o.total_amount),
            avgOrderValue: g.average((o) => o.total_amount),
          })),
      );

      expect(results).to.be.an("array");
      const statuses = results.map((r) => r.status);
      expect(statuses).to.include.members(["completed", "pending", "shipped"]);
    });
  });
});