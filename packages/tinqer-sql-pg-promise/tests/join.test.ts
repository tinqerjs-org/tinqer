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
          from<User>("users").join(
            from<Department>("departments"),
            (u) => u.departmentId,
            (d) => d.id,
            (u, d) => ({ userName: u.name, deptName: d.name }),
          ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS "t0" INNER JOIN (SELECT * FROM "departments" AS "t0") AS "t1" ON "t0"."departmentId" = "t1"."id"',
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
              (u, o) => ({ user: u.name, total: o.amount }),
            ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS "t0" INNER JOIN (SELECT * FROM "orders" AS "t0") AS "t1" ON "t0"."id" = "t1"."userId" WHERE "id" > $(_id1)',
      );
      expect(result.params).to.deep.equal({ _id1: 100 });
    });

    it("should handle JOIN with complex inner query", () => {
      const result = query(
        () =>
          from<User>("users").join(
            from<Order>("orders").where((o) => o.amount > 1000),
            (u) => u.id,
            (o) => o.userId,
            (u, o) => ({ userName: u.name, orderAmount: o.amount }),
          ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS "t0" INNER JOIN (SELECT * FROM "orders" AS "t0" WHERE "amount" > $(_amount1)) AS "t1" ON "t0"."id" = "t1"."userId"',
      );
      expect(result.params).to.deep.equal({ _amount1: 1000 });
    });

    it("should handle JOIN with GROUP BY", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Order>("orders"),
              (u) => u.id,
              (o) => o.userId,
              (u, o) => ({ userId: u.id, userName: u.name, orderAmount: o.amount }),
            )
            .groupBy((x) => x.userId)
            .select((g) => ({
              userId: g.key,
              totalAmount: g.sum((x) => x.orderAmount),
            })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "key" AS "userId", SUM("orderAmount") AS "totalAmount" FROM "users" AS "t0" INNER JOIN (SELECT * FROM "orders" AS "t0") AS "t1" ON "t0"."id" = "t1"."userId" GROUP BY "userId"',
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
              (_u, d) => ({ deptName: d.name }),
            )
            .distinct(),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT DISTINCT * FROM "users" AS "t0" INNER JOIN (SELECT * FROM "departments" AS "t0") AS "t1" ON "t0"."departmentId" = "t1"."id"',
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
              (u, o) => ({ userName: u.name, amount: o.amount }),
            )
            .orderBy((x) => x.amount)
            .take(10),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS "t0" INNER JOIN (SELECT * FROM "orders" AS "t0") AS "t1" ON "t0"."id" = "t1"."userId" ORDER BY "amount" ASC LIMIT $(_limit1)',
      );
      expect(result.params).to.deep.equal({ _limit1: 10 });
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
              (u, d) => ({ userId: u.id, userName: u.name, deptId: d.id, deptName: d.name }),
            )
            .join(
              from<Location>("locations"),
              (ud) => ud.deptId,
              (l) => l.id,
              (ud, l) => ({
                userName: ud.userName,
                deptName: ud.deptName,
                city: l.city,
              }),
            ),
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
              (o, u) => ({ orderId: o.id, userId: u.id, userName: u.name, productId: o.productId }),
            )
            .join(
              from<Product>("products"),
              (ou) => ou.productId, // Fixed: removed || 0, JOINs must use simple column access
              (p) => p.id,
              (ou, p) => ({
                orderId: ou.orderId,
                userName: ou.userName,
                productName: p.name,
                categoryId: p.categoryId,
              }),
            )
            .join(
              from<Category>("categories"),
              (oup) => oup.categoryId,
              (c) => c.id,
              (oup, c) => ({
                orderId: oup.orderId,
                userName: oup.userName,
                productName: oup.productName,
                categoryName: c.name,
              }),
            ),
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
          from<User>("users").join(
            from<User>("users").where((m) => m.managerId != null),
            (e) => e.managerId, // Fixed: removed || 0, JOINs must use simple column access
            (m) => m.id,
            (e, m) => ({ employeeName: e.name, managerName: m.name }),
          ),
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
              (u, o) => ({ userId: u.id, userName: u.name, amount: o.amount }),
            )
            .groupBy((x) => x.userId)
            .select((g) => ({
              userId: g.key,
              avgOrderAmount: g.avg((x) => x.amount),
              maxOrderAmount: g.max((x) => x.amount),
              minOrderAmount: g.min((x) => x.amount),
            })),
        {},
      );

      expect(result.sql).to.contain(`AVG("amount")`);
      expect(result.sql).to.contain(`MAX("amount")`);
      expect(result.sql).to.contain(`MIN("amount")`);
    });

    it("should handle JOIN with complex conditions", () => {
      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Order>("orders"),
              (u) => u.id,
              (o) => o.userId,
              (u, o) => ({ userName: u.name, amount: o.amount }),
            )
            .where((x) => x.amount > 100 && x.amount < 1000),
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
              (u, o) => ({ userName: u.name, amount: o.amount, userId: u.id }),
            )
            .where((x) => x.amount > 500)
            .orderBy((x) => x.amount)
            .take(20),
        {},
      );

      expect(result.sql).to.contain("WHERE");
      expect(result.sql).to.contain("ORDER BY");
      expect(result.sql).to.contain("LIMIT");
      expect(result.params).to.have.property("_id1");
      expect(result.params).to.have.property("_status1");
      expect(result.params).to.have.property("_amount1");
      expect(result.params).to.have.property("_limit1");
    });

    it("should handle JOIN with pagination", () => {
      const result = query(
        (p: { page: number; pageSize: number }) =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.departmentId,
              (d) => d.id,
              (u, d) => ({ userName: u.name, deptName: d.name }),
            )
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
