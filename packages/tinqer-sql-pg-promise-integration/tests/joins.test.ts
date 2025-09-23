/**
 * JOIN operation integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";


describe("PostgreSQL Integration - JOINs", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("INNER JOIN", () => {
    it("should join users with departments", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users")
          .join(
            from(db, "departments"),
            (u, d) => u.department_id === d.id,
          )
          .select((u, d) => ({
            userName: u.name,
            userEmail: u.email,
            departmentName: d.name,
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r).to.have.property("userName");
        expect(r).to.have.property("userEmail");
        expect(r).to.have.property("departmentName");
      });
    });

    it("should join orders with users", async () => {
      const results = await executeSimple(db, () =>
        from(db, "orders")
          .join(
            from(db, "users"),
            (o, u) => o.user_id === u.id,
          )
          .select((o, u) => ({
            orderId: o.id,
            orderTotal: o.total_amount,
            customerName: u.name,
            customerEmail: u.email,
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(10); // We have 10 orders
      results.forEach((r) => {
        expect(r).to.have.property("orderId");
        expect(r).to.have.property("orderTotal");
        expect(r).to.have.property("customerName");
        expect(r).to.have.property("customerEmail");
      });
    });

    it("should join with WHERE clause", async () => {
      const results = await executeSimple(db, () =>
        from(db, "orders")
          .join(
            from(db, "users"),
            (o, u) => o.user_id === u.id,
          )
          .where((o) => o.status === "completed")
          .select((o, u) => ({
            orderId: o.id,
            customerName: u.name,
            total: o.total_amount,
          })),
      );

      expect(results).to.be.an("array");
      results.forEach((r) => {
        expect(r).to.have.property("orderId");
        expect(r).to.have.property("customerName");
        expect(r).to.have.property("total");
      });
    });

    it("should join with aggregates", async () => {
      const results = await executeSimple(db, () =>
        from(db, "orders")
          .join(
            from(db, "users"),
            (o, u) => o.user_id === u.id,
          )
          .groupBy((o, u) => u.name)
          .select((g) => ({
            customerName: g.key,
            orderCount: g.count(),
            totalSpent: g.sum((o) => o.total_amount),
          })),
      );

      expect(results).to.be.an("array");
      results.forEach((r) => {
        expect(r).to.have.property("customerName");
        expect(r).to.have.property("orderCount");
        expect(r).to.have.property("totalSpent");
        expect(r.orderCount).to.be.greaterThan(0);
        expect(r.totalSpent).to.be.greaterThan(0);
      });
    });
  });

  describe("Multiple JOINs", () => {
    it("should join order_items with orders and products", async () => {
      const results = await executeSimple(db, () =>
        from(db, "order_items")
          .join(
            from(db, "orders"),
            (oi, o) => oi.order_id === o.id,
          )
          .join(
            from(db, "products"),
            (oi, o, p) => oi.product_id === p.id,
          )
          .where((oi, o) => o.status === "completed")
          .select((oi, o, p) => ({
            orderId: o.id,
            productName: p.name,
            quantity: oi.quantity,
            unitPrice: oi.unit_price,
            totalPrice: oi.quantity * oi.unit_price,
          })),
      );

      expect(results).to.be.an("array");
      results.forEach((r) => {
        expect(r).to.have.property("orderId");
        expect(r).to.have.property("productName");
        expect(r).to.have.property("quantity");
        expect(r).to.have.property("unitPrice");
        expect(r).to.have.property("totalPrice");
        expect(r.totalPrice).to.equal(r.quantity * r.unitPrice);
      });
    });

    it("should join users with departments and count orders", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users")
          .join(
            from(db, "departments"),
            (u, d) => u.department_id === d.id,
          )
          .join(
            from(db, "orders"),
            (u, d, o) => u.id === o.user_id,
          )
          .groupBy((u, d) => ({ userName: u.name, deptName: d.name }))
          .select((g) => ({
            userName: g.key.userName,
            departmentName: g.key.deptName,
            orderCount: g.count(),
            totalRevenue: g.sum((u, d, o) => o.total_amount),
          })),
      );

      expect(results).to.be.an("array");
      results.forEach((r) => {
        expect(r).to.have.property("userName");
        expect(r).to.have.property("departmentName");
        expect(r).to.have.property("orderCount");
        expect(r).to.have.property("totalRevenue");
      });
    });
  });

  describe("Complex JOIN scenarios", () => {
    it("should find top products by revenue", async () => {
      const results = await executeSimple(db, () =>
        from(db, "order_items")
          .join(
            from(db, "products"),
            (oi, p) => oi.product_id === p.id,
          )
          .join(
            from(db, "orders"),
            (oi, p, o) => oi.order_id === o.id,
          )
          .where((oi, p, o) => o.status === "completed")
          .groupBy((oi, p) => ({ id: p.id, name: p.name }))
          .select((g) => ({
            productId: g.key.id,
            productName: g.key.name,
            unitsSold: g.sum((oi) => oi.quantity),
            revenue: g.sum((oi) => oi.quantity * oi.unit_price),
          }))
          .orderByDescending((p) => p.revenue)
          .take(5),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.at.most(5);

      // Check that results are properly ordered by revenue
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].revenue).to.be.at.least(results[i].revenue);
      }
    });

    it("should find customers with high-value orders", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users")
          .join(
            from(db, "orders"),
            (u, o) => u.id === o.user_id,
          )
          .where((u, o) => o.total_amount > 500)
          .select((u, o) => ({
            customerId: u.id,
            customerName: u.name,
            customerEmail: u.email,
            orderId: o.id,
            orderAmount: o.total_amount,
            orderStatus: o.status,
          }))
          .orderByDescending((r) => r.orderAmount),
      );

      expect(results).to.be.an("array");
      results.forEach((r) => {
        expect(r.orderAmount).to.be.greaterThan(500);
      });
    });

    it("should analyze department spending", async () => {
      const results = await executeSimple(db, () =>
        from(db, "departments")
          .join(
            from(db, "users"),
            (d, u) => d.id === u.department_id,
          )
          .join(
            from(db, "orders"),
            (d, u, o) => u.id === o.user_id,
          )
          .groupBy((d) => ({ id: d.id, name: d.name, budget: d.budget }))
          .select((g) => ({
            departmentId: g.key.id,
            departmentName: g.key.name,
            budget: g.key.budget,
            totalSpending: g.sum((d, u, o) => o.total_amount),
            orderCount: g.count(),
            avgOrderValue: g.average((d, u, o) => o.total_amount),
          })),
      );

      expect(results).to.be.an("array");
      results.forEach((r) => {
        expect(r).to.have.property("departmentId");
        expect(r).to.have.property("departmentName");
        expect(r).to.have.property("budget");
        expect(r).to.have.property("totalSpending");
        expect(r).to.have.property("orderCount");
        expect(r).to.have.property("avgOrderValue");
      });
    });
  });
});