/**
 * JOIN operation integration tests with real Better SQLite3
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSelectSimple } from "@webpods/tinqer-sql-better-sqlite3";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("Better SQLite3 Integration - JOINs", () => {
  before(() => {
    setupTestDatabase(db);
  });

  describe("INNER JOIN", () => {
    it("should join users with departments", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
            .join(
              from(dbContext, "departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .select((joined) => ({
              userId: joined.u.id,
              userName: joined.u.name,
              userEmail: joined.u.email,
              departmentId: joined.d.id,
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
        'SELECT "t0"."id" AS "userId", "t0"."name" AS "userName", "t0"."email" AS "userEmail", ' +
          '"t1"."id" AS "departmentId", "t1"."name" AS "departmentName" ' +
          'FROM "users" AS "t0" INNER JOIN "departments" AS "t1" ON "t0"."department_id" = "t1"."id"',
      );
      expect(capturedSql!.params).to.deep.equal({});

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

    it("should join orders with users", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        () =>
          from(dbContext, "orders")
            .join(
              from(dbContext, "users"),
              (o) => o.user_id,
              (u) => u.id,
              (o, u) => ({ o, u }),
            )
            .select((joined) => ({
              orderId: joined.o.id,
              orderTotal: joined.o.total_amount,
              customerName: joined.u.name,
              customerEmail: joined.u.email,
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."id" AS "orderId", "t0"."total_amount" AS "orderTotal", ' +
          '"t1"."name" AS "customerName", "t1"."email" AS "customerEmail" ' +
          'FROM "orders" AS "t0" INNER JOIN "users" AS "t1" ON "t0"."user_id" = "t1"."id"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.equal(10); // We have 10 orders
      results.forEach((r) => {
        expect(r).to.have.property("orderId");
        expect(r).to.have.property("orderTotal");
        expect(r).to.have.property("customerName");
        expect(r).to.have.property("customerEmail");
      });
    });

    it("should join with WHERE clause", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        () =>
          from(dbContext, "orders")
            .join(
              from(dbContext, "users"),
              (o) => o.user_id,
              (u) => u.id,
              (o, u) => ({ o, u }),
            )
            .where((joined) => joined.o.status === "completed")
            .select((joined) => ({
              orderId: joined.o.id,
              customerName: joined.u.name,
              total: joined.o.total_amount,
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."id" AS "orderId", "t1"."name" AS "customerName", "t0"."total_amount" AS "total" ' +
          'FROM "orders" AS "t0" INNER JOIN "users" AS "t1" ON "t0"."user_id" = "t1"."id" ' +
          'WHERE "t0"."status" = @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "completed" });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r).to.have.property("orderId");
        expect(r).to.have.property("customerName");
        expect(r).to.have.property("total");
      });
    });

    it("should join with aggregates", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        () =>
          from(dbContext, "orders")
            .join(
              from(dbContext, "users"),
              (o) => o.user_id,
              (u) => u.id,
              (o, u) => ({ o, u }),
            )
            .groupBy((joined) => joined.u.name)
            .select((g) => ({
              customerName: g.key,
              orderCount: g.count(),
              totalSpent: g.sum((item) => item.o.total_amount),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t1"."name" AS "customerName", COUNT(*) AS "orderCount", SUM("t0"."total_amount") AS "totalSpent" ' +
          'FROM "orders" AS "t0" INNER JOIN "users" AS "t1" ON "t0"."user_id" = "t1"."id" ' +
          'GROUP BY "t1"."name"',
      );
      expect(capturedSql!.params).to.deep.equal({});

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
    it("should join order_items with orders and products", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        () =>
          from(dbContext, "order_items")
            .join(
              from(dbContext, "orders"),
              (oi) => oi.order_id,
              (o) => o.id,
              (oi, o) => ({ oi, o }),
            )
            .join(
              from(dbContext, "products"),
              (joined) => joined.oi.product_id,
              (p) => p.id,
              (joined, p) => ({ ...joined, p }),
            )
            .where((result) => result.o.status === "completed")
            .select((result) => ({
              orderId: result.o.id,
              productName: result.p.name,
              quantity: result.oi.quantity,
              unitPrice: result.oi.unit_price,
              totalPrice: result.oi.quantity * result.oi.unit_price,
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t1"."id" AS "orderId", "t2"."name" AS "productName", "t0"."quantity" AS "quantity", ' +
          '"t0"."unit_price" AS "unitPrice", ("t0"."quantity" * "t0"."unit_price") AS "totalPrice" ' +
          'FROM "order_items" AS "t0" INNER JOIN "orders" AS "t1" ON "t0"."order_id" = "t1"."id" ' +
          'INNER JOIN "products" AS "t2" ON "t0"."product_id" = "t2"."id" ' +
          'WHERE "t1"."status" = @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "completed" });

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

    it("should join users with departments and count orders - LIMITATION: pass-through properties in chained JOINs", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
            .join(
              from(dbContext, "departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .join(
              from(dbContext, "orders"),
              (joined) => joined.u.id,
              (o) => o.user_id,
              (joined, o) => ({ ...joined, o }),
            )
            .groupBy((result) => ({ userName: result.u.name, deptName: result.d.name }))
            .select((g) => ({
              userName: g.key.userName,
              departmentName: g.key.deptName,
              orderCount: g.count(),
              totalRevenue: g.sum((item) => item.o.total_amount),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."name" AS "userName", "t1"."name" AS "departmentName", COUNT(*) AS "orderCount", SUM("t2"."total_amount") AS "totalRevenue" ' +
          'FROM "users" AS "t0" INNER JOIN "departments" AS "t1" ON "t0"."department_id" = "t1"."id" ' +
          'INNER JOIN "orders" AS "t2" ON "t0"."id" = "t2"."user_id" ' +
          'GROUP BY "t0"."name", "t1"."name"',
      );
      expect(capturedSql!.params).to.deep.equal({});

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

  describe("Self JOIN", () => {
    it("should join employees with their managers", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
            .join(
              from(dbContext, "users"),
              (e) => e.manager_id,
              (m) => m.id,
              (e, m) => ({ employee: e, manager: m }),
            )
            .select((joined) => ({
              employeeName: joined.employee.name,
              employeeEmail: joined.employee.email,
              managerName: joined.manager.name,
              managerEmail: joined.manager.email,
            }))
            .orderBy((r) => r.managerName)
            .thenBy((r) => r.employeeName),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."name" AS "employeeName", "t0"."email" AS "employeeEmail", ' +
          '"t1"."name" AS "managerName", "t1"."email" AS "managerEmail" ' +
          'FROM "users" AS "t0" INNER JOIN "users" AS "t1" ON "t0"."manager_id" = "t1"."id" ' +
          'ORDER BY "managerName" ASC, "employeeName" ASC',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);

      // Verify we have employee-manager relationships
      results.forEach((r) => {
        expect(r).to.have.property("employeeName");
        expect(r).to.have.property("employeeEmail");
        expect(r).to.have.property("managerName");
        expect(r).to.have.property("managerEmail");
      });

      // Check specific expected relationships
      const bobsManager = results.find((r) => r.employeeName === "Bob Johnson");
      expect(bobsManager?.managerName).to.equal("John Doe");

      const alicesManager = results.find((r) => r.employeeName === "Alice Brown");
      expect(alicesManager?.managerName).to.equal("Jane Smith");
    });

    it("should find employees in the same department as their manager", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
            .join(
              from(dbContext, "users"),
              (e) => e.manager_id,
              (m) => m.id,
              (e, m) => ({ employee: e, manager: m }),
            )
            .where((joined) => joined.employee.department_id === joined.manager.department_id)
            .select((joined) => ({
              employeeName: joined.employee.name,
              managerName: joined.manager.name,
              departmentId: joined.employee.department_id,
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."name" AS "employeeName", "t1"."name" AS "managerName", "t0"."department_id" AS "departmentId" ' +
          'FROM "users" AS "t0" INNER JOIN "users" AS "t1" ON "t0"."manager_id" = "t1"."id" ' +
          'WHERE "t0"."department_id" = "t1"."department_id"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);

      // All employees should be in the same department as their manager
      results.forEach((r) => {
        expect(r).to.have.property("departmentId");
      });

      // Check that Bob Johnson is in the same department as John Doe (both in Engineering)
      const bobResult = results.find((r) => r.employeeName === "Bob Johnson");
      expect(bobResult).to.exist;
      expect(bobResult?.managerName).to.equal("John Doe");
      expect(bobResult?.departmentId).to.equal(1); // Engineering department
    });
  });

  describe("Complex JOIN scenarios", () => {
    it("should find customers with high-value orders", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
            .join(
              from(dbContext, "orders"),
              (u) => u.id,
              (o) => o.user_id,
              (u, o) => ({ u, o }),
            )
            .where((joined) => joined.o.total_amount > 500)
            .select((joined) => ({
              customerId: joined.u.id,
              customerName: joined.u.name,
              customerEmail: joined.u.email,
              orderId: joined.o.id,
              orderAmount: joined.o.total_amount,
              orderStatus: joined.o.status,
            }))
            .orderByDescending((r) => r.orderAmount),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."id" AS "customerId", "t0"."name" AS "customerName", "t0"."email" AS "customerEmail", ' +
          '"t1"."id" AS "orderId", "t1"."total_amount" AS "orderAmount", "t1"."status" AS "orderStatus" ' +
          'FROM "users" AS "t0" INNER JOIN "orders" AS "t1" ON "t0"."id" = "t1"."user_id" ' +
          'WHERE "t1"."total_amount" > @__p1 ORDER BY "orderAmount" DESC',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 500 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.orderAmount).to.be.greaterThan(500);
      });
    });
  });

  describe("LINQ-style outer joins", () => {
    it("should convert groupJoin/selectMany/defaultIfEmpty into LEFT OUTER JOIN", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        () =>
          from(dbContext, "users")
            .groupJoin(
              from(dbContext, "departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, deptGroup) => ({ user: u, deptGroup }),
            )
            .selectMany(
              (g) => g.deptGroup.defaultIfEmpty(),
              (g, dept) => ({ user: g.user, dept }),
            )
            .select((row) => ({
              userId: row.user.id,
              departmentName: row.dept ? row.dept.name : null,
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."id" AS "userId", CASE WHEN "t1"."id" IS NOT NULL THEN "t1"."name" ELSE NULL END AS "departmentName" FROM "users" AS "t0" LEFT OUTER JOIN "departments" AS "t1" ON "t0"."department_id" = "t1"."id"',
      );
      expect(results.length).to.be.greaterThan(0);
    });
  });
});
