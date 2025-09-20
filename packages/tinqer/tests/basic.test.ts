/**
 * Basic Tests for Tinqer
 */

import { expect } from "chai";
import { Queryable } from "../src/index.js";
import { expr, param, compare } from "./utils/tree-helpers.js";

interface User {
  id: number;
  name: string;
  age: number;
  isActive: boolean;
}

describe("Basic Queries", () => {
  // Create reusable parameter for users table
  const u = param.table("u", "users");

  it("should generate simple WHERE expression", () => {
    const users = new Queryable<User>("users");
    const query = users.where((u) => u.age >= 18).build();

    expect(query.type).to.equal("query");
    expect(query.operation).to.equal("SELECT");
    expect(query.from).to.deep.equal({
      type: "source",
      source: { type: "table", name: "users" },
    });

    expect(query.where).to.deep.equal(compare.gte(expr.member("age", u), 18));
  });

  it("should generate SELECT projection", () => {
    const users = new Queryable<User>("users");
    const query = users.select((u) => ({ userId: u.id, userName: u.name })).build();

    // Now select contains just the body (object expression), not the lambda wrapper
    expect(query.select).to.deep.equal(
      expr.object([
        { key: "userId", value: expr.member("id", u) },
        { key: "userName", value: expr.member("name", u) },
      ]),
    );
  });

  it("should combine multiple WHERE conditions", () => {
    const users = new Queryable<User>("users");
    const query = users
      .where((u) => u.age >= 18)
      .where((u) => u.isActive === true)
      .build();

    expect(query.where).to.deep.equal(
      compare.and(
        compare.gte(expr.member("age", u), 18),
        compare.eq(expr.member("isActive", u), true),
      ),
    );
  });

  it("should handle ORDER BY", () => {
    const users = new Queryable<User>("users");
    const query = users
      .orderBy((u) => u.name)
      .orderByDescending((u) => u.age)
      .build();

    expect(query.orderBy).to.have.lengthOf(2);
    expect(query.orderBy![0]).to.deep.equal({
      type: "order",
      expression: expr.member("name", u),  // Now just the body, not wrapped in lambda
      direction: "ASC",
    });
    expect(query.orderBy![1]).to.deep.equal({
      type: "order",
      expression: expr.member("age", u),  // Now just the body, not wrapped in lambda
      direction: "DESC",
    });
  });

  it("should handle LIMIT and OFFSET", () => {
    const users = new Queryable<User>("users");
    const query = users.skip(10).take(5).build();

    expect(query.limit).to.deep.equal(expr.constant(5));
    expect(query.offset).to.deep.equal(expr.constant(10));
  });

  it("should handle DISTINCT", () => {
    const users = new Queryable<User>("users");
    const query = users.distinct().build();

    expect(query.distinct).to.be.true;
  });

  it("should handle COUNT aggregate", () => {
    const users = new Queryable<User>("users");
    const query = users.count();

    expect(query.select).to.deep.equal({
      type: "call",
      method: "COUNT",
      arguments: [expr.constant("*")],
    });
  });

  it("should handle SUM aggregate", () => {
    const users = new Queryable<User>("users");
    const query = users.sum((u) => u.age);

    expect(query.select).to.deep.equal({
      type: "call",
      method: "SUM",
      arguments: [expr.member("age", u)],
    });
  });
});
