/**
 * Tests for JOIN with table references pattern: (u, d) => ({ u, d })
 */

import { expect } from "chai";
import { query } from "../src/index.js";
import { from } from "@webpods/tinqer";

interface User {
  id: number;
  name: string;
  email: string;
  department_id: number;
  age: number;
}

interface Department {
  id: number;
  name: string;
  location: string;
  budget: number;
}

interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  status: string;
  created_at: Date;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

describe("JOIN with Table References", () => {
  describe("Basic table reference returns", () => {
    it("should support (u, d) => ({ u, d }) pattern", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .select((joined) => ({
              userId: joined.u.id,
              userName: joined.u.name,
              deptId: joined.d.id,
              deptName: joined.d.name,
            })),
        {},
      );

      // Should generate SELECT with columns from both tables
      expect(result.sql).to.include("SELECT");
      expect(result.sql).to.include('"t0"."id" AS "userId"');
      expect(result.sql).to.include('"t0"."name" AS "userName"');
      expect(result.sql).to.include('"t1"."id" AS "deptId"');
      expect(result.sql).to.include('"t1"."name" AS "deptName"');
      expect(result.sql).to.include('FROM "users"');
      expect(result.sql).to.include('INNER JOIN "departments"');
      expect(result.sql).to.include('ON "t0"."department_id" = "t1"."id"');
    });

    it("should support accessing nested properties after table reference JOIN", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .select((joined) => ({
              userName: joined.u.name,
              userEmail: joined.u.email,
              deptName: joined.d.name,
              deptLocation: joined.d.location,
            })),
        {},
      );

      expect(result.sql).to.include('"t0"."name" AS "userName"');
      expect(result.sql).to.include('"t0"."email" AS "userEmail"');
      expect(result.sql).to.include('"t1"."name" AS "deptName"');
      expect(result.sql).to.include('"t1"."location" AS "deptLocation"');
    });

    it("should support WHERE clause with table references", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .where((joined) => joined.u.age > 25 && joined.d.budget > 100000)
            .select((joined) => ({
              userName: joined.u.name,
              deptName: joined.d.name,
            })),
        {},
      );

      expect(result.sql).to.include("SELECT");
      expect(result.sql).to.include('"t0"."name" AS "userName"');
      expect(result.sql).to.include('"t1"."name" AS "deptName"');
      expect(result.sql).to.include("WHERE");
      expect(result.sql).to.include('"t0"."age" > @__p1');
      expect(result.sql).to.include("AND");
      expect(result.sql).to.include('"t1"."budget" > @__p2');
      expect(result.params).to.deep.equal({ __p1: 25, __p2: 100000 });
    });
  });

  describe("Chained JOINs with table references", () => {
    it("should support chaining JOINs with table references", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .join(
              from<Order>("orders"),
              (joined) => joined.u.id,
              (o) => o.user_id,
              (joined, o) => ({
                user: joined.u,
                dept: joined.d,
                order: o,
              }),
            )
            .select((result) => ({
              userId: result.user.id,
              userName: result.user.name,
              deptName: result.dept.name,
              orderTotal: result.order.total_amount,
            })),
        {},
      );

      expect(result.sql).to.include("SELECT");
      expect(result.sql).to.include('"t0"."id" AS "userId"');
      expect(result.sql).to.include('"t0"."name" AS "userName"');
      expect(result.sql).to.include('"t1"."name" AS "deptName"');
      expect(result.sql).to.include('"t2"."total_amount" AS "orderTotal"');
      expect(result.sql).to.include('FROM "users"');
      expect(result.sql).to.include('INNER JOIN "departments"');
      expect(result.sql).to.include('INNER JOIN "orders"');
      // Verify the second JOIN uses the correct key from users table
      expect(result.sql).to.include('ON "t0"."id" = "t2"."user_id"');
    });

    it("should correctly resolve properties through chained table references", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ user: u, dept: d }),
            )
            .join(
              from<Order>("orders"),
              (joined) => joined.user.id,
              (o) => o.user_id,
              (joined, o) => ({ joined, order: o }),
            )
            .select((result) => ({
              userName: result.joined.user.name,
              deptName: result.joined.dept.name,
              orderTotal: result.order.total_amount,
            })),
        {},
      );

      expect(result.sql).to.include('"t0"."name" AS "userName"');
      expect(result.sql).to.include('"t1"."name" AS "deptName"');
      expect(result.sql).to.include('"t2"."total_amount" AS "orderTotal"');
    });

    it("should handle three-way JOINs with table references", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .join(
              from<Order>("orders"),
              (joined) => joined.u.id,
              (o) => o.user_id,
              (joined, o) => ({ ...joined, o }),
            )
            .join(
              from<Product>("products"),
              (joined) => joined.o.id,
              (p) => p.id,
              (joined, p) => ({ ...joined, p }),
            )
            .select((result) => ({
              userName: result.u.name,
              deptName: result.d.name,
              orderTotal: result.o.total_amount,
              productName: result.p.name,
            })),
        {},
      );

      expect(result.sql).to.include('"t0"."name" AS "userName"');
      expect(result.sql).to.include('"t1"."name" AS "deptName"');
      expect(result.sql).to.include('"t2"."total_amount" AS "orderTotal"');
      expect(result.sql).to.include('"t3"."name" AS "productName"');
    });
  });

  describe("Mixed patterns", () => {
    it("should enforce table references only in JOIN result selector", () => {
      // This test verifies that mixing table references with field selections is not allowed
      expect(() => {
        query(
          () =>
            from<User>("users")
              .join(
                from<Department>("departments"),
                (u) => u.department_id,
                (d) => d.id,
                (u, d) => ({
                  u,
                  deptName: d.name, // This is not allowed - can't mix references with field selections
                  deptBudget: d.budget,
                }),
              )
              .select((joined) => ({
                userId: joined.u.id,
                userName: joined.u.name,
              })),
          {},
        );
      }).to.throw("Failed to parse query");
    });
  });

  describe("Aggregations with table references", () => {
    it("should support GROUP BY with table references", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .groupBy((joined) => ({
              deptId: joined.d.id,
              deptName: joined.d.name,
            }))
            .select((g) => ({
              departmentId: g.key.deptId,
              departmentName: g.key.deptName,
              userCount: g.count(),
              avgAge: g.average((joined) => joined.u.age),
            })),
        {},
      );

      expect(result.sql).to.include('GROUP BY "t1"."id", "t1"."name"');
      expect(result.sql).to.include('COUNT(*) AS "userCount"');
      expect(result.sql).to.include('AVG("t0"."age") AS "avgAge"');
    });

    it("should support complex aggregations with chained table references", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .join(
              from<Order>("orders"),
              (joined) => joined.u.id,
              (o) => o.user_id,
              (joined, o) => ({ ...joined, o }),
            )
            .groupBy((result) => ({
              deptName: result.d.name,
              userName: result.u.name,
            }))
            .select((g) => ({
              department: g.key.deptName,
              user: g.key.userName,
              totalOrders: g.count(),
              totalRevenue: g.sum((result) => result.o.total_amount),
            })),
        {},
      );

      expect(result.sql).to.include('GROUP BY "t1"."name", "t0"."name"');
      expect(result.sql).to.include('SUM("t2"."total_amount") AS "totalRevenue"');
    });
  });

  describe("Edge cases and validation", () => {
    it("should throw error when SELECT is missing after JOIN with result selector", () => {
      expect(() => {
        query(
          () =>
            from<User>("users").join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            ),
          {},
        );
      }).to.throw("JOIN with result selector requires explicit SELECT projection");
    });

    it("should handle empty object in result selector with SELECT", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              () => ({}),
            )
            .select(() => ({
              userId: 1,
              deptId: 2,
            })),
        {},
      );

      // Should still generate valid JOIN syntax
      expect(result.sql).to.include("SELECT");
      expect(result.sql).to.include("INNER JOIN");
      expect(result.sql).to.include('ON "t0"."department_id" = "t1"."id"');
    });

    it("should handle single table reference return", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, _d) => u, // Just return the first table
            )
            .select((u) => ({
              userId: u.id,
              userName: u.name,
            })),
        {},
      );

      expect(result.sql).to.include("SELECT");
      expect(result.sql).to.include('"t0"."id" AS "userId"');
      expect(result.sql).to.include('"t0"."name" AS "userName"');
      expect(result.sql).to.include("INNER JOIN");
    });

    it("should support ORDER BY with table references", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .orderBy((joined) => joined.d.name)
            .thenByDescending((joined) => joined.u.age)
            .select((joined) => ({
              userName: joined.u.name,
              userAge: joined.u.age,
              deptName: joined.d.name,
            })),
        {},
      );

      expect(result.sql).to.include("SELECT");
      expect(result.sql).to.include('"t0"."name" AS "userName"');
      expect(result.sql).to.include('"t0"."age" AS "userAge"');
      expect(result.sql).to.include('"t1"."name" AS "deptName"');
      expect(result.sql).to.include('ORDER BY "t1"."name" ASC');
      expect(result.sql).to.include('"t0"."age" DESC');
    });

    it("should support DISTINCT with table references", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .select((joined) => ({
              deptName: joined.d.name,
            }))
            .distinct(),
        {},
      );

      expect(result.sql).to.include("SELECT DISTINCT");
      expect(result.sql).to.include('"t1"."name" AS "deptName"');
    });
  });
});
