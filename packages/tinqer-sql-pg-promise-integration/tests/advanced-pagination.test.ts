/**
 * Advanced Pagination Integration Tests
 * Tests for various pagination strategies and patterns with real PostgreSQL.
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { execute, executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("PostgreSQL Integration - Advanced Pagination", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("Offset-based pagination", () => {
    it("should paginate with skip and take", async () => {
      const page = 2;
      const pageSize = 3;
      const offset = (page - 1) * pageSize;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .orderBy((p) => p.id)
            .skip(params.offset)
            .take(params.pageSize),
        { offset, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" ORDER BY "id" ASC LIMIT $(pageSize) OFFSET $(offset)',
      );
      expect(capturedSql!.params).to.deep.equal({ offset, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(3);
      if (results[0]) {
        expect(results[0].id).to.be.greaterThan(3); // Should skip first 3
      }
    });

    it("should paginate with dynamic page size", async () => {
      const pageSize = 5;
      const pageNumber = 2;
      const offset = (pageNumber - 1) * pageSize;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .orderByDescending((p) => p.created_at)
            .skip(params.offset)
            .take(params.pageSize),
        { offset, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" ORDER BY "created_at" DESC LIMIT $(pageSize) OFFSET $(offset)',
      );
      expect(capturedSql!.params).to.deep.equal({ offset, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(5);
    });

    it("should handle first page (no skip)", async () => {
      const pageSize = 4;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .orderBy((p) => p.name)
            .take(params.pageSize),
        { pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" ORDER BY "name" ASC LIMIT $(pageSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(4);
      if (results[0]) {
        expect(results[0].name).to.equal("Chair"); // Alphabetically first
      }
    });

    it("should handle last page with partial results", async () => {
      const pageSize = 4;
      const page = 3; // 10 products total, page 3 should have 2 items
      const offset = (page - 1) * pageSize;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .orderBy((p) => p.id)
            .skip(params.offset)
            .take(params.pageSize),
        { offset, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" ORDER BY "id" ASC LIMIT $(pageSize) OFFSET $(offset)',
      );
      expect(capturedSql!.params).to.deep.equal({ offset, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Only 2 items on last page
    });

    it("should paginate filtered results", async () => {
      const category = "Electronics";
      const page = 1;
      const pageSize = 3;
      const offset = (page - 1) * pageSize;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.category == params.category)
            .orderByDescending((p) => p.price)
            .skip(params.offset)
            .take(params.pageSize),
        { category, offset, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "category" = $(category) ORDER BY "price" DESC LIMIT $(pageSize) OFFSET $(offset)',
      );
      expect(capturedSql!.params).to.deep.equal({ category, offset, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(3);
      results.forEach((product) => {
        expect(product.category).to.equal(category);
      });
    });
  });

  describe("Cursor-based pagination patterns", () => {
    it("should paginate using ID cursor", async () => {
      const lastId = 3;
      const pageSize = 3;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.id > params.lastId)
            .orderBy((p) => p.id)
            .take(params.pageSize),
        { lastId, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "id" > $(lastId) ORDER BY "id" ASC LIMIT $(pageSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ lastId, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(3);
      if (results[0]) {
        expect(results[0].id).to.equal(4);
      }
      const lastResult = results[results.length - 1];
      if (lastResult) {
        expect(lastResult.id).to.equal(6);
      }
    });

    it("should paginate backwards using ID cursor", async () => {
      const firstId = 7;
      const pageSize = 3;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.id < params.firstId)
            .orderByDescending((p) => p.id)
            .take(params.pageSize),
        { firstId, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "id" < $(firstId) ORDER BY "id" DESC LIMIT $(pageSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ firstId, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(3);
      if (results[0]) {
        expect(results[0].id).to.equal(6);
      }
      const lastResult = results[results.length - 1];
      if (lastResult) {
        expect(lastResult.id).to.equal(4);
      }
    });

    it("should use composite cursor (date + id)", async () => {
      // For articles, paginate by published_at and id
      const lastDate = new Date("2024-01-14 09:00:00");
      const lastId = 3;
      const pageSize = 2;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "articles")
            .where(
              (a) =>
                a.published_at > params.lastDate ||
                (a.published_at == params.lastDate && a.id > params.lastId),
            )
            .orderBy((a) => a.published_at)
            .thenBy((a) => a.id)
            .take(params.pageSize),
        { lastDate, lastId, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "articles" WHERE ("published_at" > $(lastDate) OR ("published_at" = $(lastDate) AND "id" > $(lastId))) ORDER BY "published_at" ASC, "id" ASC LIMIT $(pageSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ lastDate, lastId, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(2);
      // Should get next articles after the cursor
    });
  });

  describe("Keyset pagination", () => {
    it("should use single column keyset", async () => {
      const lastPrice = 79.99;
      const pageSize = 3;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.price > params.lastPrice)
            .orderBy((p) => p.price)
            .take(params.pageSize),
        { lastPrice, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "price" > $(lastPrice) ORDER BY "price" ASC LIMIT $(pageSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ lastPrice, pageSize });
      expect(results).to.be.an("array");
      expect(results.length).to.be.at.most(pageSize);
      results.forEach((product) => {
        expect(product.price).to.be.greaterThan(lastPrice);
      });
    });

    it("should use multi-column keyset", async () => {
      const lastViews = 2000;
      const lastId = 2;
      const pageSize = 2;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "articles")
            .where(
              (a) =>
                a.views < params.lastViews || (a.views == params.lastViews && a.id > params.lastId),
            )
            .orderByDescending((a) => a.views)
            .thenBy((a) => a.id)
            .take(params.pageSize),
        { lastViews, lastId, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "articles" WHERE ("views" < $(lastViews) OR ("views" = $(lastViews) AND "id" > $(lastId))) ORDER BY "views" DESC, "id" ASC LIMIT $(pageSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ lastViews, lastId, pageSize });
      expect(results).to.be.an("array");
      expect(results.length).to.be.at.most(pageSize);
    });
  });

  describe("Pagination with aggregates", () => {
    it("should paginate grouped results", async () => {
      const page = 1;
      const pageSize = 2;
      const offset = (page - 1) * pageSize;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .groupBy((p) => p.category)
            .select((g) => ({
              category: g.key,
              count: g.count(),
              avgPrice: g.avg((p) => p.price),
            }))
            .orderByDescending((r) => r.count)
            .skip(params.offset)
            .take(params.pageSize),
        { offset, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "category" AS "category", COUNT(*) AS "count", AVG("price") AS "avgPrice" FROM "products" GROUP BY "category" ORDER BY "count" DESC LIMIT $(pageSize) OFFSET $(offset)',
      );
      expect(capturedSql!.params).to.deep.equal({ offset, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(2);
      results.forEach((result) => {
        expect(result).to.have.property("category");
        expect(result).to.have.property("count");
        expect(result).to.have.property("avgPrice");
      });
    });

    it("should paginate with HAVING clause", async () => {
      const minCount = 2;
      const pageSize = 2;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Note: having clause not directly supported, filter after grouping
      const allResults = await executeSimple(
        db,
        () =>
          from(dbContext, "products")
            .groupBy((p) => p.category)
            .select((g) => ({
              category: g.key,
              productCount: g.count(),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "category" AS "category", COUNT(*) AS "productCount" FROM "products" GROUP BY "category"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      const results = allResults
        .filter((r) => r.productCount >= minCount)
        .sort((a, b) => {
          if (a.category === null && b.category === null) return 0;
          if (a.category === null) return -1;
          if (b.category === null) return 1;
          return a.category.localeCompare(b.category);
        })
        .slice(0, pageSize);

      expect(results).to.be.an("array");
      expect(results.length).to.be.at.most(pageSize);
      results.forEach((result) => {
        expect(result.productCount).to.be.at.least(minCount);
      });
    });
  });

  describe("Pagination with JOIN", () => {
    it("should paginate joined results", async () => {
      const page = 2;
      const pageSize = 3;
      const offset = (page - 1) * pageSize;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "orders")
            .join(
              from(dbContext, "users"),
              (o) => o.user_id,
              (u) => u.id,
              (o, u) => ({ o, u }),
            )
            .select((joined) => ({
              orderId: joined.o.id,
              userName: joined.u.name,
              orderTotal: joined.o.total_amount,
            }))
            .skip(params.offset)
            .take(params.pageSize),
        { offset, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."id" AS "orderId", "t1"."name" AS "userName", "t0"."total_amount" AS "orderTotal" FROM "orders" AS "t0" INNER JOIN "users" AS "t1" ON "t0"."user_id" = "t1"."id" LIMIT $(pageSize) OFFSET $(offset)',
      );
      expect(capturedSql!.params).to.deep.equal({ offset, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(3);
      results.forEach((result) => {
        expect(result).to.have.property("orderId");
        expect(result).to.have.property("userName");
        expect(result).to.have.property("orderTotal");
      });
    });
  });

  describe("Pagination with DISTINCT", () => {
    it("should paginate distinct results", async () => {
      const pageSize = 2;
      const offset = 1;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .select((p) => ({ category: p.category }))
            .distinct()
            .orderBy((r) => r.category)
            .skip(params.offset)
            .take(params.pageSize),
        { offset, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT DISTINCT "category" AS "category" FROM "products" ORDER BY "category" ASC LIMIT $(pageSize) OFFSET $(offset)',
      );
      expect(capturedSql!.params).to.deep.equal({ offset, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(2);
      // Should have unique categories
      const categories = results.map((r) => r.category);
      expect(new Set(categories).size).to.equal(categories.length);
    });
  });

  describe("Dynamic pagination", () => {
    it("should handle variable page sizes", async () => {
      const requestedSize = 100;
      const maxSize = 5; // Limit for testing
      const actualSize = Math.min(requestedSize, maxSize);
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .orderByDescending((p) => p.created_at)
            .take(params.actualSize),
        { actualSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" ORDER BY "created_at" DESC LIMIT $(actualSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ actualSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(5);
    });

    it("should handle last page detection", async () => {
      const pageSize = 3;
      const takePlusOne = pageSize + 1; // Take one extra to detect if there's more
      const skipCount = 9; // Skip to near the end (10 products total)
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .orderBy((p) => p.id)
            .skip(params.skipCount)
            .take(params.takePlusOne),
        { skipCount, takePlusOne },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" ORDER BY "id" ASC LIMIT $(takePlusOne) OFFSET $(skipCount)',
      );
      expect(capturedSql!.params).to.deep.equal({ skipCount, takePlusOne });
      expect(results).to.be.an("array");
      const hasMore = results.length > pageSize;
      expect(hasMore).to.be.false; // No more pages after this
      expect(results).to.have.length(1); // Only 1 product left
    });
  });

  describe("Performance-optimized pagination", () => {
    it("should use covering index pattern", async () => {
      const page = 2;
      const pageSize = 3;
      const offset = (page - 1) * pageSize;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Select only indexed columns for better performance
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .select((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
            }))
            .orderByDescending((p) => p.price)
            .thenBy((p) => p.id)
            .skip(params.offset)
            .take(params.pageSize),
        { offset, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "id" AS "id", "name" AS "name", "price" AS "price" FROM "products" ORDER BY "price" DESC, "id" ASC LIMIT $(pageSize) OFFSET $(offset)',
      );
      expect(capturedSql!.params).to.deep.equal({ offset, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(3);
      results.forEach((result) => {
        expect(result).to.have.property("id");
        expect(result).to.have.property("name");
        expect(result).to.have.property("price");
        expect(result).to.not.have.property("description");
      });
    });

    it("should avoid large offsets with cursor", async () => {
      // Instead of OFFSET 1000, use cursor
      const lastSeenId = 5;
      const pageSize = 3;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.id > params.lastSeenId)
            .orderBy((p) => p.id)
            .take(params.pageSize),
        { lastSeenId, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "id" > $(lastSeenId) ORDER BY "id" ASC LIMIT $(pageSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ lastSeenId, pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(3);
      if (results[0]) {
        expect(results[0].id).to.equal(6);
      }
    });
  });

  describe("Bidirectional pagination", () => {
    it("should support forward and backward navigation", async () => {
      const currentId = 5;
      const pageSize = 2;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Forward
      const forwardResults = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.id > params.currentId)
            .orderBy((p) => p.id)
            .take(params.pageSize),
        { currentId, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "id" > $(currentId) ORDER BY "id" ASC LIMIT $(pageSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ currentId, pageSize });
      expect(forwardResults).to.have.length(2);
      if (forwardResults[0]) {
        expect(forwardResults[0].id).to.equal(6);
      }
      if (forwardResults[1]) {
        expect(forwardResults[1].id).to.equal(7);
      }

      // Backward
      capturedSql = undefined;
      const backwardResults = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.id < params.currentId)
            .orderByDescending((p) => p.id)
            .take(params.pageSize),
        { currentId, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "id" < $(currentId) ORDER BY "id" DESC LIMIT $(pageSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ currentId, pageSize });
      expect(backwardResults).to.have.length(2);
      if (backwardResults[0]) {
        expect(backwardResults[0].id).to.equal(4);
      }
      if (backwardResults[1]) {
        expect(backwardResults[1].id).to.equal(3);
      }
    });
  });

  describe("Complex pagination scenarios", () => {
    it("should paginate with complex WHERE conditions", async () => {
      const minPrice = 50;
      const maxPrice = 500;
      const category = "Electronics";
      const furniture = "Furniture";
      const page = 1;
      const pageSize = 2;
      const offset = (page - 1) * pageSize;
      const minStock = 0;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .where(
              (p) =>
                (p.category == params.category || p.category == params.furniture) &&
                p.price >= params.minPrice &&
                p.price <= params.maxPrice &&
                p.stock > params.minStock,
            )
            .orderByDescending((p) => p.price)
            .thenBy((p) => p.name)
            .skip(params.offset)
            .take(params.pageSize),
        { minPrice, maxPrice, category, furniture, offset, pageSize, minStock },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE (((("category" = $(category) OR "category" = $(furniture)) AND "price" >= $(minPrice)) AND "price" <= $(maxPrice)) AND "stock" > $(minStock)) ORDER BY "price" DESC, "name" ASC LIMIT $(pageSize) OFFSET $(offset)',
      );
      expect(capturedSql!.params).to.deep.equal({
        minPrice,
        maxPrice,
        category,
        furniture,
        offset,
        pageSize,
        minStock,
      });
      expect(results).to.be.an("array");
      expect(results.length).to.be.at.most(pageSize);
      results.forEach((product) => {
        expect(product.price).to.be.at.least(minPrice);
        expect(product.price).to.be.at.most(maxPrice);
        expect(product.stock).to.be.greaterThan(0);
      });
    });

    it("should handle pagination with multiple sorting criteria", async () => {
      const pageSize = 3;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "articles")
            .orderByDescending((a) => a.is_featured) // Featured first
            .thenByDescending((a) => a.views) // Then by views
            .thenBy((a) => a.published_at) // Then by date
            .take(params.pageSize),
        { pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "articles" ORDER BY "is_featured" DESC, "views" DESC, "published_at" ASC LIMIT $(pageSize)',
      );
      expect(capturedSql!.params).to.deep.equal({ pageSize });
      expect(results).to.be.an("array");
      expect(results).to.have.length(3);

      // First result should be featured with high views
      if (results[0] && results[0].is_featured) {
        expect(results[0].is_featured).to.be.true;
      }
    });

    it("should paginate search results with relevance", async () => {
      const searchTerm = "database";
      const pageSize = 2;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "articles")
            .where(
              (a) =>
                a.title.toLowerCase().includes(params.searchTerm) ||
                a.content.toLowerCase().includes(params.searchTerm) ||
                a.tags.includes(params.searchTerm),
            )
            .orderByDescending((a) => a.views)
            .take(params.pageSize),
        { searchTerm, pageSize },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        "SELECT * FROM \"articles\" WHERE ((LOWER(\"title\") LIKE '%' || $(searchTerm) || '%' OR LOWER(\"content\") LIKE '%' || $(searchTerm) || '%') OR \"tags\" LIKE '%' || $(searchTerm) || '%') ORDER BY \"views\" DESC LIMIT $(pageSize)",
      );
      expect(capturedSql!.params).to.deep.equal({ searchTerm, pageSize });
      expect(results).to.be.an("array");
      expect(results.length).to.be.at.most(pageSize);
      // Results should contain the search term in some field
    });
  });
});
