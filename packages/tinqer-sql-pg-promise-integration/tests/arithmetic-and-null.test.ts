/**
 * Arithmetic operations and NULL handling integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("PostgreSQL Integration - Arithmetic and NULL Operations", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("Arithmetic operations", () => {
    it("should handle addition in SELECT", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "products").select((p) => ({
          name: p.name,
          price: p.price,
          priceWithTax: p.price * 1.1,
          priceWithShipping: p.price + 10,
        })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.priceWithTax).to.be.closeTo(r.price * 1.1, 0.01);
        expect(r.priceWithShipping).to.equal(r.price + 10);
      });
    });

    it("should handle subtraction and multiplication", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "order_items").select((oi) => ({
          orderId: oi.order_id,
          quantity: oi.quantity,
          unitPrice: oi.unit_price,
          totalPrice: oi.quantity * oi.unit_price,
          bulkDiscount: oi.quantity * oi.unit_price * 0.9,
        })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.totalPrice).to.equal(r.quantity * r.unitPrice);
        expect(r.bulkDiscount).to.be.closeTo(r.totalPrice * 0.9, 0.01);
      });
    });

    it("should handle division", async () => {
      const results = await executeSimple(
        db,
        () =>
          from(dbContext, "products")
            .select((p) => ({
              name: p.name,
              price: p.price,
              stock: p.stock,
              pricePerUnit: p.price / p.stock,
            }))
            .where((p) => p.stock > 0), // Avoid division by zero
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.pricePerUnit).to.be.closeTo(r.price / r.stock, 0.01);
      });
    });

    it("should handle modulo operations", async () => {
      const evenUsers = await executeSimple(db, () =>
        from(dbContext, "users")
          .where((u) => u.id % 2 === 0)
          .select((u) => ({ id: u.id, name: u.name })),
      );

      const oddUsers = await executeSimple(db, () =>
        from(dbContext, "users")
          .where((u) => u.id % 2 === 1)
          .select((u) => ({ id: u.id, name: u.name })),
      );

      expect(evenUsers).to.be.an("array");
      expect(oddUsers).to.be.an("array");
      evenUsers.forEach((u) => expect(u.id % 2).to.equal(0));
      oddUsers.forEach((u) => expect(u.id % 2).to.equal(1));
    });

    it("should handle complex arithmetic expressions", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "products")
          .where((p) => (p.price * p.stock) / 100 > 10)
          .select((p) => ({
            name: p.name,
            inventoryValue: p.price * p.stock,
            scaledValue: (p.price * p.stock) / 100,
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.scaledValue).to.be.greaterThan(10);
        expect(r.scaledValue).to.be.closeTo(r.inventoryValue / 100, 0.01);
      });
    });

    it("should handle arithmetic in GROUP BY aggregates", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "order_items")
          .groupBy((oi) => oi.order_id)
          .select((g) => ({
            orderId: g.key,
            totalQuantity: g.sum((oi) => oi.quantity),
            totalValue: g.sum((oi) => oi.quantity * oi.unit_price),
            avgItemValue: g.average((oi) => oi.unit_price),
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.totalQuantity).to.be.greaterThan(0);
        expect(r.totalValue).to.be.greaterThan(0);
        expect(r.avgItemValue).to.be.greaterThan(0);
      });
    });
  });

  describe("NULL handling", () => {
    it("should handle IS NULL comparisons", async () => {
      // First, let's insert a user with NULL age for testing
      await db.none(`
        INSERT INTO users (name, email, age, department_id, is_active)
        VALUES ('Test Null User', 'testnull@example.com', NULL, 1, true)
        ON CONFLICT (email) DO UPDATE SET age = NULL
      `);

      const nullAgeUsers = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.age === null),
      );

      const nonNullAgeUsers = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.age !== null),
      );

      expect(nullAgeUsers).to.be.an("array");
      expect(nonNullAgeUsers).to.be.an("array");

      nullAgeUsers.forEach((u) => {
        expect(u.age).to.be.null;
      });

      nonNullAgeUsers.forEach((u) => {
        expect(u.age).to.not.be.null;
      });

      // Clean up
      await db.none(`DELETE FROM users WHERE email = 'testnull@example.com'`);
    });

    it("should handle NULL in arithmetic operations", async () => {
      // Insert test data with NULL values
      await db.none(`
        INSERT INTO products (name, price, stock, category, description)
        VALUES ('Test Null Product', 99.99, NULL, 'Test', 'Test product with null stock')
        ON CONFLICT DO NOTHING
      `);

      const results = await executeSimple(db, () =>
        from(dbContext, "products")
          .where((p) => p.name === "Test Null Product")
          .select((p) => ({
            name: p.name,
            stock: p.stock,
            hasStock: p.stock !== null,
          })),
      );

      if (results.length > 0) {
        expect(results[0]!.stock).to.be.null;
        expect(results[0]!.hasStock).to.be.false;
      }

      // Clean up
      await db.none(`DELETE FROM products WHERE name = 'Test Null Product'`);
    });

    it("should handle COALESCE-like operations with ??", async () => {
      // Insert test data
      await db.none(`
        INSERT INTO departments (id, name, budget)
        VALUES (999, 'Test Dept', NULL)
        ON CONFLICT (id) DO UPDATE SET budget = NULL
      `);

      const results = await executeSimple(db, () =>
        from(dbContext, "departments")
          .where((d) => d.id === 999)
          .select((d) => ({
            name: d.name,
            budget: d.budget ?? 0, // COALESCE(budget, 0)
          })),
      );

      expect(results).to.be.an("array");
      if (results.length > 0) {
        expect(results[0]!.budget).to.equal(0);
      }

      // Clean up
      await db.none(`DELETE FROM departments WHERE id = 999`);
    });

    it("should handle NULL in string operations", async () => {
      // Test that NULL descriptions are handled properly
      await db.none(`
        INSERT INTO products (id, name, price, stock, category, description)
        VALUES (999, 'No Description Product', 49.99, 10, 'Test', NULL)
        ON CONFLICT (id) DO UPDATE SET description = NULL
      `);

      const withDescription = await executeSimple(db, () =>
        from(dbContext, "products").where(
          (p) => p.description !== null && p.description.includes("laptop"),
        ),
      );

      const withoutDescription = await executeSimple(db, () =>
        from(dbContext, "products").where((p) => p.description === null),
      );

      expect(withDescription).to.be.an("array");
      expect(withoutDescription).to.be.an("array");

      withDescription.forEach((p) => {
        expect(p.description).to.not.be.null;
      });

      withoutDescription.forEach((p) => {
        expect(p.description).to.be.null;
      });

      // Clean up
      await db.none(`DELETE FROM products WHERE id = 999`);
    });

    it("should handle NULL in JOIN conditions", async () => {
      // Users with NULL department_id shouldn't appear in inner join
      await db.none(`
        INSERT INTO users (id, name, email, age, department_id, is_active)
        VALUES (999, 'No Dept User', 'nodept@example.com', 30, NULL, true)
        ON CONFLICT (id) DO UPDATE SET department_id = NULL
      `);

      const joinResults = await executeSimple(db, () =>
        from(dbContext, "users").join(
          from(dbContext, "departments"),
          (u) => u.department_id,
          (d) => d.id,
          (u, d) => ({
            userName: u.name,
            deptName: d.name,
          }),
        ),
      );

      // User with NULL department_id should not appear in results
      const hasNoDeptUser = joinResults.some((r) => r.userName === "No Dept User");
      expect(hasNoDeptUser).to.be.false;

      // Clean up
      await db.none(`DELETE FROM users WHERE id = 999`);
    });

    it("should handle NULL in aggregates", async () => {
      // Insert test data with some NULL ages
      await db.none(`
        INSERT INTO users (id, name, email, age, department_id, is_active)
        VALUES
          (997, 'Null Age 1', 'nullage1@example.com', NULL, 1, true),
          (998, 'Null Age 2', 'nullage2@example.com', NULL, 1, true)
        ON CONFLICT (id) DO UPDATE SET age = NULL
      `);

      // COUNT should count rows with NULL
      const totalCount = await executeSimple(db, () => from(dbContext, "users").count());

      // AVG, SUM, MIN, MAX ignore NULL values
      const avgAge = await executeSimple(db, () =>
        from(dbContext, "users")
          .where((u) => u.age !== null)
          .average((u) => u.age!),
      );

      expect(totalCount).to.be.a("number");
      expect(avgAge).to.be.a("number");

      // Average should only consider non-NULL values
      const nonNullAges = await executeSimple(db, () =>
        from(dbContext, "users")
          .where((u) => u.age !== null)
          .select((u) => ({ age: u.age })),
      );

      const manualAvg = nonNullAges.reduce((sum, u) => sum + u.age!, 0) / nonNullAges.length;
      expect(avgAge).to.be.closeTo(manualAvg, 0.1);

      // Clean up
      await db.none(`DELETE FROM users WHERE id IN (997, 998)`);
    });
  });

  describe("Boolean operations", () => {
    it("should handle boolean fields directly", async () => {
      const activeUsers = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.is_active),
      );

      const inactiveUsers = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => !u.is_active),
      );

      expect(activeUsers).to.be.an("array");
      expect(inactiveUsers).to.be.an("array");

      activeUsers.forEach((u) => {
        expect(u.is_active).to.be.true;
      });

      inactiveUsers.forEach((u) => {
        expect(u.is_active).to.be.false;
      });
    });

    it("should handle boolean comparisons", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "users").where(
          (u) => u.is_active === true && u.age !== null && u.age >= 30,
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((u) => {
        expect(u.is_active).to.be.true;
        expect(u.age).to.be.at.least(30);
      });
    });

    it("should handle complex boolean logic", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "users").where(
          (u) =>
            (u.is_active && u.age !== null && u.age < 30) ||
            (!u.is_active && u.age !== null && u.age >= 40),
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((u) => {
        const condition1 = u.is_active && u.age !== null && u.age < 30;
        const condition2 = !u.is_active && u.age !== null && u.age >= 40;
        expect(condition1 || condition2).to.be.true;
      });
    });
  });
});
