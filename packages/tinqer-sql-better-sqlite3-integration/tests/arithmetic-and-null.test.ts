/**
 * Arithmetic operations and NULL handling integration tests with real Better SQLite3
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { executeSelectSimple } from "@webpods/tinqer-sql-better-sqlite3";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { schema } from "./database-schema.js";
describe("Better SQLite3 Integration - Arithmetic and NULL Operations", () => {
  before(() => {
    setupTestDatabase(db);
  });

  describe("Arithmetic operations", () => {
    it("should handle addition in SELECT", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (q) =>
          q.from("products").select((p) => ({
            name: p.name,
            price: p.price,
            priceWithTax: p.price * 1.1,
            priceWithShipping: p.price + 10,
          })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "name" AS "name", "price" AS "price", ("price" * @__p1) AS "priceWithTax", ("price" + @__p2) AS "priceWithShipping" FROM "products"',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 1.1, __p2: 10 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.priceWithTax).to.be.closeTo(r.price * 1.1, 0.01);
        expect(r.priceWithShipping).to.be.closeTo(r.price + 10, 0.01);
      });
    });

    it("should handle subtraction and multiplication", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (q) =>
          q.from("order_items").select((oi) => ({
            orderId: oi.order_id,
            quantity: oi.quantity,
            unitPrice: oi.unit_price,
            totalPrice: oi.quantity * oi.unit_price,
            bulkDiscount: oi.quantity * oi.unit_price * 0.9,
          })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "order_id" AS "orderId", "quantity" AS "quantity", "unit_price" AS "unitPrice", ("quantity" * "unit_price") AS "totalPrice", (("quantity" * "unit_price") * @__p1) AS "bulkDiscount" FROM "order_items"',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 0.9 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.totalPrice).to.equal(r.quantity * r.unitPrice);
        expect(r.bulkDiscount).to.be.closeTo(r.totalPrice * 0.9, 0.01);
      });
    });

    it("should handle division", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("products")
            .select((p) => ({
              name: p.name,
              price: p.price,
              stock: p.stock,
              pricePerUnit: p.price / p.stock,
            }))
            .where((p) => p.stock > 0), // Avoid division by zero
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "name" AS "name", "price" AS "price", "stock" AS "stock", ("price" / "stock") AS "pricePerUnit" FROM "products" WHERE "stock" > @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 0 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.pricePerUnit).to.be.closeTo(r.price / r.stock, 0.01);
      });
    });

    it("should handle modulo operations", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      const evenUsers = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("users")
            .where((u) => u.id % 2 === 0)
            .select((u) => ({ id: u.id, name: u.name })),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const oddUsers = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("users")
            .where((u) => u.id % 2 === 1)
            .select((u) => ({ id: u.id, name: u.name })),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal(
        'SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE ("id" % @__p1) = @__p2',
      );
      expect(capturedSql1!.params).to.deep.equal({ __p1: 2, __p2: 0 });

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal(
        'SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE ("id" % @__p1) = @__p2',
      );
      expect(capturedSql2!.params).to.deep.equal({ __p1: 2, __p2: 1 });

      expect(evenUsers).to.be.an("array");
      expect(oddUsers).to.be.an("array");
      evenUsers.forEach((u) => expect(u.id % 2).to.equal(0));
      oddUsers.forEach((u) => expect(u.id % 2).to.equal(1));
    });

    it("should handle complex arithmetic expressions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("products")
            .where((p) => (p.price * p.stock) / 100 > 10)
            .select((p) => ({
              name: p.name,
              inventoryValue: p.price * p.stock,
              scaledValue: (p.price * p.stock) / 100,
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "name" AS "name", ("price" * "stock") AS "inventoryValue", (("price" * "stock") / @__p3) AS "scaledValue" FROM "products" WHERE (("price" * "stock") / @__p1) > @__p2',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 100, __p2: 10, __p3: 100 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.scaledValue).to.be.greaterThan(10);
        expect(r.scaledValue).to.be.closeTo(r.inventoryValue / 100, 0.01);
      });
    });

    it("should handle arithmetic in GROUP BY aggregates", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("order_items")
            .groupBy((oi) => oi.order_id)
            .select((g) => ({
              orderId: g.key,
              totalQuantity: g.sum((oi) => oi.quantity),
              totalValue: g.sum((oi) => oi.quantity * oi.unit_price),
              avgItemValue: g.average((oi) => oi.unit_price),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "order_id" AS "orderId", SUM("quantity") AS "totalQuantity", SUM(("quantity" * "unit_price")) AS "totalValue", AVG("unit_price") AS "avgItemValue" FROM "order_items" GROUP BY "order_id"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.totalQuantity).to.be.greaterThan(0);
        expect(r.totalValue).to.be.greaterThan(0);
        expect(r.avgItemValue).to.be.greaterThan(0);
      });
    });
  });

  describe("NULL handling", () => {
    it("should handle IS NULL comparisons", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      // First, let's insert a user with NULL age for testing
      db.exec(`
        INSERT OR REPLACE INTO users (name, email, age, department_id, is_active)
        VALUES ('Test Null User', 'testnull@example.com', NULL, 1, 1)
      `);

      const nullAgeUsers = executeSelectSimple(
        db,
        schema,
        (q) => q.from("users").where((u) => u.age === null),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const nonNullAgeUsers = executeSelectSimple(
        db,
        schema,
        (q) => q.from("users").where((u) => u.age !== null),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal('SELECT * FROM "users" WHERE "age" IS NULL');
      expect(capturedSql1!.params).to.deep.equal({});

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal('SELECT * FROM "users" WHERE "age" IS NOT NULL');
      expect(capturedSql2!.params).to.deep.equal({});

      expect(nullAgeUsers).to.be.an("array");
      expect(nonNullAgeUsers).to.be.an("array");

      nullAgeUsers.forEach((u) => {
        expect(u.age).to.be.null;
      });

      nonNullAgeUsers.forEach((u) => {
        expect(u.age).to.not.be.null;
      });

      // Clean up
      db.exec(`DELETE FROM users WHERE email = 'testnull@example.com'`);
    });

    it("should handle NULL in arithmetic operations", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Test NULL handling in arithmetic with nullable columns
      // Since stock is NOT NULL, we'll test with nullable category and arithmetic
      const results = executeSelectSimple(
        db,
        schema,
        (q) =>
          q.from("products").select((p) => ({
            name: p.name,
            // Test NULL-safe arithmetic with coalescing
            totalValue: p.stock * p.price,
            hasCategory: p.category !== null,
            // This will be NULL for products without category
            categoryLength: p.category !== null ? p.category : null,
          })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "name" AS "name", ("stock" * "price") AS "totalValue", CASE WHEN "category" IS NOT NULL THEN TRUE ELSE FALSE END AS "hasCategory", CASE WHEN "category" IS NOT NULL THEN "category" ELSE NULL END AS "categoryLength" FROM "products"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);

      // Some products should have null category
      const nullCategoryProducts = results.filter((r) => !r.hasCategory);
      if (nullCategoryProducts.length > 0) {
        expect(nullCategoryProducts[0]!.categoryLength).to.be.null;
      }

      // All products should have totalValue since price and stock are NOT NULL
      results.forEach((r) => {
        expect(r.totalValue).to.not.be.null;
        expect(r.totalValue).to.be.a("number");
      });
    });

    it("should handle COALESCE-like operations with ??", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Insert test data
      db.exec(`
        INSERT OR REPLACE INTO departments (id, name, budget)
        VALUES (999, 'Test Dept', NULL)
      `);

      const results = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("departments")
            .where((d) => d.id === 999)
            .select((d) => ({
              name: d.name,
              budget: d.budget ?? 0, // COALESCE(budget, 0)
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "name" AS "name", COALESCE("budget", @__p2) AS "budget" FROM "departments" WHERE "id" = @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 999, __p2: 0 });

      expect(results).to.be.an("array");
      if (results.length > 0) {
        expect(results[0]!.budget).to.equal(0);
      }

      // Clean up
      db.exec(`DELETE FROM departments WHERE id = 999`);
    });

    it("should handle NULL in string operations", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      // Test that NULL descriptions are handled properly
      db.exec(`
        INSERT OR REPLACE INTO products (id, name, price, stock, category, description)
        VALUES (999, 'No Description Product', 49.99, 10, 'Test', NULL)
      `);

      const withDescription = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("products")
            .where((p) => p.description !== null && p.description.includes("laptop")),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const withoutDescription = executeSelectSimple(
        db,
        schema,
        (q) => q.from("products").where((p) => p.description === null),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal(
        'SELECT * FROM "products" WHERE ("description" IS NOT NULL AND "description" LIKE \'%\' || @__p1 || \'%\')',
      );
      expect(capturedSql1!.params).to.deep.equal({ __p1: "laptop" });

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal('SELECT * FROM "products" WHERE "description" IS NULL');
      expect(capturedSql2!.params).to.deep.equal({});

      expect(withDescription).to.be.an("array");
      expect(withoutDescription).to.be.an("array");

      withDescription.forEach((p) => {
        expect(p.description).to.not.be.null;
      });

      withoutDescription.forEach((p) => {
        expect(p.description).to.be.null;
      });

      // Clean up
      db.exec(`DELETE FROM products WHERE id = 999`);
    });

    it("should handle NULL in JOIN conditions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Users with NULL department_id shouldn't appear in inner join
      db.exec(`
        INSERT OR REPLACE INTO users (id, name, email, age, department_id, is_active)
        VALUES (999, 'No Dept User', 'nodept@example.com', 30, NULL, 1)
      `);

      const joinResults = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("users")
            .join(
              q.from("departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .select((joined) => ({
              userName: joined.u.name,
              deptName: joined.d.name,
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."name" AS "userName", "t1"."name" AS "deptName" FROM "users" AS "t0" INNER JOIN "departments" AS "t1" ON "t0"."department_id" = "t1"."id"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      // User with NULL department_id should not appear in results
      const hasNoDeptUser = joinResults.some((r) => r.userName === "No Dept User");
      expect(hasNoDeptUser).to.be.false;

      // Clean up
      db.exec(`DELETE FROM users WHERE id = 999`);
    });

    it("should handle NULL in aggregates", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql3: { sql: string; params: Record<string, unknown> } | undefined;

      // Insert test data with some NULL ages
      db.exec(`
        INSERT OR REPLACE INTO users (id, name, email, age, department_id, is_active)
        VALUES
          (997, 'Null Age 1', 'nullage1@example.com', NULL, 1, 1),
          (998, 'Null Age 2', 'nullage2@example.com', NULL, 1, 1)
      `);

      // COUNT should count rows with NULL
      const totalCount = executeSelectSimple(db, schema, (q) => q.from("users").count(), {
        onSql: (result) => {
          capturedSql1 = result;
        },
      });

      // AVG, SUM, MIN, MAX ignore NULL values
      const avgAge = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("users")
            .where((u) => u.age !== null)
            .average((u) => u.age!),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal('SELECT COUNT(*) FROM "users"');
      expect(capturedSql1!.params).to.deep.equal({});

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal('SELECT AVG("age") FROM "users" WHERE "age" IS NOT NULL');
      expect(capturedSql2!.params).to.deep.equal({});

      expect(totalCount).to.be.a("number");
      expect(avgAge).to.be.a("number");

      // Average should only consider non-NULL values
      const nonNullAges = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("users")
            .where((u) => u.age !== null)
            .select((u) => ({ age: u.age })),
        {
          onSql: (result) => {
            capturedSql3 = result;
          },
        },
      );

      expect(capturedSql3).to.exist;
      expect(capturedSql3!.sql).to.equal(
        'SELECT "age" AS "age" FROM "users" WHERE "age" IS NOT NULL',
      );
      expect(capturedSql3!.params).to.deep.equal({});

      const manualAvg = nonNullAges.reduce((sum, u) => sum + u.age!, 0) / nonNullAges.length;
      expect(avgAge).to.be.closeTo(manualAvg, 0.1);

      // Clean up
      db.exec(`DELETE FROM users WHERE id IN (997, 998)`);
    });
  });

  describe("Boolean operations", () => {
    it("should handle boolean fields directly", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      const activeUsers = executeSelectSimple(
        db,
        schema,
        (q) => q.from("users").where((u) => u.is_active === 1),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const inactiveUsers = executeSelectSimple(
        db,
        schema,
        (q) => q.from("users").where((u) => u.is_active === 0),
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

      expect(activeUsers).to.be.an("array");
      expect(inactiveUsers).to.be.an("array");

      activeUsers.forEach((u) => {
        expect(u.is_active).to.equal(1);
      });

      inactiveUsers.forEach((u) => {
        expect(u.is_active).to.equal(0);
      });
    });

    it("should handle boolean comparisons", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (q) => q.from("users").where((u) => u.is_active === 1 && u.age !== null && u.age >= 30),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE (("is_active" = @__p1 AND "age" IS NOT NULL) AND "age" >= @__p2)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 1, __p2: 30 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((u) => {
        expect(u.is_active).to.equal(1);
        expect(u.age).to.be.at.least(30);
      });
    });

    it("should handle complex boolean logic", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("users")
            .where(
              (u) =>
                (u.is_active && u.age !== null && u.age < 30) ||
                (!u.is_active && u.age !== null && u.age >= 40),
            ),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ((("is_active" AND "age" IS NOT NULL) AND "age" < @__p1) OR ((NOT "is_active" AND "age" IS NOT NULL) AND "age" >= @__p2))',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 30, __p2: 40 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((u) => {
        const condition1 = u.is_active && u.age !== null && u.age < 30;
        const condition2 = !u.is_active && u.age !== null && u.age >= 40;
        expect(condition1 || condition2).to.be.true;
      });
    });
  });
});
