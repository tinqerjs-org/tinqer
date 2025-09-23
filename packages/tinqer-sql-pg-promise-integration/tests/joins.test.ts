/**
 * JOIN operation integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("PostgreSQL Integration - JOINs", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("INNER JOIN", () => {
    it("should join users with departments", async () => {
      // Note: JOIN result selector is currently ignored by the parser
      // This returns all columns from both tables, not the projected result
      const results = await executeSimple(db, () =>
        from(dbContext, "users").join(
          from(dbContext, "departments"),
          (u) => u.department_id,
          (d) => d.id,
          (u, d) => ({ u, d }), // Result selector is ignored
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        // The JOIN returns all columns from both tables
        expect(r).to.have.property("name"); // From users or departments
        expect(r).to.have.property("email"); // From users
        expect(r).to.have.property("id"); // From both tables
      });
    });

    it("should join orders with users", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "orders").join(
          from(dbContext, "users"),
          (o) => o.user_id,
          (u) => u.id,
          (o, u) => ({
            orderId: o.id,
            orderTotal: o.total_amount,
            customerName: u.name,
            customerEmail: u.email,
          }),
        ),
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
        from(dbContext, "orders")
          .join(
            from(dbContext, "users"),
            (o) => o.user_id,
            (u) => u.id,
            (o, u) => ({
              order_id: o.id,
              order_status: o.status,
              order_total: o.total_amount,
              user_name: u.name,
              user_id: u.id,
            }),
          )
          .where((joined) => joined.order_status === "completed")
          .select((joined) => ({
            orderId: joined.order_id,
            customerName: joined.user_name,
            total: joined.order_total,
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r).to.have.property("orderId");
        expect(r).to.have.property("customerName");
        expect(r).to.have.property("total");
      });
    });

    it("should join with aggregates", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "orders")
          .join(
            from(dbContext, "users"),
            (o) => o.user_id,
            (u) => u.id,
            (o, u) => ({
              order_id: o.id,
              order_total: o.total_amount,
              user_name: u.name,
              user_id: u.id,
            }),
          )
          .groupBy((joined) => joined.user_name)
          .select((g) => ({
            customerName: g.key,
            orderCount: g.count(),
            totalSpent: g.sum((joined) => joined.order_total),
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
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
        from(dbContext, "order_items")
          .join(
            from(dbContext, "orders"),
            (oi) => oi.order_id,
            (o) => o.id,
            (oi, o) => ({ orderItem: oi, order: o }),
          )
          .join(
            from(dbContext, "products"),
            (joined) => joined.orderItem.product_id,
            (p) => p.id,
            (joined, p) => ({ ...joined, product: p }),
          )
          .where((joined) => joined.order.status === "completed")
          .select((joined) => ({
            orderId: joined.order.id,
            productName: joined.product.name,
            quantity: joined.orderItem.quantity,
            unitPrice: joined.orderItem.unit_price,
            totalPrice: joined.orderItem.quantity * joined.orderItem.unit_price,
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
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
        from(dbContext, "users")
          .join(
            from(dbContext, "departments"),
            (u) => u.department_id,
            (d) => d.id,
            (u, d) => ({ user: u, department: d }),
          )
          .join(
            from(dbContext, "orders"),
            (joined) => joined.user.id,
            (o) => o.user_id,
            (joined, o) => ({ ...joined, order: o }),
          )
          .groupBy((joined) => ({ userName: joined.user.name, deptName: joined.department.name }))
          .select((g) => ({
            userName: g.key.userName,
            departmentName: g.key.deptName,
            orderCount: g.count(),
            totalRevenue: g.sum((joined) => joined.order.total_amount),
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
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
        from(dbContext, "order_items")
          .join(
            from(dbContext, "products"),
            (oi) => oi.product_id,
            (p) => p.id,
            (oi, p) => ({ orderItem: oi, product: p }),
          )
          .join(
            from(dbContext, "orders"),
            (joined) => joined.orderItem.order_id,
            (o) => o.id,
            (joined, o) => ({ ...joined, order: o }),
          )
          .where((joined) => joined.order.status === "completed")
          .groupBy((joined) => ({ id: joined.product.id, name: joined.product.name }))
          .select((g) => ({
            productId: g.key.id,
            productName: g.key.name,
            unitsSold: g.sum((joined) => joined.orderItem.quantity),
            revenue: g.sum((joined) => joined.orderItem.quantity * joined.orderItem.unit_price),
          }))
          .orderByDescending((p) => p.revenue)
          .take(5),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.at.most(5);

      // Check that results are properly ordered by revenue
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.revenue).to.be.at.least(results[i]!.revenue);
      }
    });

    it("should find customers with high-value orders", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "users")
          .join(
            from(dbContext, "orders"),
            (u) => u.id,
            (o) => o.user_id,
            (u, o) => ({ user: u, order: o }),
          )
          .where((joined) => joined.order.total_amount > 500)
          .select((joined) => ({
            customerId: joined.user.id,
            customerName: joined.user.name,
            customerEmail: joined.user.email,
            orderId: joined.order.id,
            orderAmount: joined.order.total_amount,
            orderStatus: joined.order.status,
          }))
          .orderByDescending((r) => r.orderAmount),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.orderAmount).to.be.greaterThan(500);
      });
    });

    it("should analyze department spending", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "departments")
          .join(
            from(dbContext, "users"),
            (d) => d.id,
            (u) => u.department_id,
            (d, u) => ({ department: d, user: u }),
          )
          .join(
            from(dbContext, "orders"),
            (joined) => joined.user.id,
            (o) => o.user_id,
            (joined, o) => ({ ...joined, order: o }),
          )
          .groupBy((joined) => ({
            id: joined.department.id,
            name: joined.department.name,
            budget: joined.department.budget,
          }))
          .select((g) => ({
            departmentId: g.key.id,
            departmentName: g.key.name,
            budget: g.key.budget,
            totalSpending: g.sum((joined) => joined.order.total_amount),
            orderCount: g.count(),
            avgOrderValue: g.average((joined) => joined.order.total_amount),
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
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
