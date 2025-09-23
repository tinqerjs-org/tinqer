/**
 * Advanced GROUP BY tests
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

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
      const result = query(
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
        'SELECT key AS category, SUM(amount) AS totalSales, AVG(amount) AS avgSale, MAX(amount) AS maxSale, MIN(amount) AS minSale, COUNT(*) AS saleCount FROM "sales" AS t0 GROUP BY category',
      );
    });

    it("should handle different columns for different aggregates", () => {
      const result = query(
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

      expect(result.sql).to.contain("SUM(amount) AS totalRevenue");
      expect(result.sql).to.contain("SUM(quantity) AS totalQuantity");
      expect(result.sql).to.contain("AVG(discount) AS avgDiscount");
      expect(result.sql).to.contain("MAX(profit) AS maxProfit");
      expect(result.sql).to.contain("MIN(profit) AS minProfit");
    });
  });

  describe("GROUP BY with complex WHERE conditions", () => {
    it("should filter before grouping", () => {
      const result = query(
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
        'SELECT key AS category, COUNT(*) AS highValueSales, SUM(amount) AS totalAmount FROM "sales" AS t0 WHERE (amount > :_amount1 AND discount < :_discount1) GROUP BY category',
      );
      expect(result.params).to.deep.equal({ _amount1: 1000, _discount1: 20 });
    });

    it("should handle multiple WHERE clauses before GROUP BY", () => {
      const result = query(
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

      expect(result.sql).to.contain("WHERE salary > :_salary1 AND hireYear >= :_hireYear1");
      expect(result.sql).to.contain("GROUP BY department");
      expect(result.params).to.deep.equal({ _salary1: 50000, _hireYear1: 2020 });
    });
  });

  describe("GROUP BY with ORDER BY", () => {
    it("should order by aggregated values", () => {
      const result = query(
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
        'SELECT key AS salesperson, SUM(amount) AS totalSales FROM "sales" AS t0 GROUP BY salesperson ORDER BY totalSales ASC',
      );
    });

    it("should order by group key", () => {
      const result = query(
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
        'SELECT key AS category, COUNT(*) AS count FROM "sales" AS t0 GROUP BY category ORDER BY category ASC',
      );
    });

    it("should handle ORDER BY DESC with GROUP BY", () => {
      const result = query(
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
        'SELECT key AS region, SUM(amount) AS revenue FROM "sales" AS t0 GROUP BY region ORDER BY revenue DESC',
      );
    });
  });

  describe("GROUP BY with TAKE and SKIP", () => {
    it("should limit grouped results", () => {
      const result = query(
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
        'SELECT key AS category, SUM(amount) AS total FROM "sales" AS t0 GROUP BY category ORDER BY total DESC LIMIT :_limit1',
      );
      expect(result.params).to.deep.equal({ _limit1: 5 });
    });

    it("should paginate grouped results", () => {
      const result = query(
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

      expect(result.sql).to.contain("GROUP BY department");
      expect(result.sql).to.contain("ORDER BY dept ASC");
      expect(result.sql).to.contain("LIMIT :_limit1 OFFSET :_offset1");
      expect(result.params).to.deep.equal({ _offset1: 10, _limit1: 5 });
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

      const result = query(
        () =>
          from<Order>("orders")
            .join(
              from<Customer>("customers"),
              (o) => o.customerId,
              (c) => c.id,
              (o, c) => ({ customerId: c.id, customerName: c.name, amount: o.amount }),
            )
            .groupBy((x) => x.customerId)
            .select((g) => ({
              customerId: g.key,
              totalSpent: g.sum((x) => x.amount),
              orderCount: g.count(),
            })),
        {},
      );

      expect(result.sql).to.contain("INNER JOIN");
      expect(result.sql).to.contain("GROUP BY customerId");
      expect(result.sql).to.contain("SUM(amount)");
      expect(result.sql).to.contain("COUNT(*)");
    });
  });

  describe("GROUP BY with parameters", () => {
    it("should handle parameters in WHERE before GROUP BY", () => {
      const result = query(
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

      expect(result.sql).to.contain("WHERE (amount >= :minAmount AND region = :region)");
      expect(result.sql).to.contain("GROUP BY category");
      expect(result.params).to.deep.equal({ minAmount: 500, region: "North" });
    });

    it("should mix parameters with auto-params in GROUP BY queries", () => {
      const result = query(
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

      expect(result.sql).to.contain("profit > :targetProfit");
      expect(result.sql).to.contain("quantity > :_quantity1");
      expect(result.sql).to.contain("LIMIT :_limit1");
      expect(result.params).to.deep.equal({
        targetProfit: 100,
        _quantity1: 10,
        _limit1: 10,
      });
    });
  });

  describe("Complex GROUP BY scenarios", () => {
    it("should handle GROUP BY with all query operations", () => {
      const result = query(
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

      expect(result.sql).to.contain("WHERE amount > :_amount1");
      expect(result.sql).to.contain("GROUP BY region");
      expect(result.sql).to.contain("revenue > :_revenue1");
      expect(result.sql).to.contain("ORDER BY revenue DESC");
      expect(result.sql).to.contain("LIMIT :_limit1");
      expect(result.params).to.deep.equal({
        _amount1: 100,
        _revenue1: 10000,
        _limit1: 3,
      });
    });

    it("should handle nested GROUP BY logic", () => {
      const result = query(
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

      expect(result.sql).to.contain("quantity > :_quantity1");
      expect(result.sql).to.contain("discount < :_discount1");
      expect(result.sql).to.contain("GROUP BY category");
      expect(result.sql).to.contain("salesCount > :_salesCount1");
      expect(result.params).to.deep.equal({
        _quantity1: 0,
        _discount1: 50,
        _salesCount1: 5,
      });
    });
  });

  describe("GROUP BY edge cases", () => {
    it("should handle GROUP BY with no aggregates", () => {
      const result = query(
        () =>
          from<Sale>("sales")
            .groupBy((s) => s.category)
            .select((g) => ({ category: g.key })),
        {},
      );

      expect(result.sql).to.equal('SELECT key AS category FROM "sales" AS t0 GROUP BY category');
    });

    it("should handle GROUP BY with only COUNT", () => {
      const result = query(
        () =>
          from<Sale>("sales")
            .groupBy((s) => s.region)
            .select((g) => ({ region: g.key, count: g.count() })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT key AS region, COUNT(*) AS count FROM "sales" AS t0 GROUP BY region',
      );
    });

    it("should handle GROUP BY with DISTINCT", () => {
      const result = query(
        () =>
          from<Sale>("sales")
            .distinct()
            .groupBy((s) => s.category)
            .select((g) => ({ category: g.key, uniqueCount: g.count() })),
        {},
      );

      expect(result.sql).to.contain("SELECT DISTINCT");
      expect(result.sql).to.contain("GROUP BY category");
    });
  });
});
