/**
 * Tests for ORDER BY clause generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

describe("ORDER BY SQL Generation", () => {
  it("should generate ORDER BY with simple column", () => {
    const result = query(
      () => from<{ id: number; name: string }>("users").orderBy((x) => x.name),
      {},
    );

    expect(result.sql).to.equal("SELECT * FROM users AS t0 ORDER BY name ASC");
  });

  it("should generate ORDER BY DESC", () => {
    const result = query(
      () => from<{ id: number; createdAt: Date }>("posts").orderByDescending((x) => x.createdAt),
      {},
    );

    expect(result.sql).to.equal("SELECT * FROM posts AS t0 ORDER BY createdAt DESC");
  });

  it("should generate ORDER BY with THEN BY", () => {
    const result = query(
      () =>
        from<{ category: string; name: string; price: number }>("products")
          .orderBy((x) => x.category)
          .thenBy((x) => x.name),
      {},
    );

    expect(result.sql).to.equal("SELECT * FROM products AS t0 ORDER BY category ASC, name ASC");
  });

  it("should generate mixed ORDER BY and THEN BY DESC", () => {
    const result = query(
      () =>
        from<{ category: string; price: number; rating: number }>("products")
          .orderBy((x) => x.category)
          .thenByDescending((x) => x.rating)
          .thenBy((x) => x.price),
      {},
    );

    expect(result.sql).to.equal(
      "SELECT * FROM products AS t0 ORDER BY category ASC, rating DESC, price ASC",
    );
  });
});