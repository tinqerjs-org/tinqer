import { Queryable } from "../src/queryable/queryable.js";
import { expect } from "chai";
import {
  assertMemberExpression,
  assertBinaryExpression,
  assertConditionalExpression,
  assertUnaryExpression,
} from "./test-helpers.js";
import type { LambdaExpression } from "../src/types/expressions.js";

// Define test interfaces
interface User {
  id: number;
  name: string;
  country: string;
  city: string;
  profile: { age: number };
  address: { city: string };
  createdAt: string;
  isActive: boolean;
  lastLogin: string;
  age: number;
  deletedAt: string | null;
}

interface Product {
  price: number;
  category: string;
  name: string;
  stock: number;
  cost: number;
}

interface Order {
  price: number;
  quantity: number;
  customerId: number;
}

interface Employee {
  department: string;
  salary: number;
  hireDate: string;
  lastName: string;
  firstName: string;
}

interface Task {
  isCompleted: boolean;
  priority: number;
  dueDate: string;
}

describe("ORDER BY Operations", () => {
  it("should handle single field ORDER BY ASC", () => {
    const query = new Queryable<User>("users").orderBy((u) => u.name).build();

    expect(query.orderBy).to.have.lengthOf(1);
    if (query.orderBy && query.orderBy[0]) {
      expect(query.orderBy[0].direction).to.equal("ASC");
      const expr = query.orderBy[0].expression as LambdaExpression;
      const memberExpr = assertMemberExpression(expr.body);
      expect(memberExpr.type).to.equal("member");
      expect(memberExpr.property).to.equal("name");
    }
  });

  it("should handle single field ORDER BY DESC", () => {
    const query = new Queryable<Product>("products").orderByDescending((p) => p.price).build();

    expect(query.orderBy).to.have.lengthOf(1);
    if (query.orderBy && query.orderBy[0]) {
      expect(query.orderBy[0].direction).to.equal("DESC");
      const expr = query.orderBy[0].expression as LambdaExpression;
      const memberExpr = assertMemberExpression(expr.body);
      expect(memberExpr.property).to.equal("price");
    }
  });

  it("should handle multiple ORDER BY fields", () => {
    const query = new Queryable<User>("users")
      .orderBy((u) => u.country)
      .orderBy((u) => u.city)
      .orderBy((u) => u.name)
      .build();

    expect(query.orderBy).to.have.lengthOf(3);
    if (query.orderBy) {
      const expr0 = query.orderBy[0]?.expression as LambdaExpression;
      const expr1 = query.orderBy[1]?.expression as LambdaExpression;
      const expr2 = query.orderBy[2]?.expression as LambdaExpression;
      expect(assertMemberExpression(expr0.body).property).to.equal("country");
      expect(assertMemberExpression(expr1.body).property).to.equal("city");
      expect(assertMemberExpression(expr2.body).property).to.equal("name");
    }
  });

  it("should handle mixed ASC and DESC ordering", () => {
    const query = new Queryable<Product>("products")
      .orderBy((p) => p.category)
      .orderByDescending((p) => p.price)
      .orderBy((p) => p.name)
      .build();

    expect(query.orderBy).to.have.lengthOf(3);
    if (query.orderBy) {
      expect(query.orderBy[0]?.direction).to.equal("ASC");
      expect(query.orderBy[1]?.direction).to.equal("DESC");
      expect(query.orderBy[2]?.direction).to.equal("ASC");
    }
  });

  it("should handle ORDER BY with nested properties", () => {
    const query = new Queryable<User>("users")
      .orderBy((u) => u.profile.age)
      .orderBy((u) => u.address.city)
      .build();

    if (query.orderBy && query.orderBy[0]) {
      const expr = query.orderBy[0].expression as LambdaExpression;
      const memberExpr = assertMemberExpression(expr.body);
      expect(memberExpr.type).to.equal("member");
      expect(assertMemberExpression(memberExpr.object).type).to.equal("member");
    }
  });

  it("should handle ORDER BY with expressions", () => {
    const query = new Queryable<Order>("orders")
      .orderByDescending((o) => o.price * o.quantity)
      .build();

    if (query.orderBy && query.orderBy[0]) {
      const expr = query.orderBy[0].expression as LambdaExpression;
      expect(expr.body.type).to.equal("binary");
      expect((expr.body as unknown as { operator: string }).operator).to.equal("*");
    }
  });

  it("should handle ORDER BY with string methods", () => {
    const query = new Queryable<User>("users").orderBy((u) => u.name.toLowerCase()).build();

    if (query.orderBy && query.orderBy[0]) {
      const expr = query.orderBy[0].expression as LambdaExpression;
      expect(expr.body.type).to.equal("call");
      expect((expr.body as unknown as { method: string }).method).to.equal("toLowerCase");
    }
  });

  it("should handle ORDER BY with conditional expressions", () => {
    const query = new Queryable<Product>("products")
      .orderBy((p) => (p.stock > 0 ? 0 : 1)) // In stock items first
      .orderBy((p) => p.name)
      .build();

    if (query.orderBy && query.orderBy[0]) {
      const expr = query.orderBy[0].expression as LambdaExpression;
      expect(expr.body.type).to.equal("conditional");
    }
  });

  it("should handle ORDER BY with LIMIT", () => {
    const query = new Queryable<User>("users")
      .orderByDescending((u) => u.createdAt)
      .take(10)
      .build();

    expect(query.orderBy).to.have.lengthOf(1);
    expect((query.limit as unknown as { value: number }).value).to.equal(10);
  });

  it("should handle ORDER BY with OFFSET", () => {
    const query = new Queryable<Product>("products")
      .orderBy((p) => p.name)
      .skip(20)
      .take(10)
      .build();

    expect(query.orderBy).to.have.lengthOf(1);
    expect((query.offset as unknown as { value: number }).value).to.equal(20);
    expect((query.limit as unknown as { value: number }).value).to.equal(10);
  });

  it("should handle ORDER BY with WHERE", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.isActive === true)
      .orderBy((u) => u.lastLogin)
      .build();

    expect(query.where).to.exist;
    expect(query.orderBy).to.have.lengthOf(1);
  });

  it("should handle ORDER BY with SELECT", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        id: u.id,
        name: u.name,
        age: u.age,
      }))
      .orderBy((u) => u.age)
      .build();

    expect(query.select).to.exist;
    expect(query.orderBy).to.have.lengthOf(1);
  });

  it("should handle ORDER BY with GROUP BY", () => {
    const query = new Queryable<Order>("orders")
      .groupBy((o) => o.customerId)
      .orderByDescending((o) => o.customerId)
      .build();

    expect(query.groupBy).to.exist;
    expect(query.orderBy).to.have.lengthOf(1);
  });

  it("should handle complex multi-level sorting", () => {
    const query = new Queryable<Employee>("employees")
      .orderBy((e) => e.department)
      .orderByDescending((e) => e.salary)
      .orderBy((e) => e.hireDate)
      .orderBy((e) => e.lastName)
      .orderBy((e) => e.firstName)
      .build();

    expect(query.orderBy).to.have.lengthOf(5);
  });

  it("should handle ORDER BY with boolean expressions", () => {
    const query = new Queryable<Task>("tasks")
      .orderBy((t) => !t.isCompleted) // Incomplete tasks first
      .orderByDescending((t) => t.priority)
      .orderBy((t) => t.dueDate)
      .build();

    expect(query.orderBy).to.have.lengthOf(3);
    if (query.orderBy && query.orderBy[0]) {
      const expr = query.orderBy[0].expression as LambdaExpression;
      const unaryExpr = assertUnaryExpression(expr.body);
      expect(unaryExpr.type).to.equal("unary");
    }
  });

  it("should handle ORDER BY with arithmetic operations", () => {
    const query = new Queryable<Product>("products")
      .orderByDescending((p) => (p.price - p.cost) / p.price) // Profit margin
      .build();

    if (query.orderBy && query.orderBy[0]) {
      const expr = query.orderBy[0].expression as LambdaExpression;
      const binaryExpr = assertBinaryExpression(expr.body);
      expect(binaryExpr.type).to.equal("binary");
      expect(binaryExpr.operator).to.equal("/");
    }
  });

  it("should handle ORDER BY with null checks", () => {
    const query = new Queryable<User>("users")
      .orderBy((u) => (u.deletedAt === null ? 0 : 1)) // Active users first
      .orderBy((u) => u.name)
      .build();

    if (query.orderBy && query.orderBy[0]) {
      const expr = query.orderBy[0].expression as LambdaExpression;
      const conditionalExpr = assertConditionalExpression(expr.body);
      expect(conditionalExpr.type).to.equal("conditional");
    }
  });
});
