import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect, createSchema } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";

describe("GroupBy SQL Generation", () => {
  interface Sale {
    id: number;
    product: string;
    category: string;
    amount: number;
    quantity: number;
  }

  interface Schema {
    sales: Sale;
  }

  const schema = createSchema<Schema>();

  it("should generate GROUP BY clause", () => {
    const result = toSql(defineSelect(schema, (q) => q.from("sales").groupBy((s) => s.category)), {});

    expect(result.sql).to.equal('SELECT "category" FROM "sales" GROUP BY "category"');
  });

  it("should combine GROUP BY with WHERE", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("sales")
            .where((s) => s.amount > 100)
            .groupBy((s) => s.category),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT "category" FROM "sales" WHERE "amount" > $(__p1) GROUP BY "category"',
    );
    expect(result.params).to.deep.equal({ __p1: 100 });
  });

  it("should handle GROUP BY with SELECT projection", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("sales")
            .groupBy((s) => s.category)
            .select((g) => ({ category: g.key })),
      ),
      {},
    );

    expect(result.sql).to.equal('SELECT "category" AS "category" FROM "sales" GROUP BY "category"');
  });

  it("should work with GROUP BY and ORDER BY", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("sales")
            .groupBy((s) => s.product)
            .orderBy((g) => g.key),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT "product" FROM "sales" GROUP BY "product" ORDER BY "product" ASC',
    );
  });

  it("should handle GROUP BY with COUNT aggregate", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("sales")
            .groupBy((s) => s.category)
            .select((g) => ({ category: g.key, count: g.count() })),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT "category" AS "category", COUNT(*) AS "count" FROM "sales" GROUP BY "category"',
    );
  });

  it("should handle GROUP BY with SUM aggregate", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("sales")
            .groupBy((s) => s.category)
            .select((g) => ({
              category: g.key,
              totalAmount: g.sum((s) => s.amount),
            })),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT "category" AS "category", SUM("amount") AS "totalAmount" FROM "sales" GROUP BY "category"',
    );
  });

  it("should handle GROUP BY with multiple aggregates", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("sales")
            .groupBy((s) => s.category)
            .select((g) => ({
              category: g.key,
              count: g.count(),
              totalAmount: g.sum((s) => s.amount),
              avgAmount: g.avg((s) => s.amount),
            })),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT "category" AS "category", COUNT(*) AS "count", SUM("amount") AS "totalAmount", AVG("amount") AS "avgAmount" FROM "sales" GROUP BY "category"',
    );
  });

  it("should handle GROUP BY with WHERE and aggregates", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("sales")
            .where((s) => s.quantity > 10)
            .groupBy((s) => s.product)
            .select((g) => ({
              product: g.key,
              totalQuantity: g.sum((s) => s.quantity),
              maxAmount: g.max((s) => s.amount),
              minAmount: g.min((s) => s.amount),
            })),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT "product" AS "product", SUM("quantity") AS "totalQuantity", MAX("amount") AS "maxAmount", MIN("amount") AS "minAmount" FROM "sales" WHERE "quantity" > $(__p1) GROUP BY "product"',
    );
    expect(result.params).to.deep.equal({ __p1: 10 });
  });
});
