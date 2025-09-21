import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

describe("Distinct SQL Generation", () => {
  interface Product {
    id: number;
    category: string;
    brand: string;
    price: number;
  }

  it("should generate DISTINCT for all columns", () => {
    const result = query(
      () => from<Product>("products").distinct(),
      {}
    );

    expect(result.sql).to.equal("SELECT DISTINCT * FROM products AS t0");
  });

  it("should combine DISTINCT with WHERE", () => {
    const result = query(
      () => from<Product>("products")
        .where(p => p.price > 100)
        .distinct(),
      {}
    );

    expect(result.sql).to.equal("SELECT DISTINCT * FROM products AS t0 WHERE price > 100");
  });

  it("should combine DISTINCT with SELECT projection", () => {
    const result = query(
      () => from<Product>("products")
        .select(p => ({ category: p.category }))
        .distinct(),
      {}
    );

    expect(result.sql).to.equal("SELECT DISTINCT category AS category FROM products AS t0");
  });

  it("should work with DISTINCT, WHERE, and ORDER BY", () => {
    const result = query(
      () => from<Product>("products")
        .where(p => p.price < 500)
        .distinct()
        .orderBy(p => p.brand),
      {}
    );

    expect(result.sql).to.equal("SELECT DISTINCT * FROM products AS t0 WHERE price < 500 ORDER BY brand ASC");
  });
});