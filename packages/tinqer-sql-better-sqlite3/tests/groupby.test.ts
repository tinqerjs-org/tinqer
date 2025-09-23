import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

describe("GroupBy SQL Generation", () => {
  interface Sale {
    id: number;
    product: string;
    category: string;
    amount: number;
    quantity: number;
  }

  it("should generate GROUP BY clause", () => {
    const result = query(() => from<Sale>("sales").groupBy((s) => s.category), {});

    expect(result.sql).to.equal('SELECT * FROM "sales" AS t0 GROUP BY category');
  });

  it("should combine GROUP BY with WHERE", () => {
    const result = query(
      () =>
        from<Sale>("sales")
          .where((s) => s.amount > 100)
          .groupBy((s) => s.category),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "sales" AS t0 WHERE amount > :_amount1 GROUP BY category',
    );
    expect(result.params).to.deep.equal({ _amount1: 100 });
  });

  it("should handle GROUP BY with SELECT projection", () => {
    const result = query(
      () =>
        from<Sale>("sales")
          .groupBy((s) => s.category)
          .select((g) => ({ category: g.key })),
      {},
    );

    expect(result.sql).to.equal('SELECT key AS category FROM "sales" AS t0 GROUP BY category');
  });

  it("should work with GROUP BY and ORDER BY", () => {
    const result = query(
      () =>
        from<Sale>("sales")
          .groupBy((s) => s.product)
          .orderBy((g) => g.key),
      {},
    );

    expect(result.sql).to.equal('SELECT * FROM "sales" AS t0 GROUP BY product ORDER BY key ASC');
  });

  it("should handle GROUP BY with COUNT aggregate", () => {
    const result = query(
      () =>
        from<Sale>("sales")
          .groupBy((s) => s.category)
          .select((g) => ({ category: g.key, count: g.count() })),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT key AS category, COUNT(*) AS count FROM "sales" AS t0 GROUP BY category',
    );
  });

  it("should handle GROUP BY with SUM aggregate", () => {
    const result = query(
      () =>
        from<Sale>("sales")
          .groupBy((s) => s.category)
          .select((g) => ({
            category: g.key,
            totalAmount: g.sum((s) => s.amount),
          })),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT key AS category, SUM(amount) AS totalAmount FROM "sales" AS t0 GROUP BY category',
    );
  });

  it("should handle GROUP BY with multiple aggregates", () => {
    const result = query(
      () =>
        from<Sale>("sales")
          .groupBy((s) => s.category)
          .select((g) => ({
            category: g.key,
            count: g.count(),
            totalAmount: g.sum((s) => s.amount),
            avgAmount: g.avg((s) => s.amount),
          })),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT key AS category, COUNT(*) AS count, SUM(amount) AS totalAmount, AVG(amount) AS avgAmount FROM "sales" AS t0 GROUP BY category',
    );
  });

  it("should handle GROUP BY with WHERE and aggregates", () => {
    const result = query(
      () =>
        from<Sale>("sales")
          .where((s) => s.quantity > 10)
          .groupBy((s) => s.product)
          .select((g) => ({
            product: g.key,
            totalQuantity: g.sum((s) => s.quantity),
            maxAmount: g.max((s) => s.amount),
            minAmount: g.min((s) => s.amount),
          })),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT key AS product, SUM(quantity) AS totalQuantity, MAX(amount) AS maxAmount, MIN(amount) AS minAmount FROM "sales" AS t0 WHERE quantity > :_quantity1 GROUP BY product',
    );
    expect(result.params).to.deep.equal({ _quantity1: 10 });
  });
});
