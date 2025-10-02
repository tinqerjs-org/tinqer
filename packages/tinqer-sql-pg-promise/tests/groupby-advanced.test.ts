/**
 * Advanced GROUP BY tests
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { selectStatement } from "../dist/index.js";

describe("Advanced GROUP BY SQL Generation", () => {
  interface Sale {
    id: number;
    productId: number;
    productName: string;
    categoryId: number;
    category: string;
    region: string;
    salesperson: string;
    amount: number;
    quantity: number;
    discount: number;
    saleDate: Date;
    profit: number;
  }

  interface Employee {
    id: number;
    name: string;
    department: string;
    title: string;
    salary: number;
    bonus?: number;
    hireYear: number;
  }

  describe("GROUP BY with all aggregate functions", () => {
    it("should use all aggregate functions together", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .groupBy((s) => s.category)
            .select((g) => ({
              category: g.key,
              totalSales: g.sum((s) => s.amount),
              avgSale: g.avg((s) => s.amount),
              maxSale: g.max((s) => s.amount),
              minSale: g.min((s) => s.amount),
              saleCount: g.count(),
            })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "category" AS "category", SUM("amount") AS "totalSales", AVG("amount") AS "avgSale", MAX("amount") AS "maxSale", MIN("amount") AS "minSale", COUNT(*) AS "saleCount" FROM "sales" GROUP BY "category"',
      );
    });

    it("should handle different columns for different aggregates", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .groupBy((s) => s.region)
            .select((g) => ({
              region: g.key,
              totalRevenue: g.sum((s) => s.amount),
              totalQuantity: g.sum((s) => s.quantity),
              avgDiscount: g.avg((s) => s.discount),
              maxProfit: g.max((s) => s.profit),
              minProfit: g.min((s) => s.profit),
            })),
        {},
      );

      expect(result.sql).to.contain(`SUM("amount") AS "totalRevenue"`);
      expect(result.sql).to.contain(`SUM("quantity") AS "totalQuantity"`);
      expect(result.sql).to.contain(`AVG("discount") AS "avgDiscount"`);
      expect(result.sql).to.contain(`MAX("profit") AS "maxProfit"`);
      expect(result.sql).to.contain(`MIN("profit") AS "minProfit"`);
    });
  });

  describe("GROUP BY with complex WHERE conditions", () => {
    it("should filter before grouping", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .where((s) => s.amount > 1000 && s.discount < 20)
            .groupBy((s) => s.category)
            .select((g) => ({
              category: g.key,
              highValueSales: g.count(),
              totalAmount: g.sum((s) => s.amount),
            })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "category" AS "category", COUNT(*) AS "highValueSales", SUM("amount") AS "totalAmount" FROM "sales" WHERE ("amount" > $(__p1) AND "discount" < $(__p2)) GROUP BY "category"',
      );
      expect(result.params).to.deep.equal({ __p1: 1000, __p2: 20 });
    });

    it("should handle multiple WHERE clauses before GROUP BY", () => {
      const result = selectStatement(
        () =>
          from<Employee>("employees")
            .where((e) => e.salary > 50000)
            .where((e) => e.hireYear >= 2020)
            .groupBy((e) => e.department)
            .select((g) => ({
              dept: g.key,
              avgSalary: g.avg((e) => e.salary),
              count: g.count(),
            })),
        {},
      );

      expect(result.sql).to.contain(`WHERE "salary" > $(__p1) AND "hireYear" >= $(__p2)`);
      expect(result.sql).to.contain(`GROUP BY "department"`);
      expect(result.params).to.deep.equal({ __p1: 50000, __p2: 2020 });
    });
  });

  describe("GROUP BY with ORDER BY", () => {
    it("should order by aggregated values", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .groupBy((s) => s.salesperson)
            .select((g) => ({
              salesperson: g.key,
              totalSales: g.sum((s) => s.amount),
            }))
            .orderBy((x) => x.totalSales),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "salesperson" AS "salesperson", SUM("amount") AS "totalSales" FROM "sales" GROUP BY "salesperson" ORDER BY "totalSales" ASC',
      );
    });

    it("should order by group key", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .groupBy((s) => s.category)
            .select((g) => ({
              category: g.key,
              count: g.count(),
            }))
            .orderBy((x) => x.category),
        {},
      );

      expect(result.sql).to.equal(
        `SELECT "category" AS "category", COUNT(*) AS "count" FROM "sales" GROUP BY "category" ORDER BY "category" ASC`,
      );
    });

    it("should handle ORDER BY DESC with GROUP BY", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .groupBy((s) => s.region)
            .select((g) => ({
              region: g.key,
              revenue: g.sum((s) => s.amount),
            }))
            .orderByDescending((x) => x.revenue),
        {},
      );

      expect(result.sql).to.equal(
        `SELECT "region" AS "region", SUM("amount") AS "revenue" FROM "sales" GROUP BY "region" ORDER BY "revenue" DESC`,
      );
    });
  });

  describe("GROUP BY with TAKE and SKIP", () => {
    it("should limit grouped results", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .groupBy((s) => s.category)
            .select((g) => ({
              category: g.key,
              total: g.sum((s) => s.amount),
            }))
            .orderByDescending((x) => x.total)
            .take(5),
        {},
      );

      expect(result.sql).to.equal(
        `SELECT "category" AS "category", SUM("amount") AS "total" FROM "sales" GROUP BY "category" ORDER BY "total" DESC LIMIT $(__p1)`,
      );
      expect(result.params).to.deep.equal({ __p1: 5 });
    });

    it("should paginate grouped results", () => {
      const result = selectStatement(
        () =>
          from<Employee>("employees")
            .groupBy((e) => e.department)
            .select((g) => ({
              dept: g.key,
              avgSalary: g.avg((e) => e.salary),
              headcount: g.count(),
            }))
            .orderBy((x) => x.dept)
            .skip(10)
            .take(5),
        {},
      );

      expect(result.sql).to.contain(`GROUP BY "department"`);
      expect(result.sql).to.contain(`ORDER BY "dept" ASC`);
      expect(result.sql).to.contain("LIMIT $(__p2) OFFSET $(__p1)");
      expect(result.params).to.deep.equal({ __p1: 10, __p2: 5 });
    });
  });

  describe("GROUP BY with computed expressions", () => {
    // Test removed: Computed values in aggregates no longer supported in SELECT projections
    // Test removed: Conditional logic in aggregates no longer supported in SELECT projections
  });

  describe("GROUP BY after JOIN", () => {
    it("should GROUP BY after JOIN operation", () => {
      interface Order {
        id: number;
        customerId: number;
        amount: number;
      }

      interface Customer {
        id: number;
        name: string;
        country: string;
      }

      const result = selectStatement(
        () =>
          from<Order>("orders")
            .join(
              from<Customer>("customers"),
              (o) => o.customerId,
              (c) => c.id,
              (o, c) => ({ o, c }),
            )
            .groupBy((joined) => joined.c.id)
            .select((g) => ({
              customerId: g.key,
              totalSpent: g.sum((joined) => joined.o.amount),
              orderCount: g.count(),
            })),
        {},
      );

      expect(result.sql).to.contain("INNER JOIN");
      expect(result.sql).to.contain(`GROUP BY "t1"."id"`);
      expect(result.sql).to.contain(`SUM("t0"."amount")`); // amount comes from orders (t0)
      expect(result.sql).to.contain("COUNT(*)");
    });
  });

  describe("GROUP BY with parameters", () => {
    it("should handle parameters in WHERE before GROUP BY", () => {
      const result = selectStatement(
        (params: { minAmount: number; region: string }) =>
          from<Sale>("sales")
            .where((s) => s.amount >= params.minAmount && s.region == params.region)
            .groupBy((s) => s.category)
            .select((g) => ({
              category: g.key,
              total: g.sum((s) => s.amount),
              count: g.count(),
            })),
        { minAmount: 500, region: "North" },
      );

      expect(result.sql).to.contain(`WHERE ("amount" >= $(minAmount) AND "region" = $(region))`);
      expect(result.sql).to.contain(`GROUP BY "category"`);
      expect(result.params).to.deep.equal({ minAmount: 500, region: "North" });
    });

    it("should mix parameters with auto-params in GROUP BY queries", () => {
      const result = selectStatement(
        (params: { targetProfit: number }) =>
          from<Sale>("sales")
            .where((s) => s.profit > params.targetProfit && s.quantity > 10)
            .groupBy((s) => s.productName)
            .select((g) => ({
              product: g.key,
              totalProfit: g.sum((s) => s.profit),
              avgQuantity: g.avg((s) => s.quantity),
            }))
            .orderByDescending((x) => x.totalProfit)
            .take(10),
        { targetProfit: 100 },
      );

      expect(result.sql).to.contain(`"profit" > $(targetProfit)`);
      expect(result.sql).to.contain(`"quantity" > $(__p1)`);
      expect(result.sql).to.contain("LIMIT $(__p2)");
      expect(result.params).to.deep.equal({
        targetProfit: 100,
        __p1: 10,
        __p2: 10,
      });
    });
  });

  describe("Complex GROUP BY scenarios", () => {
    it("should handle GROUP BY with all query operations", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .where((s) => s.amount > 100)
            .groupBy((s) => s.region)
            .select((g) => ({
              region: g.key,
              revenue: g.sum((s) => s.amount),
              sales: g.count(),
              avgSale: g.avg((s) => s.amount),
            }))
            .where((x) => x.revenue > 10000)
            .orderByDescending((x) => x.revenue)
            .take(3),
        {},
      );

      expect(result.sql).to.contain(`WHERE "amount" > $(__p1)`);
      expect(result.sql).to.contain(`GROUP BY "region"`);
      expect(result.sql).to.contain(`"revenue" > $(__p2)`);
      expect(result.sql).to.contain(`ORDER BY "revenue" DESC`);
      expect(result.sql).to.contain("LIMIT $(__p3)");
      expect(result.params).to.deep.equal({
        __p1: 100,
        __p2: 10000,
        __p3: 3,
      });
    });

    it("should handle nested GROUP BY logic", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .where((s) => s.quantity > 0 && s.discount < 50)
            .groupBy((s) => s.category)
            .select((g) => ({
              category: g.key,
              totalQty: g.sum((s) => s.quantity),
              avgDiscount: g.avg((s) => s.discount),
              minAmount: g.min((s) => s.amount),
              maxAmount: g.max((s) => s.amount),
              salesCount: g.count(),
            }))
            .where((x) => x.salesCount > 5)
            .orderBy((x) => x.category),
        {},
      );

      expect(result.sql).to.contain(`"quantity" > $(__p1)`);
      expect(result.sql).to.contain(`"discount" < $(__p2)`);
      expect(result.sql).to.contain(`GROUP BY "category"`);
      expect(result.sql).to.contain(`"salesCount" > $(__p3)`);
      expect(result.params).to.deep.equal({
        __p1: 0,
        __p2: 50,
        __p3: 5,
      });
    });
  });

  describe("GROUP BY edge cases", () => {
    it("should handle GROUP BY with no aggregates", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .groupBy((s) => s.category)
            .select((g) => ({ category: g.key })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "category" AS "category" FROM "sales" GROUP BY "category"',
      );
    });

    it("should handle GROUP BY with only COUNT", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .groupBy((s) => s.region)
            .select((g) => ({ region: g.key, count: g.count() })),
        {},
      );

      expect(result.sql).to.equal(
        `SELECT "region" AS "region", COUNT(*) AS "count" FROM "sales" GROUP BY "region"`,
      );
    });

    it("should handle GROUP BY with DISTINCT", () => {
      const result = selectStatement(
        () =>
          from<Sale>("sales")
            .distinct()
            .groupBy((s) => s.category)
            .select((g) => ({ category: g.key, uniqueCount: g.count() })),
        {},
      );

      expect(result.sql).to.contain("SELECT DISTINCT");
      expect(result.sql).to.contain(`GROUP BY "category"`);
    });
  });
});
