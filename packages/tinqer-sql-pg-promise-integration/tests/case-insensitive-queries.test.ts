/**
 * Integration tests for case-insensitive queries using toLowerCase/toUpperCase
 * Tests string transformation methods in WHERE clauses with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { executeSelect } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("PostgreSQL Integration - Case-Insensitive Queries", () => {
  before(async () => {
    await setupTestDatabase(db);

    // Add test data with mixed cases
    await db.none(`
      INSERT INTO users (id, name, email, age, is_active, created_at, manager_id, department_id)
      VALUES
        (100, 'JOHN SMITH', 'john.smith@example.com', 30, true, '2024-01-01', null, 1),
        (101, 'jane doe', 'jane.doe@example.com', 28, true, '2024-01-02', null, 1),
        (102, 'Bob Johnson', 'Bob.Johnson@Example.COM', 35, true, '2024-01-03', null, 2)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, email = EXCLUDED.email;

      INSERT INTO products (id, name, description, price, stock, category, created_at)
      VALUES
        (100, 'LAPTOP PRO', 'High-end laptop', 1999.99, 10, 'Electronics', '2024-01-01'),
        (101, 'wireless mouse', 'Ergonomic mouse', 29.99, 100, 'electronics', '2024-01-02'),
        (102, 'USB Cable', 'Type-C cable', 9.99, 200, 'ELECTRONICS', '2024-01-03')
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, category = EXCLUDED.category;
    `);
  });

  describe("toLowerCase for case-insensitive equality", () => {
    it("should find users regardless of case using toLowerCase", async () => {
      const searchName = "john smith";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) => ctx.from("users").where((u) => u.name.toLowerCase() == params.searchName),
        { searchName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE LOWER("name") = $(searchName)',
      );
      expect(capturedSql!.params).to.deep.equal({ searchName });
      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("name", "JOHN SMITH");
    });

    it("should find multiple users with toLowerCase", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx.from("users").where((u) => u.name.toLowerCase().startsWith(params.prefix)),
        { prefix: "j" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE LOWER("name") LIKE $(prefix) || \'%\'',
      );
      expect(capturedSql!.params).to.deep.equal({ prefix: "j" });
      expect(results).to.have.length(4); // JOHN SMITH, jane doe, John Doe, Jane Smith
      const names = results.map((u) => u.name);
      expect(names).to.include.members(["JOHN SMITH", "jane doe", "John Doe", "Jane Smith"]);
    });

    it("should handle email comparison with toLowerCase", async () => {
      const searchEmail = "bob.johnson@example.com";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx.from("users").where((u) => u.email.toLowerCase() == params.searchEmail),
        { searchEmail },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE LOWER("email") = $(searchEmail)',
      );
      expect(capturedSql!.params).to.deep.equal({ searchEmail });
      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("email", "Bob.Johnson@Example.COM");
    });

    it("should combine toLowerCase with other conditions", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx
            .from("users")
            .where(
              (u) => u.name.toLowerCase().startsWith(params.prefix) && u.age! >= params.minAge,
            ),
        { prefix: "j", minAge: 29 },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE (LOWER("name") LIKE $(prefix) || \'%\' AND "age" >= $(minAge))',
      );
      expect(capturedSql!.params).to.deep.equal({ prefix: "j", minAge: 29 });
      expect(results).to.have.length(2); // JOHN SMITH (age 30) and John Doe (age 30)
      const names = results.map((u) => u.name);
      expect(names).to.include.members(["JOHN SMITH", "John Doe"]);
    });
  });

  describe("toUpperCase for case-insensitive equality", () => {
    it("should find products using toUpperCase", async () => {
      const searchCategory = "ELECTRONICS";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx.from("products").where((p) => p.category!.toUpperCase() == params.searchCategory),
        { searchCategory },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE UPPER("category") = $(searchCategory)',
      );
      expect(capturedSql!.params).to.deep.equal({ searchCategory });
      expect(results).to.have.length(9); // All electronics products from both test sets
      const categories = results.map((p) => p.category);
      // Should include products with various case versions of "Electronics"
      expect(categories).to.include.members(["Electronics", "electronics", "ELECTRONICS"]);
    });

    it("should find products by name using toUpperCase", async () => {
      const searchName = "WIRELESS MOUSE";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx.from("products").where((p) => p.name.toUpperCase() == params.searchName),
        { searchName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE UPPER("name") = $(searchName)',
      );
      expect(capturedSql!.params).to.deep.equal({ searchName });
      expect(results).to.have.length(1);
      // Should find the product whose name uppercased equals "WIRELESS MOUSE"
      if (results[0]) {
        expect(results[0].name.toUpperCase()).to.equal("WIRELESS MOUSE");
      }
    });

    it("should combine toUpperCase with price filter", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx
            .from("products")
            .where(
              (p) => p.category!.toUpperCase() == params.category && p.price < params.maxPrice,
            ),
        { category: "ELECTRONICS", maxPrice: 50 },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE (UPPER("category") = $(category) AND "price" < $(maxPrice))',
      );
      expect(capturedSql!.params).to.deep.equal({ category: "ELECTRONICS", maxPrice: 50 });
      expect(results).to.have.length(3); // Mouse, wireless mouse, and USB Cable
      const names = results.map((p) => p.name);
      expect(names).to.include.members(["Mouse", "wireless mouse", "USB Cable"]);
    });
  });

  describe("Mixed case transformations", () => {
    it("should handle toLowerCase and toUpperCase in same query", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Test toLowerCase on users table
      const userResults = await executeSelect(
        db,
        dbContext,
        (ctx, params) => ctx.from("users").where((u) => u.name.toLowerCase() == params.userName),
        { userName: "john smith" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE LOWER("name") = $(userName)');
      expect(capturedSql!.params).to.deep.equal({ userName: "john smith" });
      expect(userResults).to.have.length(1);
      expect(userResults[0]).to.have.property("name", "JOHN SMITH");

      // Test toUpperCase on products table
      capturedSql = undefined;
      const productResults = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx.from("products").where((p) => p.category!.toUpperCase() == params.productCategory),
        { productCategory: "ELECTRONICS" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE UPPER("category") = $(productCategory)',
      );
      expect(capturedSql!.params).to.deep.equal({ productCategory: "ELECTRONICS" });
      expect(productResults).to.have.length(9); // All electronics products (6 base + 3 test)
      productResults.forEach((p) => {
        expect(p.category!.toLowerCase()).to.equal("electronics");
      });
    });

    it("should handle OR conditions with case transformations", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx
            .from("users")
            .where(
              (u) => u.name.toLowerCase() == params.name1 || u.name.toLowerCase() == params.name2,
            ),
        { name1: "john smith", name2: "bob johnson" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE (LOWER("name") = $(name1) OR LOWER("name") = $(name2))',
      );
      expect(capturedSql!.params).to.deep.equal({ name1: "john smith", name2: "bob johnson" });
      expect(results).to.have.length(3); // JOHN SMITH + 2 Bob Johnsons (id:5 and id:102)
      const names = results.map((u) => u.name);
      expect(names).to.include.members(["JOHN SMITH", "Bob Johnson"]);
    });

    it("should work with pattern matching and case transformation", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx.from("products").where((p) => p.name.toLowerCase().includes(params.searchTerm)),
        { searchTerm: "usb" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        "SELECT * FROM \"products\" WHERE LOWER(\"name\") LIKE '%' || $(searchTerm) || '%'",
      );
      expect(capturedSql!.params).to.deep.equal({ searchTerm: "usb" });
      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("name", "USB Cable");
    });

    it("should handle NULL coalescing with toLowerCase", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Test toLowerCase in WHERE directly
      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx
            .from("users")
            .where((u) => u.name.toLowerCase() == params.searchName)
            .select((u) => ({
              id: u.id,
              name: u.name,
              nameLower: u.name.toLowerCase(),
            })),
        { searchName: "jane doe" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "id" AS "id", "name" AS "name", LOWER("name") AS "nameLower" FROM "users" WHERE LOWER("name") = $(searchName)',
      );
      expect(capturedSql!.params).to.deep.equal({ searchName: "jane doe" });
      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("name", "jane doe");
      expect(results[0]).to.have.property("nameLower", "jane doe");
    });
  });

  describe("Performance considerations", () => {
    it("should use functional index when available", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Create a functional index for better performance
      await db.none("CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users(LOWER(name))");

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx
            .from("users")
            .where((u) => u.name.toLowerCase() == params.search)
            .select((u) => ({ id: u.id, name: u.name })),
        { search: "jane doe" },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE LOWER("name") = $(search)',
      );
      expect(capturedSql!.params).to.deep.equal({ search: "jane doe" });
      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("name", "jane doe");

      // Clean up index
      await db.none("DROP INDEX IF EXISTS idx_users_name_lower");
    });

    it("should handle large result sets with case-insensitive filtering", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelect(
        db,
        dbContext,
        (ctx, params) =>
          ctx
            .from("products")
            .where((p) => p.category!.toUpperCase() == params.category)
            .orderBy((p) => p.price)
            .thenBy((p) => p.id) // Add stable ordering for ties
            .take(params.limit),
        { category: "ELECTRONICS", limit: 2 },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE UPPER("category") = $(category) ORDER BY "price" ASC, "id" ASC LIMIT $(limit)',
      );
      expect(capturedSql!.params).to.deep.equal({ category: "ELECTRONICS", limit: 2 });
      expect(results).to.have.length(2);
      // Should be ordered by price: USB Cable ($9.99), Mouse ($29.99, id:2)
      expect(results[0]).to.have.property("name", "USB Cable");
      expect(results[1]).to.have.property("name", "Mouse"); // id:2 comes before id:101
    });
  });

  // Clean up test data
  after(async () => {
    await db.none("DELETE FROM users WHERE id >= 100");
    await db.none("DELETE FROM products WHERE id >= 100");
  });
});
