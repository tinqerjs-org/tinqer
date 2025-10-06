/**
 * Complex WHERE clause integration tests with real Better SQLite3
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { executeSelect, executeSelectSimple } from "@webpods/tinqer-sql-better-sqlite3";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { schema } from "./database-schema.js";

describe("Better SQLite3 Integration - Complex WHERE", () => {
  before(() => {
    setupTestDatabase(db);
  });

  describe("Nested logical conditions", () => {
    it("should handle complex nested AND/OR conditions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) =>
          ctx
            .from("users")
            .where(
              (u) =>
                (u.age !== null && u.age >= 25 && u.age <= 35 && u.is_active === 1) ||
                (u.department_id === 4 && u.age !== null && u.age >= 40),
            ),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE (((("age" IS NOT NULL AND "age" >= @__p1) AND "age" <= @__p2) AND "is_active" = @__p3) OR (("department_id" = @__p4 AND "age" IS NOT NULL) AND "age" >= @__p5))',
      );
      expect(capturedSql!.params).to.deep.equal({
        __p1: 25,
        __p2: 35,
        __p3: 1,
        __p4: 4,
        __p5: 40,
      });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        const condition1 =
          user.age !== null && user.age >= 25 && user.age <= 35 && user.is_active === 1;
        const condition2 = user.department_id === 4 && user.age !== null && user.age >= 40;
        expect(condition1 || condition2).to.be.true;
      });
    });

    it("should handle deeply nested conditions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) =>
          ctx
            .from("products")
            .where(
              (p) =>
                ((p.price > 100 && p.price < 500) || (p.price > 800 && p.stock > 40)) &&
                (p.category === "Electronics" || (p.category === "Furniture" && p.stock < 50)),
            ),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE ((("price" > @__p1 AND "price" < @__p2) OR ("price" > @__p3 AND "stock" > @__p4)) AND ("category" = @__p5 OR ("category" = @__p6 AND "stock" < @__p7)))',
      );
      expect(capturedSql!.params).to.deep.equal({
        __p1: 100,
        __p2: 500,
        __p3: 800,
        __p4: 40,
        __p5: "Electronics",
        __p6: "Furniture",
        __p7: 50,
      });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((product) => {
        const priceCondition =
          (product.price > 100 && product.price < 500) ||
          (product.price > 800 && product.stock > 40);
        const categoryCondition =
          product.category === "Electronics" ||
          (product.category === "Furniture" && product.stock < 50);
        expect(priceCondition && categoryCondition).to.be.true;
      });
    });

    it("should handle multiple NOT conditions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) =>
          ctx
            .from("users")
            .where(
              (u) => !(u.department_id === 1) && u.age !== null && !(u.age < 30) && !!u.is_active,
            ),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE (((NOT ("department_id" = @__p1) AND "age" IS NOT NULL) AND NOT ("age" < @__p2)) AND NOT (NOT "is_active"))',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 1, __p2: 30 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.department_id).to.not.equal(1);
        expect(user.age).to.be.at.least(30);
        expect(user.is_active).to.equal(1);
      });
    });
  });

  describe("Range conditions", () => {
    it("should handle BETWEEN-like conditions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) => ctx.from("products").where((p) => p.price >= 50 && p.price <= 300),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE ("price" >= @__p1 AND "price" <= @__p2)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 50, __p2: 300 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((product) => {
        expect(product.price).to.be.at.least(50);
        expect(product.price).to.be.at.most(300);
      });
    });

    it("should handle multiple range conditions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) =>
          ctx
            .from("users")
            .where(
              (u) =>
                (u.age !== null && u.age >= 25 && u.age <= 30) ||
                (u.age !== null && u.age >= 40 && u.age <= 50),
            ),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ((("age" IS NOT NULL AND "age" >= @__p1) AND "age" <= @__p2) OR (("age" IS NOT NULL AND "age" >= @__p3) AND "age" <= @__p4))',
      );
      expect(capturedSql!.params).to.deep.equal({
        __p1: 25,
        __p2: 30,
        __p3: 40,
        __p4: 50,
      });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        const inFirstRange = user.age !== null && user.age >= 25 && user.age <= 30;
        const inSecondRange = user.age !== null && user.age >= 40 && user.age <= 50;
        expect(inFirstRange || inSecondRange).to.be.true;
      });
    });

    it("should handle exclusive ranges", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) => ctx.from("products").where((p) => p.stock > 100 && p.stock < 500),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE ("stock" > @__p1 AND "stock" < @__p2)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 100, __p2: 500 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((product) => {
        expect(product.stock).to.be.greaterThan(100);
        expect(product.stock).to.be.lessThan(500);
      });
    });
  });

  describe("IN-like conditions with arrays", () => {
    it("should simulate IN with array includes", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const targetIds = [1, 3, 5, 7];
      const results = executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("users").where((u) => params.targetIds.includes(u.id)),
        { targetIds },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE "id" IN (@targetIds_0, @targetIds_1, @targetIds_2, @targetIds_3)',
      );
      expect(capturedSql!.params).to.deep.equal({
        targetIds: [1, 3, 5, 7],
        targetIds_0: 1,
        targetIds_1: 3,
        targetIds_2: 5,
        targetIds_3: 7,
      });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(4);
      results.forEach((user) => {
        expect(targetIds).to.include(user.id);
      });
    });

    it("should simulate NOT IN with negated includes", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const excludedCategories = ["Furniture", "Stationery"];
      const results = executeSelect(
        db,
        schema,
        (ctx, params) =>
          ctx
            .from("products")
            .where((p) => p.category !== null && !params.excludedCategories.includes(p.category)),
        { excludedCategories },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE ("category" IS NOT NULL AND "category" NOT IN (@excludedCategories_0, @excludedCategories_1))',
      );
      expect(capturedSql!.params).to.deep.equal({
        excludedCategories: ["Furniture", "Stationery"],
        excludedCategories_0: "Furniture",
        excludedCategories_1: "Stationery",
      });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((product) => {
        expect(excludedCategories).to.not.include(product.category);
      });
    });

    it("should handle empty array includes", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const emptyList: number[] = [];
      const results = executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("users").where((u) => params.emptyList.includes(u.id)),
        { emptyList },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE FALSE');
      expect(capturedSql!.params).to.deep.equal({ emptyList: [] });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(0);
    });
  });

  describe("NULL handling", () => {
    it("should handle IS NULL checks", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // All our test users have department_id, but let's test the syntax
      const results = executeSelectSimple(
        db,
        schema,
        (ctx) => ctx.from("users").where((u) => u.department_id !== null && u.is_active === 1),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("department_id" IS NOT NULL AND "is_active" = @__p1)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 1 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.department_id).to.not.be.null;
        expect(user.is_active).to.equal(1);
      });
    });

    it("should handle complex NULL checks", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) =>
          ctx
            .from("products")
            .where((p) => p.description !== null && (p.category === null || p.stock > 100)),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE ("description" IS NOT NULL AND ("category" IS NULL OR "stock" > @__p1))',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 100 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((product) => {
        expect(product.description).to.not.be.null;
        expect(product.category === null || product.stock > 100).to.be.true;
      });
    });
  });

  describe("Arithmetic expressions in WHERE", () => {
    it("should handle arithmetic comparisons", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) => ctx.from("products").where((p) => p.price * 0.9 > 100),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "products" WHERE ("price" * @__p1) > @__p2');
      expect(capturedSql!.params).to.deep.equal({ __p1: 0.9, __p2: 100 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((product) => {
        expect(product.price * 0.9).to.be.greaterThan(100);
      });
    });

    it("should handle complex arithmetic", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) => ctx.from("order_items").where((oi) => oi.quantity * oi.unit_price > 500),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "order_items" WHERE ("quantity" * "unit_price") > @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 500 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((item) => {
        expect(item.quantity * item.unit_price).to.be.greaterThan(500);
      });
    });

    it("should handle division and modulo", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) => ctx.from("users").where((u) => u.id % 2 === 0),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE ("id" % @__p1) = @__p2');
      expect(capturedSql!.params).to.deep.equal({ __p1: 2, __p2: 0 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.id % 2).to.equal(0);
      });
    });
  });

  describe("Multiple WHERE clauses chained", () => {
    it("should combine 3 WHERE clauses", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) =>
          ctx
            .from("users")
            .where((u) => u.age !== null && u.age >= 25)
            .where((u) => u.is_active === 1)
            .where((u) => u.department_id !== 4),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("age" IS NOT NULL AND "age" >= @__p1) AND "is_active" = @__p2 AND "department_id" != @__p3',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 25, __p2: 1, __p3: 4 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.age).to.be.at.least(25);
        expect(user.is_active).to.equal(1);
        expect(user.department_id).to.not.equal(4);
      });
    });

    it("should combine 5 WHERE clauses", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) =>
          ctx
            .from("products")
            .where((p) => p.price > 10)
            .where((p) => p.stock > 0)
            .where((p) => p.category !== null)
            .where((p) => p.name !== "")
            .where((p) => p.id < 100),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "price" > @__p1 AND "stock" > @__p2 AND "category" IS NOT NULL AND "name" != @__p3 AND "id" < @__p4',
      );
      expect(capturedSql!.params).to.deep.equal({
        __p1: 10,
        __p2: 0,
        __p3: "",
        __p4: 100,
      });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((product) => {
        expect(product.price).to.be.greaterThan(10);
        expect(product.stock).to.be.greaterThan(0);
        expect(product.category).to.not.be.null;
        expect(product.name).to.not.equal("");
        expect(product.id).to.be.lessThan(100);
      });
    });
  });

  describe("WHERE with parameters", () => {
    it("should handle complex conditions with external parameters", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const params = {
        minAge: 30,
        maxAge: 50,
        targetDept: 1,
        mustBeActive: 1, // SQLite uses INTEGER (0 or 1) for boolean values
      };

      const results = executeSelect(
        db,
        schema,
        (ctx, p) =>
          ctx
            .from("users")
            .where(
              (u) =>
                u.age !== null &&
                u.age >= p.minAge &&
                u.age <= p.maxAge &&
                (u.department_id === p.targetDept || u.is_active === p.mustBeActive),
            ),
        params,
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ((("age" IS NOT NULL AND "age" >= @minAge) AND "age" <= @maxAge) AND ("department_id" = @targetDept OR "is_active" = @mustBeActive))',
      );
      expect(capturedSql!.params).to.deep.equal({
        minAge: 30,
        maxAge: 50,
        targetDept: 1,
        mustBeActive: 1,
      });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.age).to.be.at.least(params.minAge);
        expect(user.age).to.be.at.most(params.maxAge);
        expect(user.department_id === params.targetDept || user.is_active === params.mustBeActive)
          .to.be.true;
      });
    });

    it("should mix parameters with auto-parameterized constants", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const params = { threshold: 100 };

      const results = executeSelect(
        db,
        schema,
        (ctx, p) =>
          ctx
            .from("products")
            .where(
              (prod) =>
                prod.price > p.threshold && prod.stock > 50 && prod.category === "Electronics",
            ),
        params,
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE (("price" > @threshold AND "stock" > @__p1) AND "category" = @__p2)',
      );
      expect(capturedSql!.params).to.deep.equal({
        threshold: 100,
        __p1: 50,
        __p2: "Electronics",
      });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((product) => {
        expect(product.price).to.be.greaterThan(params.threshold);
        expect(product.stock).to.be.greaterThan(50);
        expect(product.category).to.equal("Electronics");
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle very long condition chains", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) =>
          ctx
            .from("users")
            .where(
              (u) =>
                u.id > 0 &&
                u.id < 1000 &&
                u.name !== "" &&
                u.email !== "" &&
                u.age !== null &&
                u.age > 0 &&
                u.age < 200 &&
                (u.is_active === 1 || u.is_active === 0) &&
                u.department_id !== null &&
                u.department_id >= 1 &&
                u.department_id <= 10,
            ),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE (((((((((("id" > @__p1 AND "id" < @__p2) AND "name" != @__p3) AND "email" != @__p4) AND "age" IS NOT NULL) AND "age" > @__p5) AND "age" < @__p6) AND ("is_active" = @__p7 OR "is_active" = @__p8)) AND "department_id" IS NOT NULL) AND "department_id" >= @__p9) AND "department_id" <= @__p10)',
      );
      expect(capturedSql!.params).to.deep.equal({
        __p1: 0,
        __p2: 1000,
        __p3: "",
        __p4: "",
        __p5: 0,
        __p6: 200,
        __p7: 1,
        __p8: 0,
        __p9: 1,
        __p10: 10,
      });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
    });

    it("should handle conditions with all comparison operators", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx) =>
          ctx.from("products").where(
            (p) =>
              p.id === p.id && // equality
              p.price !== 0 && // inequality
              p.stock > 0 && // greater than
              p.stock >= 1 && // greater than or equal
              p.price < 10000 && // less than
              p.price <= 9999.99, // less than or equal
          ),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE ((((("id" = "id" AND "price" != @__p1) AND "stock" > @__p2) AND "stock" >= @__p3) AND "price" < @__p4) AND "price" <= @__p5)',
      );
      expect(capturedSql!.params).to.deep.equal({
        __p1: 0,
        __p2: 0,
        __p3: 1,
        __p4: 10000,
        __p5: 9999.99,
      });

      expect(results).to.be.an("array");
      expect(results.length).to.equal(10); // All products match
    });

    it("should handle boolean field comparisons", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      const activeResults = executeSelectSimple(
        db,
        schema,
        (ctx) => ctx.from("users").where((u) => u.is_active === 1),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const inactiveResults = executeSelectSimple(
        db,
        schema,
        (ctx) => ctx.from("users").where((u) => u.is_active === 0),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal('SELECT * FROM "users" WHERE "is_active" = @__p1');
      expect(capturedSql1!.params).to.deep.equal({ __p1: 1 });

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal('SELECT * FROM "users" WHERE "is_active" = @__p1');
      expect(capturedSql2!.params).to.deep.equal({ __p1: 0 });

      expect(activeResults).to.be.an("array");
      expect(activeResults.length).to.be.greaterThan(0);
      expect(inactiveResults).to.be.an("array");
      expect(inactiveResults.length).to.be.greaterThan(0);
      expect(activeResults.length + inactiveResults.length).to.equal(10);
    });
  });
});
