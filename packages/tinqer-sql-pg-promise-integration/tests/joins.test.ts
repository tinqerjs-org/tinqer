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
      const results = await executeSimple(db, () =>
        from(dbContext, "users").join(
          from(dbContext, "departments"),
          (u) => u.department_id,
          (d) => d.id,
          (u, d) => ({
            userId: u.id,
            userName: u.name,
            userEmail: u.email,
            departmentId: d.id,
            departmentName: d.name,
          }),
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r).to.have.property("userId");
        expect(r).to.have.property("userName");
        expect(r).to.have.property("userEmail");
        expect(r).to.have.property("departmentId");
        expect(r).to.have.property("departmentName");
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
            (oi, o) => ({
              orderItemId: oi.id,
              productId: oi.product_id,
              quantity: oi.quantity,
              unitPrice: oi.unit_price,
              orderId: o.id,
              orderStatus: o.status,
              orderUserId: o.user_id,
            }),
          )
          .join(
            from(dbContext, "products"),
            (joined) => joined.productId,
            (p) => p.id,
            (joined, p) => ({
              orderItemId: joined.orderItemId,
              orderId: joined.orderId,
              orderStatus: joined.orderStatus,
              quantity: joined.quantity,
              unitPrice: joined.unitPrice,
              productId: p.id,
              productName: p.name,
            }),
          )
          .where((joined) => joined.orderStatus === "completed")
          .select((joined) => ({
            orderId: joined.orderId,
            productName: joined.productName,
            quantity: joined.quantity,
            unitPrice: joined.unitPrice,
            totalPrice: joined.quantity * joined.unitPrice,
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
            (u, d) => ({
              userId: u.id,
              userName: u.name,
              departmentId: d.id,
              departmentName: d.name,
            }),
          )
          .join(
            from(dbContext, "orders"),
            (joined) => joined.userId,
            (o) => o.user_id,
            (joined, o) => ({
              userId: joined.userId,
              userName: joined.userName,
              departmentName: joined.departmentName,
              orderId: o.id,
              orderTotal: o.total_amount,
            }),
          )
          .groupBy((joined) => ({ userName: joined.userName, deptName: joined.departmentName }))
          .select((g) => ({
            userName: g.key.userName,
            departmentName: g.key.deptName,
            orderCount: g.count(),
            totalRevenue: g.sum((joined) => joined.orderTotal),
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
            (oi, p) => ({
              orderItemId: oi.id,
              orderId: oi.order_id,
              quantity: oi.quantity,
              unitPrice: oi.unit_price,
              productId: p.id,
              productName: p.name,
            }),
          )
          .join(
            from(dbContext, "orders"),
            (joined) => joined.orderId,
            (o) => o.id,
            (joined, o) => ({
              orderItemId: joined.orderItemId,
              quantity: joined.quantity,
              unitPrice: joined.unitPrice,
              productId: joined.productId,
              productName: joined.productName,
              orderStatus: o.status,
            }),
          )
          .where((joined) => joined.orderStatus === "completed")
          .groupBy((joined) => ({ id: joined.productId, name: joined.productName }))
          .select((g) => ({
            productId: g.key.id,
            productName: g.key.name,
            unitsSold: g.sum((joined) => joined.quantity),
            revenue: g.sum((joined) => joined.quantity * joined.unitPrice),
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
            (u, o) => ({
              userId: u.id,
              userName: u.name,
              userEmail: u.email,
              orderId: o.id,
              orderAmount: o.total_amount,
              orderStatus: o.status,
            }),
          )
          .where((joined) => joined.orderAmount > 500)
          .select((joined) => ({
            customerId: joined.userId,
            customerName: joined.userName,
            customerEmail: joined.userEmail,
            orderId: joined.orderId,
            orderAmount: joined.orderAmount,
            orderStatus: joined.orderStatus,
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
            (d, u) => ({
              departmentId: d.id,
              departmentName: d.name,
              departmentBudget: d.budget,
              userId: u.id,
            }),
          )
          .join(
            from(dbContext, "orders"),
            (joined) => joined.userId,
            (o) => o.user_id,
            (joined, o) => ({
              departmentId: joined.departmentId,
              departmentName: joined.departmentName,
              departmentBudget: joined.departmentBudget,
              orderId: o.id,
              orderAmount: o.total_amount,
            }),
          )
          .groupBy((joined) => ({
            id: joined.departmentId,
            name: joined.departmentName,
            budget: joined.departmentBudget,
          }))
          .select((g) => ({
            departmentId: g.key.id,
            departmentName: g.key.name,
            budget: g.key.budget,
            totalSpending: g.sum((joined) => joined.orderAmount),
            orderCount: g.count(),
            avgOrderValue: g.average((joined) => joined.orderAmount),
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
