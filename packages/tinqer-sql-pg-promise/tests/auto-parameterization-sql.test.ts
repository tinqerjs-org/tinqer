/**
 * Tests for auto-parameterization with SQL generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

describe("Auto-Parameterization SQL Generation", () => {
  it("should generate SQL with auto-parameterized constants", () => {
    const queryBuilder = () =>
      from<{ age: number; name: string }>("users").where((x) => x.age >= 18 && x.name == "John");

    const result = query(queryBuilder, {});

    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS t0 WHERE (age >= $(_age1) AND name = $(_name1))',
    );
    expect(result.params).to.deep.equal({
      _age1: 18,
      _name1: "John",
    });
  });

  it("should merge user params with auto-params", () => {
    const queryBuilder = (p: { role: string }) =>
      from<{ age: number; role: string }>("users").where((x) => x.age >= 21 && x.role == p.role);

    const result = query(queryBuilder, { role: "admin" });

    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS t0 WHERE (age >= $(_age1) AND role = $(role))',
    );
    expect(result.params).to.deep.equal({
      role: "admin",
      _age1: 21,
    });
  });

  it("should handle take and skip auto-parameterization", () => {
    const queryBuilder = () =>
      from<{ id: number }>("posts")
        .orderBy((x) => x.id)
        .skip(20)
        .take(10);

    const result = query(queryBuilder, {});

    expect(result.sql).to.equal(
      'SELECT * FROM "posts" AS t0 ORDER BY id ASC LIMIT $(_limit1) OFFSET $(_offset1)',
    );
    expect(result.params).to.deep.equal({
      _offset1: 20,
      _limit1: 10,
    });
  });

  it("should handle complex query with multiple auto-params", () => {
    const queryBuilder = (p: { category: string }) =>
      from<{ price: number; discount: number; category: string; inStock: boolean }>("products")
        .where((x) => x.price > 100)
        .where((x) => x.discount <= 0.5)
        .where((x) => x.category == p.category)
        .where((x) => x.inStock == true)
        .orderByDescending((x) => x.price)
        .skip(10)
        .take(5);

    const result = query(queryBuilder, { category: "electronics" });

    expect(result.sql).to.equal(
      'SELECT * FROM "products" AS t0 WHERE price > $(_price1) ' +
        "AND discount <= $(_discount1) " +
        "AND category = $(category) " +
        "AND inStock = $(_inStock1) " +
        "ORDER BY price DESC LIMIT $(_limit1) OFFSET $(_offset1)",
    );
    expect(result.params).to.deep.equal({
      category: "electronics",
      _price1: 100,
      _discount1: 0.5,
      _inStock1: true,
      _offset1: 10,
      _limit1: 5,
    });
  });

  it("should handle null auto-parameterization", () => {
    const queryBuilder = () =>
      from<{ email: string | null }>("users").where((x) => x.email != null);

    const result = query(queryBuilder, {});

    expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE email != $(_email1)');
    expect(result.params).to.deep.equal({
      _email1: null,
    });
  });

  it("should handle multiple uses of same column", () => {
    const queryBuilder = () =>
      from<{ age: number }>("users")
        .where((x) => x.age >= 18)
        .where((x) => x.age <= 65)
        .where((x) => x.age != 30);

    const result = query(queryBuilder, {});

    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS t0 WHERE age >= $(_age1) ' +
        "AND age <= $(_age2) " +
        "AND age != $(_age3)",
    );
    expect(result.params).to.deep.equal({
      _age1: 18,
      _age2: 65,
      _age3: 30,
    });
  });

  it("should prevent SQL injection by parameterizing user input", () => {
    // This demonstrates the security benefit of auto-parameterization
    // Even if we had a way to pass strings that look like SQL injection,
    // they would be parameterized
    const queryBuilder = () =>
      from<{ username: string }>("users").where((x) => x.username == "admin' OR '1'='1");

    const result = query(queryBuilder, {});

    // The potentially dangerous string is safely parameterized
    expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE username = $(_username1)');
    expect(result.params).to.deep.equal({
      _username1: "admin' OR '1'='1", // Safely passed as parameter, not concatenated
    });
  });
});
