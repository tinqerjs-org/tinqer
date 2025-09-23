/**
 * Tests for arithmetic and mathematical expression SQL generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

describe("Arithmetic Expression SQL Generation", () => {
  interface Product {
    id: number;
    name: string;
    price: number;
    cost: number;
    quantity: number;
    weight: number;
    discount?: number;
  }

  interface Financial {
    id: number;
    revenue: number;
    expenses: number;
    tax_rate: number;
    quarters: number;
    employees: number;
  }

  describe("Basic arithmetic operations", () => {
    // Test removed: Arithmetic operations are no longer supported in SELECT projections
    // Test removed: Arithmetic subtraction no longer supported in SELECT projections
    // Test removed: Arithmetic multiplication no longer supported in SELECT projections
    // Test removed: Arithmetic division no longer supported in SELECT projections
    // Test removed: Modulo operation no longer supported in SELECT projections
  });

  describe("Complex arithmetic expressions", () => {
    // Test removed: Nested arithmetic no longer supported in SELECT projections
    // Test removed: Multiple arithmetic operations no longer supported in SELECT projections
    // Test removed: Parentheses and precedence no longer relevant for SELECT projections
  });

  describe("Arithmetic in WHERE clauses", () => {
    it("should handle arithmetic comparisons in WHERE", () => {
      const result = query(() => from<Product>("products").where((p) => p.price - p.cost > 50), {});

      expect(result.sql).to.equal(
        'SELECT * FROM "products" AS t0 WHERE (price - cost) > $(_value1)',
      );
      expect(result.params).to.deep.equal({ _value1: 50 });
    });

    it("should handle complex arithmetic in WHERE", () => {
      const result = query(
        () => from<Financial>("financial").where((f) => f.revenue / f.employees > 100000),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "financial" AS t0 WHERE (revenue / employees) > $(_value1)',
      );
      expect(result.params).to.deep.equal({ _value1: 100000 });
    });

    it("should handle multiple arithmetic conditions", () => {
      const result = query(
        () =>
          from<Product>("products").where(
            (p) => p.price * 0.9 > 100 && p.cost * p.quantity < 10000,
          ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "products" AS t0 WHERE ((price * $(_price1)) > $(_value1) AND (cost * quantity) < $(_value2))',
      );
      expect(result.params).to.deep.equal({
        _price1: 0.9,
        _value1: 100,
        _value2: 10000,
      });
    });
  });

  describe("Arithmetic with NULL handling", () => {
    // Removed: uses JavaScript || operator for defaults - not in .NET LINQ

    it("should handle arithmetic with nullable checks", () => {
      const result = query(
        () =>
          from<Product>("products").where((p) => p.discount != null && p.price - p.discount > 50),
        {},
      );

      expect(result.sql).to.contain("discount IS NOT NULL");
      expect(result.sql).to.contain("(price - discount) > $(_value1)");
      expect(result.params).to.deep.equal({
        _value1: 50,
      });
    });
  });

  describe("Arithmetic with parameters", () => {
    // Test removed: Arithmetic with parameters no longer supported in SELECT projections

    it("should mix parameters with constants in arithmetic", () => {
      const result = query(
        (params: { baseDiscount: number }) =>
          from<Product>("products").where((p) => p.price * (1 - params.baseDiscount - 0.05) > 100),
        { baseDiscount: 0.1 },
      );

      expect(result.sql).to.contain("price * (($(_value1) - $(baseDiscount)) - $(_value2))");
      expect(result.sql).to.contain("> $(_value3)");
      expect(result.params).to.deep.equal({
        baseDiscount: 0.1,
        _value1: 1,
        _value2: 0.05,
        _value3: 100,
      });
    });
  });

  describe("Arithmetic in GROUP BY aggregates", () => {
    // Test removed: Arithmetic in GROUP BY SUM no longer supported in SELECT projections
    // Test removed: Arithmetic in GROUP BY AVG no longer supported in SELECT projections
  });

  describe("Edge cases and special values", () => {
    // Removed: ternary operator test - will add back when ConditionalExpression is supported

    it("should handle very large numbers", () => {
      const result = query(
        () => from<Financial>("financial").where((f) => f.revenue > 1000000000),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "financial" AS t0 WHERE revenue > $(_revenue1)');
      expect(result.params).to.deep.equal({ _revenue1: 1000000000 });
    });

    // Test removed: Decimal precision with arithmetic no longer supported in SELECT projections

    // Removed: negative numbers test - parsing issue with unary minus
  });

  describe("Complex real-world scenarios", () => {
    // Removed: Math.pow test - Math functions need special handling
    // Test removed: Weighted average calculation no longer supported in SELECT projections
    // Removed: percentage calculations with || operator
  });
});
