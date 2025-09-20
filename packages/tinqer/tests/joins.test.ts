import { Queryable } from "../src/queryable/queryable.js";
import { expect } from "chai";

// Define test interfaces
interface User {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
}

interface Order {
  id: number;
  userId: number;
  productId: number;
  total: number;
  quantity: number;
}

interface Product {
  id: number;
  name: string;
  category: string;
}

interface Profile {
  userId: number;
  bio: string;
  avatar: string;
  location: string;
}

interface Score {
  userId: number;
  value: number;
}

interface Employee {
  id: number;
  name: string;
  managerId: number;
}

describe("JOIN Operations", () => {
  it("should handle INNER JOIN with simple key", () => {
    const users = new Queryable<User>("users");
    const orders = new Queryable<Order>("orders");

    const query = users
      .join(
        orders,
        (u) => u.id,
        (o) => o.userId,
        (u, o) => ({ userName: u.name, orderTotal: o.total }),
      )
      .build();

    expect(query.joins).to.deep.include({
      type: "join",
      kind: "INNER",
      table: "orders",
      on: {
        type: "binary",
        operator: "==",
        left: {
          type: "member",
          object: {
            type: "parameter",
            name: "u",
            origin: { type: "table", ref: "users" },
          },
          property: "id",
        },
        right: {
          type: "member",
          object: {
            type: "parameter",
            name: "o",
            origin: { type: "table", ref: "orders" },
          },
          property: "userId",
        },
      },
    });
  });

  it("should handle LEFT JOIN", () => {
    const users = new Queryable<User>("users");
    const orders = new Queryable<Order>("orders");

    const query = users
      .leftJoin(
        orders,
        (u) => u.id,
        (o) => o.userId,
        (u, o) => ({ userName: u.name, hasOrder: o !== null }),
      )
      .build();

    expect(query.joins).to.deep.include({
      type: "join",
      kind: "LEFT",
      table: "orders",
    });
  });

  it("should handle multiple JOINs", () => {
    const users = new Queryable<User>("users");
    const orders = new Queryable<Order>("orders");
    const products = new Queryable<Product>("products");

    const query = users
      .join(
        orders,
        (u) => u.id,
        (o) => o.userId,
        (u, o) => ({ user: u, order: o }),
      )
      .join(
        products,
        (result) => result.order.productId,
        (p) => p.id,
        (result, p) => ({
          userName: result.user.name,
          productName: p.name,
        }),
      )
      .build();

    expect(query.joins).to.have.lengthOf(2);
    if (query.joins) {
      expect((query.joins[0] as { table: string }).table).to.equal("orders");
      expect((query.joins[1] as { table: string }).table).to.equal("products");
    }
  });

  it("should handle JOIN with WHERE clause", () => {
    const users = new Queryable<User>("users");
    const orders = new Queryable<Order>("orders");

    const query = users
      .where((u) => u.isActive === true)
      .join(
        orders,
        (u) => u.id,
        (o) => o.userId,
        (u, o) => ({ userName: u.name, orderTotal: o.total }),
      )
      .where((result) => result.orderTotal > 100)
      .build();

    expect(query.where).to.exist;
    expect(query.joins).to.have.lengthOf(1);
  });

  it("should handle JOIN with complex result selector", () => {
    const users = new Queryable<User>("users");
    const profiles = new Queryable<Profile>("profiles");

    const query = users
      .join(
        profiles,
        (u) => u.id,
        (p) => p.userId,
        (u, p) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          profile: {
            bio: p.bio,
            avatar: p.avatar,
            location: p.location,
          },
          fullName: u.firstName + " " + u.lastName,
        }),
      )
      .build();

    expect((query.select as { type: string }).type).to.equal("lambda");
    if (query.joins && query.joins[0]) {
      expect((query.joins[0] as { table: string }).table).to.equal("profiles");
    }
  });

  it("should handle JOIN with ORDER BY", () => {
    const users = new Queryable<User>("users");
    const scores = new Queryable<Score>("scores");

    const query = users
      .join(
        scores,
        (u) => u.id,
        (s) => s.userId,
        (u, s) => ({ userName: u.name, score: s.value }),
      )
      .orderByDescending((result) => result.score)
      .take(10)
      .build();

    expect(query.joins).to.have.lengthOf(1);
    if (query.orderBy && query.orderBy[0]) {
      expect((query.orderBy[0] as { direction: string }).direction).to.equal("DESC");
    }
    expect((query.limit as unknown as { value: number }).value).to.equal(10);
  });

  it("should handle JOIN with GROUP BY", () => {
    const orders = new Queryable<Order>("orders");
    const products = new Queryable<Product>("products");

    const query = orders
      .join(
        products,
        (o) => o.productId,
        (p) => p.id,
        (o, p) => ({
          productName: p.name,
          quantity: o.quantity,
          category: p.category,
        }),
      )
      .groupBy((result) => result.category)
      .build();

    expect(query.joins).to.have.lengthOf(1);
    expect(query.groupBy).to.exist;
  });

  it("should handle self JOIN", () => {
    const employees = new Queryable<Employee>("employees");
    const managers = new Queryable<Employee>("employees"); // Self join

    const query = employees
      .join(
        managers,
        (e) => e.managerId,
        (m) => m.id,
        (e, m) => ({
          employeeName: e.name,
          managerName: m.name,
        }),
      )
      .build();

    if (query.joins && query.joins[0]) {
      expect((query.joins[0] as { table: string }).table).to.equal("employees");
    }
  });
});
