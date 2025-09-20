/**
 * GROUP BY and Aggregate Tests for Tinqer
 */

import { expect } from "chai";
import { Queryable } from "../src/index.js";
import { expr, param, compare } from "./utils/tree-helpers.js";

interface Order {
  id: number;
  userId: number;
  productId: number;
  quantity: number;
  price: number;
  status: string;
  category: string;
}

describe("GROUP BY with Aggregates", () => {
  // Create reusable parameter for orders table
  const o = param.table("o", "orders");

  it("should handle COUNT with GROUP BY", () => {
    const orders = new Queryable<Order>("orders");
    const query = orders.groupBy((o) => o.category).count();

    // The query should have both GROUP BY and COUNT
    // Now groupBy contains just the body, not the lambda wrapper
    expect(query.groupBy).to.deep.equal(expr.member("category", o));

    expect(query.select).to.deep.equal({
      type: "call",
      method: "COUNT",
      arguments: [expr.constant("*")],
    });
  });

  it("should handle SUM with GROUP BY", () => {
    const orders = new Queryable<Order>("orders");
    const query = orders.groupBy((o) => o.userId).sum((o) => o.price * o.quantity);

    // The query should have GROUP BY
    expect(query.groupBy).to.deep.equal(expr.member("userId", o));

    // And SUM of price * quantity
    expect(query.select).to.deep.equal({
      type: "call",
      method: "SUM",
      arguments: [expr.binary(expr.member("price", o), "*", expr.member("quantity", o))],
    });
  });

  it("should handle AVG with GROUP BY", () => {
    const orders = new Queryable<Order>("orders");
    const query = orders.groupBy((o) => o.productId).avg((o) => o.price);

    expect(query.groupBy).to.deep.equal(expr.member("productId", o));

    expect(query.select).to.deep.equal({
      type: "call",
      method: "AVG",
      arguments: [expr.member("price", o)],
    });
  });

  it("should handle MIN with GROUP BY", () => {
    const orders = new Queryable<Order>("orders");
    const query = orders.groupBy((o) => o.status).min((o) => o.price);

    expect(query.groupBy).to.deep.equal(expr.member("status", o));

    expect(query.select).to.deep.equal({
      type: "call",
      method: "MIN",
      arguments: [expr.member("price", o)],
    });
  });

  it("should handle MAX with GROUP BY", () => {
    const orders = new Queryable<Order>("orders");
    const query = orders.groupBy((o) => o.category).max((o) => o.quantity);

    expect(query.groupBy).to.deep.equal(expr.member("category", o));

    expect(query.select).to.deep.equal({
      type: "call",
      method: "MAX",
      arguments: [expr.member("quantity", o)],
    });
  });

  it("should handle GROUP BY with HAVING", () => {
    const orders = new Queryable<Order>("orders");
    const query = orders
      .groupBy((o) => o.userId)
      .having((o) => o.userId > 100)
      .count();

    expect(query.groupBy).to.deep.equal(expr.member("userId", o));

    expect(query.having).to.deep.equal(compare.gt(expr.member("userId", o), 100));

    expect(query.select).to.deep.equal({
      type: "call",
      method: "COUNT",
      arguments: [expr.constant("*")],
    });
  });

  it("should handle GROUP BY with WHERE and HAVING", () => {
    const orders = new Queryable<Order>("orders");
    const query = orders
      .where((o) => o.status === "completed")
      .groupBy((o) => o.category)
      .having((o) => o.category !== "electronics")
      .sum((o) => o.price);

    // WHERE filters before grouping
    expect(query.where).to.deep.equal(compare.eq(expr.member("status", o), "completed"));

    // GROUP BY the category
    expect(query.groupBy).to.deep.equal(expr.member("category", o));

    // HAVING filters after grouping
    expect(query.having).to.deep.equal(compare.neq(expr.member("category", o), "electronics"));

    // SUM the prices
    expect(query.select).to.deep.equal({
      type: "call",
      method: "SUM",
      arguments: [expr.member("price", o)],
    });
  });

  it("should preserve GROUP BY through method chain", () => {
    const orders = new Queryable<Order>("orders");
    const baseQuery = orders.where((o) => o.price > 10).groupBy((o) => o.userId);

    // Different aggregates on same grouped query
    const countQuery = baseQuery.count();
    const sumQuery = baseQuery.sum((o) => o.price);

    // Both should have the same GROUP BY
    expect(countQuery.groupBy).to.deep.equal(sumQuery.groupBy);
    expect(countQuery.groupBy).to.deep.equal(
      expr.member("userId", o),
    );

    // But different SELECT clauses
    expect(countQuery.select).to.have.property("method", "COUNT");
    expect(sumQuery.select).to.have.property("method", "SUM");
  });
});

describe("GROUP BY edge cases", () => {
  const o = param.table("o", "orders");

  it("should handle complex GROUP BY expression", () => {
    const orders = new Queryable<Order>("orders");
    const query = orders.groupBy((o) => (o.price > 100 ? "high" : "low")).count();

    // GROUP BY with conditional expression
    // Now groupBy contains just the body, not the lambda wrapper
    expect(query.groupBy).to.deep.equal(
      expr.conditional(
        compare.gt(expr.member("price", o), 100),
        expr.constant("high"),
        expr.constant("low"),
      ),
    );
  });

  it("should handle GROUP BY with multiple aggregate calls", () => {
    const orders = new Queryable<Order>("orders");

    // Note: Currently each aggregate method returns a QueryExpression
    // In a real implementation, you might want a way to select multiple aggregates
    // For now, each call replaces the SELECT

    const countQuery = orders.groupBy((o) => o.userId).count();
    const sumQuery = orders.groupBy((o) => o.userId).sum((o) => o.price);

    // Each creates a separate query with its own aggregate
    expect(countQuery.select).to.have.property("method", "COUNT");
    expect(sumQuery.select).to.have.property("method", "SUM");
  });
});
