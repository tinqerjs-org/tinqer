import { describe, it } from "mocha";
import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
import { createSchema } from "@webpods/tinqer";

interface Sale {
  id: number;
  product: string;
  category: string;
  region: string;
  year: number;
  quarter: number;
  amount: number;
  quantity: number;
}

interface Schema {
  sales: Sale;
}

const db = createSchema<Schema>();

describe("GROUP BY with Composite Keys", () => {
  describe("Composite key GROUP BY", () => {
    it("should group by object with two properties", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .groupBy((s) => ({ category: s.category, region: s.region }))
            .select((g) => ({
              category: g.key.category,
              region: g.key.region,
              total: g.sum((s) => s.amount),
            })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "category" AS "category", "region" AS "region", SUM("amount") AS "total" FROM "sales" GROUP BY "category", "region"',
      );
    });

    it("should group by object with three properties", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .groupBy((s) => ({ category: s.category, region: s.region, year: s.year }))
            .select((g) => ({
              category: g.key.category,
              region: g.key.region,
              year: g.key.year,
              count: g.count(),
              avgAmount: g.average((s) => s.amount),
            })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "category" AS "category", "region" AS "region", "year" AS "year", COUNT(*) AS "count", AVG("amount") AS "avgAmount" FROM "sales" GROUP BY "category", "region", "year"',
      );
    });

    it("should handle composite key with computed properties", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .groupBy((s) => ({
              categoryUpper: s.category.toUpperCase(),
              yearQuarter: s.year * 100 + s.quarter,
            }))
            .select((g) => ({
              key: g.key,
              total: g.sum((s) => s.amount),
            })),
        {},
      );

      expect(result.sql).to.include("GROUP BY UPPER(");
      expect(result.sql).to.include('"year" * ');
    });

    it("should group by mixed expressions", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .groupBy((s) => ({
              isHighValue: s.amount > 1000,
              region: s.region,
              yearMod: s.year % 10,
            }))
            .select((g) => ({
              highValue: g.key.isHighValue,
              region: g.key.region,
              yearMod: g.key.yearMod,
              count: g.count(),
            })),
        {},
      );

      expect(result.sql).to.include("GROUP BY");
      expect(result.sql).to.include('"amount" > ');
      expect(result.params.__p1).to.equal(1000);
    });
  });

  describe("GROUP BY with WHERE and composite keys", () => {
    it("should filter before grouping with composite key", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .where((s) => s.year >= 2020)
            .groupBy((s) => ({ category: s.category, quarter: s.quarter }))
            .select((g) => ({
              category: g.key.category,
              quarter: g.key.quarter,
              total: g.sum((s) => s.amount),
            })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "category" AS "category", "quarter" AS "quarter", SUM("amount") AS "total" FROM "sales" WHERE "year" >= @__p1 GROUP BY "category", "quarter"',
      );
      expect(result.params.__p1).to.equal(2020);
    });

    it("should handle multiple WHERE with composite GROUP BY", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .where((s) => s.region === "North")
            .where((s) => s.amount > 100)
            .groupBy((s) => ({ product: s.product, year: s.year }))
            .select((g) => ({
              product: g.key.product,
              year: g.key.year,
              avgQuantity: g.average((s) => s.quantity),
            })),
        {},
      );

      expect(result.sql).to.include('WHERE "region" = ');
      expect(result.sql).to.include('AND "amount" > ');
      expect(result.sql).to.include('GROUP BY "product", "year"');
    });
  });

  describe("GROUP BY with ORDER BY and composite keys", () => {
    it("should order by grouped composite key properties", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .groupBy((s) => ({ category: s.category, year: s.year }))
            .select((g) => ({
              category: g.key.category,
              year: g.key.year,
              total: g.sum((s) => s.amount),
            }))
            .orderBy((g) => g.category)
            .thenBy((g) => g.year),
        {},
      );

      expect(result.sql).to.include('ORDER BY "category" ASC, "year" ASC');
    });

    it("should order by aggregate with composite GROUP BY", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .groupBy((s) => ({ product: s.product, region: s.region }))
            .select((g) => ({
              product: g.key.product,
              region: g.key.region,
              totalSales: g.sum((s) => s.amount),
            }))
            .orderByDescending((g) => g.totalSales),
        {},
      );

      expect(result.sql).to.include('ORDER BY "totalSales" DESC');
    });
  });

  describe("GROUP BY with TAKE/SKIP and composite keys", () => {
    it("should limit results with composite GROUP BY", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .groupBy((s) => ({ category: s.category, region: s.region }))
            .select((g) => ({
              key: g.key,
              count: g.count(),
            }))
            .orderByDescending((g) => g.count)
            .take(10),
        {},
      );

      expect(result.sql).to.include("LIMIT");
      expect(result.params).to.have.property("__p1");
      if (result.params.__p1) {
        expect(result.params.__p1).to.equal(10);
      }
    });

    it("should paginate grouped results with composite keys", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .groupBy((s) => ({ product: s.product, year: s.year, quarter: s.quarter }))
            .select((g) => ({
              product: g.key.product,
              year: g.key.year,
              quarter: g.key.quarter,
              avgAmount: g.average((s) => s.amount),
            }))
            .skip(20)
            .take(10),
        {},
      );

      expect(result.sql).to.include("OFFSET");
      expect(result.sql).to.include("LIMIT");
      expect(result.params).to.have.property("__p1");
      expect(result.params).to.have.property("__p2");
      if (result.params.__p1) {
        expect(result.params.__p1).to.equal(20);
      }
      if (result.params.__p2) {
        expect(result.params.__p2).to.equal(10);
      }
    });
  });

  describe("Complex GROUP BY scenarios", () => {
    it("should handle GROUP BY with method calls in key", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .groupBy((s) => ({
              startsWithA: s.product.startsWith("A"),
              hasHighVolume: s.quantity > 100,
            }))
            .select((g) => ({
              startsWithA: g.key.startsWithA,
              highVolume: g.key.hasHighVolume,
              count: g.count(),
            })),
        {},
      );

      expect(result.sql).to.include("LIKE");
      expect(result.sql).to.include('"quantity" > ');
    });

    it("should handle nested property access in composite GROUP BY", () => {
      interface OrderWithCustomer {
        orderId: number;
        customer: {
          name: string;
          region: string;
        };
        product: {
          category: string;
          price: number;
        };
        quantity: number;
      }

      interface OrderSchema {
        orders: OrderWithCustomer;
      }

      const orderDb = createSchema<OrderSchema>();

      const result = selectStatement(
        orderDb,
        (ctx) =>
          ctx
            .from("orders")
            .groupBy((o) => ({
              customerRegion: o.customer.region,
              productCategory: o.product.category,
            }))
            .select((g) => ({
              region: g.key.customerRegion,
              category: g.key.productCategory,
              totalQuantity: g.sum((o) => o.quantity),
            })),
        {},
      );

      // Nested property access gets translated to quoted column names
      expect(result.sql).to.include('"customer"');
      expect(result.sql).to.include('"product"');
    });

    it("should handle GROUP BY with all aggregate functions", () => {
      const result = selectStatement(
        db,
        (ctx) =>
          ctx
            .from("sales")
            .groupBy((s) => ({ category: s.category, year: s.year }))
            .select((g) => ({
              category: g.key.category,
              year: g.key.year,
              count: g.count(),
              total: g.sum((s) => s.amount),
              avg: g.average((s) => s.amount),
              min: g.min((s) => s.amount),
              max: g.max((s) => s.amount),
              avgQuantity: g.average((s) => s.quantity),
            })),
        {},
      );

      expect(result.sql).to.include("COUNT(*)");
      expect(result.sql).to.include("SUM(");
      expect(result.sql).to.include("AVG(");
      expect(result.sql).to.include("MIN(");
      expect(result.sql).to.include("MAX(");
      expect(result.sql).to.include('GROUP BY "category", "year"');
    });
  });
});
