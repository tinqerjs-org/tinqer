/**
 * Tests for ORDER BY clause generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("ORDER BY SQL Generation", () => {
  it("should generate ORDER BY with simple column", () => {
    const result = selectStatement(schema, (q) => q.from("users").orderBy((x) => x.name), {});

    expect(result.sql).to.equal('SELECT * FROM "users" ORDER BY "name" ASC');
  });

  it("should generate ORDER BY DESC", () => {
    const result = selectStatement(
      schema,
      (q) => q.from("posts").orderByDescending((x) => x.createdAt),
      {},
    );

    expect(result.sql).to.equal('SELECT * FROM "posts" ORDER BY "createdAt" DESC');
  });

  it("should generate ORDER BY with THEN BY", () => {
    const result = selectStatement(
      schema,
      (q) =>
        q
          .from("products")
          .orderBy((x) => x.category)
          .thenBy((x) => x.name),
      {},
    );

    expect(result.sql).to.equal('SELECT * FROM "products" ORDER BY "category" ASC, "name" ASC');
  });

  it("should generate mixed ORDER BY and THEN BY DESC", () => {
    const result = selectStatement(
      schema,
      (q) =>
        q
          .from("products")
          .orderBy((x) => x.category)
          .thenByDescending((x) => x.rating)
          .thenBy((x) => x.price),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "products" ORDER BY "category" ASC, "rating" DESC, "price" ASC',
    );
  });
});
