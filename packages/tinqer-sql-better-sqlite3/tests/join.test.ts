import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

describe("Join SQL Generation", () => {
  interface User {
    id: number;
    name: string;
    departmentId: number;
    managerId?: number;
  }

  interface Department {
    id: number;
    name: string;
    locationId?: number;
  }

  interface Order {
    id: number;
    userId: number;
    amount: number;
    productId?: number;
    status?: string;
  }

  interface Product {
    id: number;
    name: string;
    categoryId: number;
    price: number;
  }

  interface Category {
    id: number;
    name: string;
  }

  interface Location {
    id: number;
    city: string;
    country: string;
  }

  describe("INNER JOIN", () => {
    it("should generate INNER JOIN with proper syntax", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.departmentId,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .select((joined) => ({ userName: joined.u.name, deptName: joined.d.name })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "t0"."name" AS "userName", "t1"."name" AS "deptName" FROM "users" AS "t0" INNER JOIN "departments" AS "t1" ON "t0"."departmentId" = "t1"."id"',
      );
    });

    it("should handle JOIN with WHERE clause", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.id > 100)
            .join(
              from<Order>("orders"),
              (u) => u.id,
              (o) => o.userId,
              (u, o) => ({ u, o }),
            )
            .select((joined) => ({ user: joined.u.name, total: joined.o.amount })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "t0"."name" AS "user", "t1"."amount" AS "total" FROM "users" AS "t0" INNER JOIN "orders" AS "t1" ON "t0"."id" = "t1"."userId" WHERE "t0"."id" > @__p1',
      );
      expect(result.params).to.deep.equal({ __p1: 100 });
    });

    it("should handle JOIN with complex inner query", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Order>("orders").where((o) => o.amount > 1000),
              (u) => u.id,
              (o) => o.userId,
              (u, o) => ({ u, o }),
            )
            .select((joined) => ({ userName: joined.u.name, orderAmount: joined.o.amount })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "t0"."name" AS "userName", "t1"."amount" AS "orderAmount" FROM "users" AS "t0" INNER JOIN (SELECT * FROM "orders" WHERE "amount" > @__p1) AS "t1" ON "t0"."id" = "t1"."userId"',
      );
      expect(result.params).to.deep.equal({ __p1: 1000 });
    });

    it("should handle JOIN with GROUP BY", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Order>("orders"),
              (u) => u.id,
              (o) => o.userId,
              (u, o) => ({ u, o }),
            )
            .groupBy((joined) => joined.u.id)
            .select((g) => ({
              userId: g.key,
              totalAmount: g.sum((joined) => joined.o.amount),
            })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "t0"."id" AS "userId", SUM("t1"."amount") AS "totalAmount" FROM "users" AS "t0" INNER JOIN "orders" AS "t1" ON "t0"."id" = "t1"."userId" GROUP BY "t0"."id"',
      );
    });

    it("should handle JOIN with DISTINCT", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.departmentId,
              (d) => d.id,
              (_u, d) => ({ u: _u, d }),
            )
            .select((joined) => ({ deptName: joined.d.name }))
            .distinct(),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT DISTINCT "t1"."name" AS "deptName" FROM "users" AS "t0" INNER JOIN "departments" AS "t1" ON "t0"."departmentId" = "t1"."id"',
      );
    });

    it("should handle JOIN with ORDER BY and TAKE", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Order>("orders"),
              (u) => u.id,
              (o) => o.userId,
              (u, o) => ({ u, o }),
            )
            .orderBy((joined) => joined.o.amount)
            .select((joined) => ({ userName: joined.u.name, amount: joined.o.amount }))
            .take(10),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "t0"."name" AS "userName", "t1"."amount" AS "amount" FROM "users" AS "t0" INNER JOIN "orders" AS "t1" ON "t0"."id" = "t1"."userId" ORDER BY "t1"."amount" ASC LIMIT @__p1',
      );
      expect(result.params).to.deep.equal({ __p1: 10 });
    });
  });

  describe("Multiple JOINs", () => {
    it("should handle multiple JOINs (3 tables)", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.departmentId,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .join(
              from<Location>("locations"),
              (joined) => joined.d.id,
              (l) => l.id,
              (joined, l) => ({ ...joined, l }),
            )
            .select((result) => ({
              userName: result.u.name,
              deptName: result.d.name,
              city: result.l.city,
            })),
        {},
      );

      expect(result.sql).to.contain("INNER JOIN");
      expect(result.sql).to.contain("locations");
    });

    it("should handle 4-table JOIN chain", () => {
      const result = query(
        () =>
          from<Order>("orders")
            .join(
              from<User>("users"),
              (o) => o.userId,
              (u) => u.id,
              (o, u) => ({ o, u }),
            )
            .join(
              from<Product>("products"),
              (joined) => joined.o.productId,
              (p) => p.id,
              (joined, p) => ({ ...joined, p }),
            )
            .join(
              from<Category>("categories"),
              (joined) => joined.p.categoryId,
              (c) => c.id,
              (joined, c) => ({ ...joined, c }),
            )
            .select((result) => ({
              orderId: result.o.id,
              userName: result.u.name,
              productName: result.p.name,
              categoryName: result.c.name,
            })),
        {},
      );

      expect(result.sql).to.contain("orders");
      expect(result.sql).to.contain("users");
      expect(result.sql).to.contain("products");
      expect(result.sql).to.contain("categories");
    });
  });

  describe("Self JOIN", () => {
    it("should handle self JOIN for hierarchical data", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<User>("users").where((m) => m.managerId != null),
              (e) => e.managerId,
              (m) => m.id,
              (e, m) => ({ e, m }),
            )
            .select((joined) => ({ employeeName: joined.e.name, managerName: joined.m.name })),
        {},
      );

      expect(result.sql).to.contain(`FROM "users" AS "t0"`);
      expect(result.sql).to.contain("INNER JOIN");
      expect(result.sql).to.contain('SELECT * FROM "users"');
    });
  });

  describe("Complex JOIN scenarios", () => {
    it("should handle JOIN with aggregates", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Order>("orders"),
              (u) => u.id,
              (o) => o.userId,
              (u, o) => ({ u, o }),
            )
            .groupBy((joined) => joined.u.id)
            .select((g) => ({
              userId: g.key,
              avgOrderAmount: g.avg((joined) => joined.o.amount),
              maxOrderAmount: g.max((joined) => joined.o.amount),
              minOrderAmount: g.min((joined) => joined.o.amount),
            })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "t0"."id" AS "userId", AVG("t1"."amount") AS "avgOrderAmount", MAX("t1"."amount") AS "maxOrderAmount", MIN("t1"."amount") AS "minOrderAmount" FROM "users" AS "t0" INNER JOIN "orders" AS "t1" ON "t0"."id" = "t1"."userId" GROUP BY "t0"."id"',
      );
    });

    it("should handle JOIN with complex conditions", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Order>("orders"),
              (u) => u.id,
              (o) => o.userId,
              (u, o) => ({ u, o }),
            )
            .where((joined) => joined.o.amount > 100 && joined.o.amount < 1000)
            .select((joined) => ({ userName: joined.u.name, amount: joined.o.amount })),
        {},
      );

      expect(result.sql).to.contain("WHERE");
      expect(result.sql).to.contain(`"amount" >`);
      expect(result.sql).to.contain(`"amount" <`);
    });

    it("should handle JOIN with complex WHERE and ORDER BY", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.id > 50)
            .join(
              from<Order>("orders").where((o) => o.status == "completed"),
              (u) => u.id,
              (o) => o.userId,
              (u, o) => ({ u, o }),
            )
            .where((joined) => joined.o.amount > 500)
            .select((joined) => ({
              userName: joined.u.name,
              amount: joined.o.amount,
              userId: joined.u.id,
            }))
            .orderBy((x) => x.amount)
            .take(20),
        {},
      );

      expect(result.sql).to.contain("WHERE");
      expect(result.sql).to.contain("ORDER BY");
      expect(result.sql).to.contain("LIMIT");
      expect(result.params).to.have.property("__p1");
      expect(result.params).to.have.property("__p2");
      expect(result.params).to.have.property("__p3");
      expect(result.params).to.have.property("__p4");
    });

    it("should handle JOIN with pagination", () => {
      const result = query(
        (p: { page: number; pageSize: number }) =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.departmentId,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .select((joined) => ({ userName: joined.u.name, deptName: joined.d.name }))
            .orderBy((x) => x.userName)
            .skip(p.page * p.pageSize)
            .take(p.pageSize),
        { page: 2, pageSize: 10 },
      );

      expect(result.sql).to.contain("INNER JOIN");
      expect(result.sql).to.contain("ORDER BY");
      expect(result.sql).to.contain("LIMIT");
      expect(result.sql).to.contain("OFFSET");
      expect(result.params).to.deep.equal({ page: 2, pageSize: 10 });
    });
  });
});
