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
    const result = query(
      () => from<Sale>("sales").groupBy(s => s.category),
      {}
    );

    expect(result.sql).to.equal("SELECT * FROM sales AS t0 GROUP BY category");
  });

  it("should combine GROUP BY with WHERE", () => {
    const result = query(
      () => from<Sale>("sales")
        .where(s => s.amount > 100)
        .groupBy(s => s.category),
      {}
    );

    expect(result.sql).to.equal("SELECT * FROM sales AS t0 WHERE amount > 100 GROUP BY category");
  });

  it("should handle GROUP BY with SELECT projection", () => {
    const result = query(
      () => from<Sale>("sales")
        .groupBy(s => s.category)
        .select(g => ({ category: g.key })),
      {}
    );

    expect(result.sql).to.equal("SELECT key AS category FROM sales AS t0 GROUP BY category");
  });

  it("should work with GROUP BY and ORDER BY", () => {
    const result = query(
      () => from<Sale>("sales")
        .groupBy(s => s.product)
        .orderBy(g => g.key),
      {}
    );

    expect(result.sql).to.equal("SELECT * FROM sales AS t0 GROUP BY product ORDER BY key ASC");
  });
});