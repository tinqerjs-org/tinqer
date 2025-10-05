import { describe, it } from "mocha";
import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
import { db } from "./test-schema.js";

describe("Distinct SQL Generation", () => {
  it("should generate DISTINCT for all columns", () => {
    const result = selectStatement(db, (ctx) => ctx.from("products").distinct(), {});

    expect(result.sql).to.equal('SELECT DISTINCT * FROM "products"');
  });

  it("should combine DISTINCT with WHERE", () => {
    const result = selectStatement(
      db,
      (ctx) =>
        ctx
          .from("products")
          .where((p) => p.price > 100)
          .distinct(),
      {},
    );

    expect(result.sql).to.equal('SELECT DISTINCT * FROM "products" WHERE "price" > @__p1');
    expect(result.params).to.deep.equal({ __p1: 100 });
  });

  it("should combine DISTINCT with SELECT projection", () => {
    const result = selectStatement(
      db,
      (ctx) =>
        ctx
          .from("products")
          .select((p) => ({ category: p.category }))
          .distinct(),
      {},
    );

    expect(result.sql).to.equal('SELECT DISTINCT "category" AS "category" FROM "products"');
  });

  it("should work with DISTINCT, WHERE, and ORDER BY", () => {
    const result = selectStatement(
      db,
      (ctx) =>
        ctx
          .from("products")
          .where((p) => p.price < 500)
          .distinct()
          .orderBy((p) => p.brand),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT DISTINCT * FROM "products" WHERE "price" < @__p1 ORDER BY "brand" ASC',
    );
    expect(result.params).to.deep.equal({ __p1: 500 });
  });
});
