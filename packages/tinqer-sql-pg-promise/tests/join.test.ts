import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

describe("Join SQL Generation", () => {
  interface User {
    id: number;
    name: string;
    departmentId: number;
  }

  interface Department {
    id: number;
    name: string;
  }

  interface Order {
    id: number;
    userId: number;
    amount: number;
  }

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

    // The generator creates a subquery for the joined table
    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS t0 INNER JOIN (SELECT * FROM "departments" AS t0) AS t1 ON t0.departmentId = t1.id',
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

    // WHERE comes after JOIN in the generated SQL
    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS t0 INNER JOIN (SELECT * FROM "orders" AS t0) AS t1 ON t0.id = t1.userId WHERE id > 100',
    );
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

    // The inner query includes its WHERE clause in the subquery
    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS t0 INNER JOIN (SELECT * FROM "orders" AS t0 WHERE amount > 1000) AS t1 ON t0.id = t1.userId',
    );
  });
});
