import { Queryable } from "../src/queryable/queryable.js";
import { expect } from "chai";
import type {
  LogicalExpression,
  UnaryExpression,
  BinaryExpression,
  ConstantExpression,
  MemberExpression,
} from "../src/types/expressions.js";

// Define test interfaces
interface User {
  id: number;
  age: number;
  isActive: boolean;
  country: string;
  isDeleted: boolean;
  deletedAt: string | null;
  middleName?: string;
  isVerified: boolean;
  role: string;
  profile: { age: number };
  status: string;
}

interface Product {
  category: string;
  price: number;
  stock: number;
  rating: number;
  discount: number;
  quantity: number;
  total: number;
}

interface Order {
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  quantity: number;
  price: number;
}

interface Item {
  status: string;
  id: number;
  price: number;
  tax: number;
  quantity: number;
}

describe("Complex WHERE Conditions", () => {
  it("should handle multiple chained WHERE clauses", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.age >= 18)
      .where((u) => u.isActive === true)
      .where((u) => u.country === "USA")
      .build();

    expect(query.where).to.exist;
    // Multiple WHERE clauses are combined with AND
    expect(query.where!.type).to.equal("logical");
    expect((query.where as LogicalExpression).operator).to.equal("&&");
  });

  it("should handle OR conditions", () => {
    const query = new Queryable<Product>("products")
      .where((p) => p.category === "Electronics" || p.category === "Computers")
      .build();

    expect(query.where!.type).to.equal("logical");
    expect((query.where as LogicalExpression).operator).to.equal("||");
  });

  it("should handle complex nested conditions", () => {
    const query = new Queryable<Order>("orders")
      .where((o) => (o.status === "pending" || o.status === "processing") && o.total > 1000)
      .build();

    expect(query.where!.type).to.equal("logical");
    expect((query.where as LogicalExpression).operator).to.equal("&&");
  });

  it("should handle negation", () => {
    const query = new Queryable<User>("users").where((u) => !u.isDeleted).build();

    expect(query.where!.type).to.equal("unary");
    expect((query.where as UnaryExpression).operator).to.equal("!");
  });

  it("should handle IN-like conditions with array", () => {
    // Simulating IN clause with OR conditions
    const query = new Queryable<Item>("items")
      .where((i) => i.status === "active" || i.status === "pending" || i.status === "approved")
      .build();

    expect(query.where!.type).to.equal("logical");
  });

  it("should handle BETWEEN-like conditions", () => {
    const query = new Queryable<Product>("products")
      .where((p) => p.price >= 10 && p.price <= 100)
      .build();

    expect(query.where).to.exist;
    expect(query.where!.type).to.equal("logical");
    const logicalExpr = query.where as LogicalExpression;
    expect(logicalExpr.operator).to.equal("&&");
  });

  it("should handle null checks", () => {
    const query = new Queryable<User>("users").where((u) => u.deletedAt === null).build();

    expect(query.where).to.exist;
    expect(query.where!.type).to.equal("binary");
    const binaryExpr = query.where as BinaryExpression;
    expect(binaryExpr.operator).to.equal("==");
    expect(binaryExpr.right.type).to.equal("constant");
    const rightExpr = binaryExpr.right as ConstantExpression;
    expect(rightExpr.value).to.equal(null);
  });

  it("should handle undefined checks", () => {
    const query = new Queryable<User>("users").where((u) => u.middleName !== undefined).build();

    expect(query.where).to.exist;
    expect(query.where!.type).to.equal("binary");
    const binaryExpr = query.where as BinaryExpression;
    expect(binaryExpr.operator).to.equal("!=");
    const rightExpr = binaryExpr.right as ConstantExpression;
    expect(rightExpr.value).to.equal(undefined);
  });

  it("should handle boolean literals", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.isActive === true && u.isVerified === false)
      .build();

    expect(query.where!.type).to.equal("logical");
  });

  it("should handle numeric comparisons", () => {
    const query = new Queryable<Product>("products")
      .where((p) => p.stock > 0)
      .where((p) => p.rating >= 4.5)
      .where((p) => p.discount < 0.5)
      .build();

    expect(query.where).to.exist;
  });

  it("should handle string equality", () => {
    const query = new Queryable<User>("users").where((u) => u.role === "admin").build();

    expect(query.where).to.exist;
    const binaryExpr = query.where as BinaryExpression;
    const rightExpr = binaryExpr.right as ConstantExpression;
    expect(rightExpr.value).to.equal("admin");
  });

  it("should handle nested property access", () => {
    const query = new Queryable<User>("users").where((u) => u.profile.age > 21).build();

    expect(query.where).to.exist;
    const binaryExpr = query.where as BinaryExpression;
    expect(binaryExpr.left.type).to.equal("member");
    const leftExpr = binaryExpr.left as MemberExpression;
    expect(leftExpr.object?.type).to.equal("member");
  });

  it("should handle complex arithmetic expressions", () => {
    const query = new Queryable<Order>("orders").where((o) => o.subtotal + o.tax > 100).build();

    expect(query.where).to.exist;
    const binaryExpr = query.where as BinaryExpression;
    expect(binaryExpr.left.type).to.equal("binary");
    const leftExpr = binaryExpr.left as BinaryExpression;
    expect(leftExpr.operator).to.equal("+");
  });

  it("should handle modulo operator", () => {
    const query = new Queryable<Item>("items")
      .where((i) => i.id % 2 === 0) // Even IDs only
      .build();

    expect(query.where).to.exist;
    const binaryExpr = query.where as BinaryExpression;
    expect(binaryExpr.left.type).to.equal("binary");
    const leftExpr = binaryExpr.left as BinaryExpression;
    expect(leftExpr.operator).to.equal("%");
  });

  it("should handle multiplication and division", () => {
    const query = new Queryable<Product>("products")
      .where((p) => p.price * p.quantity > 1000)
      .where((p) => p.total / p.quantity === p.price)
      .build();

    expect(query.where).to.exist;
  });

  it("should handle parentheses for precedence", () => {
    const query = new Queryable<Item>("items")
      .where((i) => (i.price + i.tax) * i.quantity > 500)
      .build();

    expect(query.where!.type).to.equal("binary");
    const whereExpr = query.where as BinaryExpression;
    expect(whereExpr.operator).to.equal(">");
  });

  it("should normalize === to ==", () => {
    const query = new Queryable<User>("users").where((u) => u.id === 123).build();

    const whereExpr = query.where as BinaryExpression;
    expect(whereExpr.operator).to.equal("==");
  });

  it("should normalize !== to !=", () => {
    const query = new Queryable<User>("users").where((u) => u.status !== "inactive").build();

    const whereExpr = query.where as BinaryExpression;
    expect(whereExpr.operator).to.equal("!=");
  });
});
