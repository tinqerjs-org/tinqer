import { Queryable } from "../src/queryable/queryable.js";
import { expect } from "chai";
import {
  assertBinaryExpression,
  assertMemberExpression,
  assertConstantExpression,
  assertObjectExpression,
  assertArrayExpression,
  assertLogicalExpression,
  assertCallExpression,
} from "./test-helpers.js";

// Define test interfaces
interface Basic {
  id: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  middleName: string;
  tags: string[];
  deletedAt: string | null;
  points: number;
  isActive: boolean;
}

interface UserProfile {
  id: number;
}

interface Account {
  balance: number;
}

interface Transaction {
  amount: number;
}

interface Product {
  price: number;
}

interface Measurement {
  value: number;
}

interface Item {
  id: number;
  a: boolean;
  b: boolean;
  c: boolean;
  d: boolean;
  value: number;
  price: number;
  tax: number;
  quantity: number;
  currentIndex: number;
  values: number[];
}

interface Message {
  content: string;
  reaction: string;
}

interface Post {
  content: string;
}

interface Data {
  level1: {
    level2: {
      level3: {
        level4: {
          value: number;
        };
      };
    };
  };
  a: string;
  b: string;
}

interface Matrix {
  data: number[][][];
}

interface Metric {
  total: number;
  count: number;
  completed: number;
}

interface NumberData {
  value: number;
}

interface Node {
  parentId: number;
  id: number;
}

interface Sale {
  region: string;
}

interface Pattern {
  pattern: string;
}

describe("Edge Cases and Error Handling", () => {
  it("should handle empty table name", () => {
    const query = new Queryable<Basic>("").where((x) => x.id === 1).build();

    expect((query.from.source as unknown as { name: string }).name).to.equal("");
  });

  it("should handle special characters in table name", () => {
    const query = new Queryable<UserProfile>("user-profiles").where((u) => u.id === 1).build();

    expect((query.from.source as unknown as { name: string }).name).to.equal("user-profiles");
  });

  it("should handle no operations (just table)", () => {
    const query = new Queryable<User>("users").build();

    expect((query.from.source as unknown as { name: string }).name).to.equal("users");
    expect(query.where).to.be.undefined;
    expect(query.select).to.be.undefined;
    expect(query.orderBy).to.be.undefined;
  });

  it("should handle zero limit", () => {
    const query = new Queryable<User>("users").take(0).build();

    expect((query.limit as unknown as { value: number }).value).to.equal(0);
  });

  it("should handle negative numbers in WHERE", () => {
    const query = new Queryable<Account>("accounts").where((a) => a.balance < -100).build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal(-100);
  });

  it("should handle very large numbers", () => {
    const query = new Queryable<Transaction>("transactions")
      .where((t) => t.amount > 999999999999)
      .build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal(999999999999);
  });

  it("should handle decimal numbers", () => {
    const query = new Queryable<Product>("products").where((p) => p.price === 19.99).build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal(19.99);
  });

  it("should handle scientific notation", () => {
    const query = new Queryable<Measurement>("measurements").where((m) => m.value > 1.5e10).build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal(1.5e10);
  });

  it("should handle empty string comparison", () => {
    const query = new Queryable<User>("users").where((u) => u.middleName === "").build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal("");
  });

  it("should handle string with special characters", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.email === "test+user@example.com")
      .build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal("test+user@example.com");
  });

  it("should handle string with quotes", () => {
    const query = new Queryable<Message>("messages")
      .where((m) => m.content === 'He said "Hello"')
      .build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal('He said "Hello"');
  });

  it("should handle string with newlines", () => {
    const query = new Queryable<Post>("posts").where((p) => p.content === "Line 1\nLine 2").build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal("Line 1\nLine 2");
  });

  it("should handle Unicode characters", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.name === "José 李明 مُحَمَّد")
      .build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal("José 李明 مُحَمَّد");
  });

  it("should handle emoji", () => {
    const query = new Queryable<Message>("messages").where((m) => m.reaction === "👍").build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal("👍");
  });

  it("should handle deep nested properties", () => {
    const query = new Queryable<Data>("data")
      .where((d) => d.level1.level2.level3.level4.value === 42)
      .build();

    const whereExpr = assertBinaryExpression(query.where);
    let current = assertMemberExpression(whereExpr.left);
    let depth = 0;
    while (current.object && current.object.type === "member") {
      depth++;
      current = assertMemberExpression(current.object);
    }
    expect(depth).to.be.at.least(3);
  });

  it("should handle array index access", () => {
    const query = new Queryable<User>("users").where((u) => u.tags[0] === "admin").build();

    const whereExpr = assertBinaryExpression(query.where);
    const leftExpr = assertMemberExpression(whereExpr.left);
    expect(leftExpr.type).to.equal("member");
    expect(leftExpr.property).to.equal("0");
  });

  it("should handle multiple array indices", () => {
    const query = new Queryable<Matrix>("matrix").where((m) => m.data[0]![1]![2] === 42).build();

    const whereExpr = assertBinaryExpression(query.where);
    const leftExpr = assertMemberExpression(whereExpr.left);
    expect(leftExpr.type).to.equal("member");
  });

  it("should handle computed array index", () => {
    const query = new Queryable<Item>("items").select((i) => i.values[i.currentIndex]).build();

    const selectExpr = assertMemberExpression(query.select);
    expect(selectExpr.type).to.equal("member");
  });

  it("should handle empty object in SELECT", () => {
    const query = new Queryable<User>("users").select((_u) => ({})).build();

    const selectExpr = assertObjectExpression(query.select);
    expect(selectExpr.type).to.equal("object");
    expect(selectExpr.properties).to.have.lengthOf(0);
  });

  it("should handle empty array in SELECT", () => {
    const query = new Queryable<User>("users").select((_u) => []).build();

    const selectExpr = assertArrayExpression(query.select);
    expect(selectExpr.type).to.equal("array");
    expect(selectExpr.elements).to.have.lengthOf(0);
  });

  it("should handle undefined in array", () => {
    const query = new Queryable<Data>("data").select((d) => [d.a, undefined, d.b]).build();

    const selectExpr = assertArrayExpression(query.select);
    const element = assertConstantExpression(selectExpr.elements[1]);
    expect(element.type).to.equal("constant");
    expect(element.value).to.equal(undefined);
  });

  it("should handle complex boolean expressions", () => {
    const query = new Queryable<Item>("items").where((i) => !(i.a && i.b) || (i.c && !i.d)).build();

    const whereExpr = assertLogicalExpression(query.where);
    expect(whereExpr.type).to.equal("logical");
  });

  it("should handle division by variable", () => {
    const query = new Queryable<Metric>("metrics")
      .select((m) => ({
        average: m.total / m.count,
        percentage: (m.completed / m.total) * 100,
      }))
      .build();

    const selectExpr = assertObjectExpression(query.select);
    if (selectExpr.properties[0]) {
      const avgValue = assertBinaryExpression(selectExpr.properties[0].value);
      expect(avgValue.type).to.equal("binary");
      expect(avgValue.operator).to.equal("/");
    }
  });

  it("should handle chained comparisons (transformed)", () => {
    const query = new Queryable<NumberData>("numbers")
      .where((n) => n.value > 10 && n.value < 20)
      .build();

    const whereExpr = assertLogicalExpression(query.where);
    expect(whereExpr.type).to.equal("logical");
    expect(whereExpr.operator).to.equal("&&");
  });

  it("should handle self-referential expressions", () => {
    const query = new Queryable<Node>("nodes").where((n) => n.parentId === n.id).build();

    const whereExpr = assertBinaryExpression(query.where);
    const leftExpr = assertMemberExpression(whereExpr.left);
    const rightExpr = assertMemberExpression(whereExpr.right);
    expect(leftExpr.property).to.equal("parentId");
    expect(rightExpr.property).to.equal("id");
  });

  it("should handle COUNT with no arguments", () => {
    const query = new Queryable<User>("users").count();

    const selectExpr = assertCallExpression(query.select);
    expect(selectExpr.type).to.equal("call");
    expect(selectExpr.method).to.equal("COUNT");
    const arg = assertConstantExpression(selectExpr.arguments[0]);
    expect(arg.value).to.equal("*");
  });

  it("should handle multiple aggregates", () => {
    const users = new Queryable<User>("users");
    const countQuery = users.count();
    const sumQuery = users.sum((u) => u.points);
    const avgQuery = users.avg((u) => u.age);

    const countSelectExpr = assertCallExpression(countQuery.select);
    const sumSelectExpr = assertCallExpression(sumQuery.select);
    const avgSelectExpr = assertCallExpression(avgQuery.select);
    expect(countSelectExpr.method).to.equal("COUNT");
    expect(sumSelectExpr.method).to.equal("SUM");
    expect(avgSelectExpr.method).to.equal("AVG");
  });

  it("should handle WHERE after SELECT", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.isActive === true)
      .select((u) => ({
        id: u.id,
        isAdult: u.age >= 18,
      }))
      .build();

    expect(query.select).to.exist;
    expect(query.where).to.exist;
  });

  it("should handle ORDER BY after GROUP BY", () => {
    const query = new Queryable<Sale>("sales")
      .groupBy((s) => s.region)
      .orderBy((s) => s.region)
      .build();

    expect(query.groupBy).to.exist;
    expect(query.orderBy).to.have.lengthOf(1);
  });

  it("should handle whitespace in strings", () => {
    const query = new Queryable<User>("users").where((u) => u.name === "  John  Doe  ").build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal("  John  Doe  ");
  });

  it("should handle regex-like patterns in strings", () => {
    const query = new Queryable<Pattern>("patterns").where((p) => p.pattern === "^[a-z]+$").build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal("^[a-z]+$");
  });

  it("should handle SQL-like strings (potential injection)", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.name === "'; DROP TABLE users; --")
      .build();

    const whereExpr = assertBinaryExpression(query.where);
    const rightExpr = assertConstantExpression(whereExpr.right);
    expect(rightExpr.value).to.equal("'; DROP TABLE users; --");
  });

  it("should handle method chaining limit", () => {
    let q = new Queryable<User>("users");
    for (let i = 0; i < 100; i++) {
      q = q.where((_u) => _u.id !== i);
    }
    const query = q.build();

    expect(query.where).to.exist;
  });
});
