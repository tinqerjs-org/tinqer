/**
 * Tests for auto-parameterization with SQL generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("Auto-Parameterization SQL Generation", () => {
  it("should generate SQL with auto-parameterized constants", () => {
    const result = toSql(
      defineSelect(schema, (q) => q.from("users").where((x) => x.age >= 18 && x.name == "John")),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "users" WHERE ("age" >= $(__p1) AND "name" = $(__p2))',
    );
    expect(result.params).to.deep.equal({
      __p1: 18,
      __p2: "John",
    });
  });

  it("should merge user params with auto-params", () => {
    const result = toSql(
      defineSelect(schema, (q, p: { role: string }) =>
        q.from("users").where((x) => x.age >= 21 && x.role == p.role),
      ),
      { role: "admin" },
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "users" WHERE ("age" >= $(__p1) AND "role" = $(role))',
    );
    expect(result.params).to.deep.equal({
      role: "admin",
      __p1: 21,
    });
  });

  it("should handle take and skip auto-parameterization", () => {
    const result = toSql(
      defineSelect(schema, (q) =>
        q
          .from("posts")
          .orderBy((x) => x.id)
          .skip(20)
          .take(10),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "posts" ORDER BY "id" ASC LIMIT $(__p2) OFFSET $(__p1)',
    );
    expect(result.params).to.deep.equal({
      __p1: 20,
      __p2: 10,
    });
  });

  it("should handle complex query with multiple auto-params", () => {
    const result = toSql(
      defineSelect(schema, (q, p: { category: string }) =>
        q
          .from("products")
          .where((x) => x.price > 100)
          .where((x) => x.discount <= 0.5)
          .where((x) => x.category == p.category)
          .where((x) => x.inStock == true)
          .orderByDescending((x) => x.price)
          .skip(10)
          .take(5),
      ),
      { category: "electronics" },
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "products" WHERE "price" > $(__p1) ' +
        'AND "discount" <= $(__p2) ' +
        'AND "category" = $(category) ' +
        'AND "inStock" = $(__p3) ' +
        'ORDER BY "price" DESC LIMIT $(__p5) OFFSET $(__p4)',
    );
    expect(result.params).to.deep.equal({
      category: "electronics",
      __p1: 100,
      __p2: 0.5,
      __p3: true,
      __p4: 10,
      __p5: 5,
    });
  });

  it("should handle null comparisons with IS NULL/IS NOT NULL", () => {
    const result = toSql(
      defineSelect(schema, (q) => q.from("users").where((x) => x.email != null)),
      {},
    );

    expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" IS NOT NULL');
    expect(result.params).to.deep.equal({});
  });

  it("should handle multiple uses of same column", () => {
    const result = toSql(
      defineSelect(schema, (q) =>
        q
          .from("users")
          .where((x) => x.age >= 18)
          .where((x) => x.age <= 65)
          .where((x) => x.age != 30),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "users" WHERE "age" >= $(__p1) ' +
        'AND "age" <= $(__p2) ' +
        'AND "age" != $(__p3)',
    );
    expect(result.params).to.deep.equal({
      __p1: 18,
      __p2: 65,
      __p3: 30,
    });
  });

  it("should prevent SQL injection by parameterizing user input", () => {
    // This demonstrates the security benefit of auto-parameterization
    // Even if we had a way to pass strings that look like SQL injection,
    // they would be parameterized
    const result = toSql(
      defineSelect(schema, (q) => q.from("users").where((x) => x.username == "admin' OR '1'='1")),
      {},
    );

    // The potentially dangerous string is safely parameterized
    expect(result.sql).to.equal('SELECT * FROM "users" WHERE "username" = $(__p1)');
    expect(result.params).to.deep.equal({
      __p1: "admin' OR '1'='1", // Safely passed as parameter, not concatenated
    });
  });
});
