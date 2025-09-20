import { Queryable } from "../src/queryable/queryable.js";
import { expect } from "chai";
import {
  assertCallExpression,
  assertMemberExpression,
  assertBinaryExpression,
  assertObjectExpression,
} from "./test-helpers.js";

// Define test interfaces
interface User {
  email: string;
  code: string;
  name: string;
  firstName: string;
  lastName: string;
  title: string;
}

interface Code {
  value: string;
}

interface Product {
  name: string;
}

interface Message {
  id: number;
  text: string;
}

interface Data {
  value: string;
}

interface File {
  name: string;
}

interface Article {
  content: string;
}

interface Comment {
  text: string;
}

interface Item {
  id: number;
  name: string;
}

describe("String Operations", () => {
  it("should handle toLowerCase method", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.email.toLowerCase() === "john@example.com")
      .build();

    const binExpr = assertBinaryExpression(query.where);
    const callExpr = assertCallExpression(binExpr.left);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("toLowerCase");
    expect(assertMemberExpression(callExpr.callee).type).to.equal("member");
  });

  it("should handle toUpperCase method", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.code.toUpperCase() === "ABC123")
      .build();

    const binExpr = assertBinaryExpression(query.where);
    const callExpr = assertCallExpression(binExpr.left);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("toUpperCase");
  });

  it("should handle string methods in SELECT", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        id: 1,
        name: u.name.toUpperCase(),
        email: u.email.toLowerCase(),
        initials: u.firstName[0]! + u.lastName[0]!,
      }))
      .build();

    // Select expression is already extracted, no lambda wrapper
    const objExpr = assertObjectExpression(query.select);
    expect(objExpr.properties).to.have.lengthOf(4);
  });

  it("should handle trim method", () => {
    const query = new Queryable<User>("users").where((u) => u.name.trim() === "John Doe").build();

    const binExpr = assertBinaryExpression(query.where);
    const callExpr = assertCallExpression(binExpr.left);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("trim");
  });

  it("should handle string concatenation", () => {
    const query = new Queryable<User>("users")
      .select((u) => ({
        fullName: u.firstName + " " + u.lastName,
        displayName: u.title + ". " + u.lastName,
      }))
      .build();

    // Select expression is already extracted, no lambda wrapper
    const objExpr = assertObjectExpression(query.select);
    const binExpr = assertBinaryExpression(objExpr.properties[0]?.value);
    expect(binExpr.type).to.equal("binary");
    expect(binExpr.operator).to.equal("+");
  });

  it("should handle substring method", () => {
    const query = new Queryable<Code>("codes")
      .where((c) => c.value.substring(0, 3) === "ABC")
      .build();

    const binExpr = assertBinaryExpression(query.where);
    const callExpr = assertCallExpression(binExpr.left);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("substring");
    expect(callExpr.arguments).to.have.lengthOf(2);
  });

  it("should handle indexOf method", () => {
    const query = new Queryable<Product>("products")
      .where((p) => p.name.indexOf("Phone") >= 0)
      .build();

    const binExpr = assertBinaryExpression(query.where);
    const callExpr = assertCallExpression(binExpr.left);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("indexOf");
  });

  it("should handle replace method", () => {
    const query = new Queryable<Message>("messages")
      .select((m) => ({
        id: m.id,
        cleanText: m.text.replace("-", " "),
      }))
      .build();

    // Select expression is already extracted, no lambda wrapper
    const objExpr = assertObjectExpression(query.select);
    const callExpr = assertCallExpression(objExpr.properties[1]?.value);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("replace");
  });

  it("should handle split method", () => {
    const query = new Queryable<Data>("data")
      .select((d) => ({
        parts: d.value.split(","),
      }))
      .build();

    // Select expression is already extracted, no lambda wrapper
    const objExpr = assertObjectExpression(query.select);
    const callExpr = assertCallExpression(objExpr.properties[0]?.value);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("split");
  });

  it("should handle startsWith method", () => {
    const query = new Queryable<File>("files").where((f) => f.name.startsWith("doc_")).build();

    const callExpr = assertCallExpression(query.where);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("startsWith");
  });

  it("should handle endsWith method", () => {
    const query = new Queryable<File>("files").where((f) => f.name.endsWith(".pdf")).build();

    const callExpr = assertCallExpression(query.where);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("endsWith");
  });

  it("should handle includes method", () => {
    const query = new Queryable<Article>("articles")
      .where((a) => a.content.includes("JavaScript"))
      .build();

    const callExpr = assertCallExpression(query.where);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("includes");
  });

  it("should handle charAt method", () => {
    const query = new Queryable<Code>("codes").where((c) => c.value.charAt(0) === "A").build();

    const binExpr = assertBinaryExpression(query.where);
    const callExpr = assertCallExpression(binExpr.left);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("charAt");
  });

  it("should handle length property", () => {
    const query = new Queryable<Comment>("comments").where((c) => c.text.length > 100).build();

    const binExpr = assertBinaryExpression(query.where);
    const memberExpr = assertMemberExpression(binExpr.left);
    expect(memberExpr.type).to.equal("member");
    expect(memberExpr.property).to.equal("length");
  });

  it("should handle chained string methods", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.name.trim().toLowerCase() === "john doe")
      .build();

    const binExpr = assertBinaryExpression(query.where);
    const callExpr = assertCallExpression(binExpr.left);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("toLowerCase");
    const innerCallExpr = assertCallExpression(callExpr.callee);
    expect(innerCallExpr.type).to.equal("call");
    expect(innerCallExpr.method).to.equal("trim");
  });

  it("should handle padStart method", () => {
    const query = new Queryable<Item>("items")
      .select((i) => ({
        code: i.id.toString().padStart(5, "0"),
      }))
      .build();

    // Select expression is already extracted, no lambda wrapper
    const objExpr = assertObjectExpression(query.select);
    const callExpr = assertCallExpression(objExpr.properties[0]?.value);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("padStart");
  });

  it("should handle padEnd method", () => {
    const query = new Queryable<Item>("items")
      .select((i) => ({
        label: i.name.padEnd(20, "."),
      }))
      .build();

    // Select expression is already extracted, no lambda wrapper
    const objExpr = assertObjectExpression(query.select);
    const callExpr = assertCallExpression(objExpr.properties[0]?.value);
    expect(callExpr.type).to.equal("call");
    expect(callExpr.method).to.equal("padEnd");
  });
});
