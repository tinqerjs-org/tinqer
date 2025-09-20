import { Queryable } from "../src/queryable/queryable.js";
import { expect } from "chai";
import {
  assertMemberExpression,
  assertObjectExpression,
  assertArrayExpression,
  assertBinaryExpression,
  assertCallExpression,
  assertConditionalExpression,
  assertLogicalExpression,
  assertConstantExpression,
} from "./test-helpers.js";
import type { LambdaExpression } from "../src/types/expressions.js";

// Define test interfaces
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  firstName: string;
  lastName: string;
  address: {
    city: string;
    country: string;
  };
  profile: {
    avatar: {
      url: string;
    };
  };
  status: string;
  role: string;
  isVerified: boolean;
  isSuspended: boolean;
  isActive: boolean;
  tags: string[];
  phone?: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  isOnSale: boolean;
  cost: number;
}

interface Order {
  price: number;
  quantity: number;
  total: number;
}

describe("Complex SELECT Projections", () => {
  it("should handle simple property selection", () => {
    const query = new Queryable<User>("users").select((u) => u.email).build();

    const selectExpr = query.select as LambdaExpression;
    const memberExpr = assertMemberExpression(selectExpr.body);
    expect(memberExpr.type).to.equal("member");
    expect(memberExpr.property).to.equal("email");
  });

  it("should handle object projection", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    expect(objExpr.type).to.equal("object");
    expect(objExpr.properties).to.have.lengthOf(3);
  });

  it("should handle nested object projection", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        id: u.id,
        personal: {
          name: u.name,
          age: u.age,
        },
        contact: {
          email: u.email,
          phone: u.phone || "",
        },
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    expect(objExpr.type).to.equal("object");
    expect(assertObjectExpression(objExpr.properties[1]?.value).type).to.equal("object");
  });

  it("should handle computed fields", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        id: u.id,
        fullName: u.firstName + " " + u.lastName,
        isAdult: u.age >= 18,
        ageGroup: u.age < 18 ? "minor" : u.age < 65 ? "adult" : "senior",
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    expect(assertBinaryExpression(objExpr.properties[1]?.value).type).to.equal("binary");
    expect(assertBinaryExpression(objExpr.properties[2]?.value).type).to.equal("binary");
    expect(assertConditionalExpression(objExpr.properties[3]?.value).type).to.equal("conditional");
  });

  it("should handle array projection", () => {
    const query = new Queryable<User>("users").select((u) => [u.id, u.name, u.email]).build();

    const selectExpr = query.select as LambdaExpression;
    const arrExpr = assertArrayExpression(selectExpr.body);
    expect(arrExpr.type).to.equal("array");
    expect(arrExpr.elements).to.have.lengthOf(3);
  });

  it("should handle mixed array with literals", () => {
    const query = new Queryable<User>("users").select((u) => [u.id, "USER", u.name, true]).build();

    const selectExpr = query.select as LambdaExpression;
    const arrExpr = assertArrayExpression(selectExpr.body);
    expect(arrExpr.type).to.equal("array");
    const constExpr = assertConstantExpression(arrExpr.elements[1]);
    expect(constExpr.type).to.equal("constant");
    expect(constExpr.value).to.equal("USER");
  });

  it("should handle nested property access", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        city: u.address.city,
        country: u.address.country,
        profilePic: u.profile.avatar.url,
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    expect(assertMemberExpression(objExpr.properties[0]?.value).type).to.equal("member");
    const prop2 = assertMemberExpression(objExpr.properties[2]?.value);
    expect(assertMemberExpression(prop2.object).type).to.equal("member");
  });

  it("should handle conditional expressions", () => {
    const query = new Queryable<Product>("products")
      .select((p) => ({
        id: p.id,
        name: p.name,
        status: p.stock > 0 ? "in-stock" : "out-of-stock",
        discount: p.isOnSale ? p.price * 0.2 : 0,
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    expect(assertConditionalExpression(objExpr.properties[2]?.value).type).to.equal("conditional");
    expect(assertConditionalExpression(objExpr.properties[3]?.value).type).to.equal("conditional");
  });

  it("should handle nested conditionals", () => {
    const query = new Queryable<Order>("orders")
      .select((o) => ({
        priority: o.total > 1000 ? "high" : o.total > 500 ? "medium" : "low",
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    const condExpr = assertConditionalExpression(objExpr.properties[0]?.value);
    expect(condExpr.type).to.equal("conditional");
    expect(assertConditionalExpression(condExpr.alternate).type).to.equal("conditional");
  });

  it("should handle arithmetic expressions", () => {
    const query = new Queryable<Order>("orders")
      .select((o) => ({
        subtotal: o.price * o.quantity,
        tax: o.price * o.quantity * 0.08,
        total: o.price * o.quantity * 1.08,
        averagePrice: o.total / o.quantity,
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    const binExpr = assertBinaryExpression(objExpr.properties[0]?.value);
    expect(binExpr.type).to.equal("binary");
    expect(binExpr.operator).to.equal("*");
  });

  it("should handle boolean expressions", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        isActive: u.status === "active",
        canEdit: u.role === "admin" || u.role === "editor",
        isRestricted: !u.isVerified || u.isSuspended,
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    expect(assertBinaryExpression(objExpr.properties[0]?.value).type).to.equal("binary");
    expect(assertLogicalExpression(objExpr.properties[1]?.value).type).to.equal("logical");
    expect(assertLogicalExpression(objExpr.properties[2]?.value).type).to.equal("logical");
  });

  it("should handle SELECT with literal values", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        id: u.id,
        type: "user",
        version: 1,
        isTest: false,
        metadata: null,
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    const constExpr1 = assertConstantExpression(objExpr.properties[1]?.value);
    expect(constExpr1.type).to.equal("constant");
    expect(constExpr1.value).to.equal("user");
    const constExpr2 = assertConstantExpression(objExpr.properties[2]?.value);
    expect(constExpr2.value).to.equal(1);
  });

  it("should handle SELECT with method calls", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        id: u.id,
        emailLower: u.email.toLowerCase(),
        nameUpper: u.name.toUpperCase(),
        initials: u.firstName.charAt(0) + u.lastName.charAt(0),
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    expect(assertCallExpression(objExpr.properties[1]?.value).type).to.equal("call");
    expect(assertBinaryExpression(objExpr.properties[3]?.value).type).to.equal("binary");
  });

  it("should handle SELECT with complex expressions", () => {
    const query = new Queryable<Product>("products")
      .select((p) => ({
        id: p.id,
        displayPrice: "$" + p.price.toFixed(2),
        stockStatus:
          p.stock === 0
            ? "Out of Stock"
            : p.stock < 10
              ? "Low Stock (" + p.stock + ")"
              : "In Stock",
        profitMargin: ((p.price - p.cost) / p.price) * 100,
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    expect(assertBinaryExpression(objExpr.properties[1]?.value).type).to.equal("binary");
    expect(assertConditionalExpression(objExpr.properties[2]?.value).type).to.equal("conditional");
  });

  it("should handle SELECT with array methods", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        tags: u.tags.join(", "),
        firstTag: u.tags[0],
        tagCount: u.tags.length,
      }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    const objExpr = assertObjectExpression(selectExpr.body);
    expect(assertCallExpression(objExpr.properties[0]?.value).type).to.equal("call");
    expect(assertMemberExpression(objExpr.properties[1]?.value).type).to.equal("member");
    expect(assertMemberExpression(objExpr.properties[2]?.value).type).to.equal("member");
  });

  it("should handle destructuring-like patterns", () => {
    const query = new Queryable<User>("users")
      .select(({ id, name, email }) => ({ id, name, email }))
      .build();

    const selectExpr = query.select as LambdaExpression;
    expect(selectExpr.parameters).to.have.lengthOf(1);
    const objExpr = assertObjectExpression(selectExpr.body);
    expect(objExpr.type).to.equal("object");
  });

  it("should handle SELECT after WHERE", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.isActive)
      .select((u) => ({
        id: u.id,
        displayName: u.firstName + " " + u.lastName[0] + ".",
      }))
      .build();

    expect(query.where).to.exist;
    expect(query.select).to.exist;
  });
});
