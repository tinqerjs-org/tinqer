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

  it("should generate INNER JOIN", () => {
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

    expect(result.sql).to.include("INNER JOIN");
    expect(result.sql).to.include("departments");
    expect(result.sql).to.include("ON");
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

    expect(result.sql).to.include("WHERE");
    expect(result.sql).to.include("id > 100");
    expect(result.sql).to.include("INNER JOIN");
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

    expect(result.sql).to.include("INNER JOIN");
    expect(result.sql).to.include("amount > 1000");
  });
});
