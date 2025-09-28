/**
 * Integration tests for case-insensitive queries using toLowerCase/toUpperCase
 * Tests string transformation methods in WHERE clauses with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { execute } from "@webpods/tinqer-sql-pg-promise";
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
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users").where((u) => u.name.toLowerCase() == params.searchName),
        { searchName },
      );

      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("name", "JOHN SMITH");
    });

    it("should find multiple users with toLowerCase", async () => {
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users").where((u) => u.name.toLowerCase().startsWith(params.prefix)),
        { prefix: "j" },
      );

      expect(results).to.have.length(2); // JOHN SMITH and jane doe
      const names = results.map((u) => u.name);
      expect(names).to.include.members(["JOHN SMITH", "jane doe"]);
    });

    it("should handle email comparison with toLowerCase", async () => {
      const searchEmail = "bob.johnson@example.com";
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users").where((u) => u.email.toLowerCase() == params.searchEmail),
        { searchEmail },
      );

      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("email", "Bob.Johnson@Example.COM");
    });

    it("should combine toLowerCase with other conditions", async () => {
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users").where(
            (u) => u.name.toLowerCase().startsWith(params.prefix) && u.age! >= params.minAge,
          ),
        { prefix: "j", minAge: 29 },
      );

      expect(results).to.have.length(1); // Only JOHN SMITH (age 30)
      expect(results[0]).to.have.property("name", "JOHN SMITH");
    });
  });

  describe("toUpperCase for case-insensitive equality", () => {
    it("should find products using toUpperCase", async () => {
      const searchCategory = "ELECTRONICS";
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products").where(
            (p) => p.category!.toUpperCase() == params.searchCategory,
          ),
        { searchCategory },
      );

      expect(results).to.have.length(3); // All three products
      const categories = results.map((p) => p.category);
      expect(categories).to.include.members(["Electronics", "electronics", "ELECTRONICS"]);
    });

    it("should find products by name using toUpperCase", async () => {
      const searchName = "WIRELESS MOUSE";
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products").where((p) => p.name.toUpperCase() == params.searchName),
        { searchName },
      );

      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("name", "wireless mouse");
    });

    it("should combine toUpperCase with price filter", async () => {
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products").where(
            (p) => p.category!.toUpperCase() == params.category && p.price < params.maxPrice,
          ),
        { category: "ELECTRONICS", maxPrice: 50 },
      );

      expect(results).to.have.length(2); // wireless mouse and USB Cable
      const names = results.map((p) => p.name);
      expect(names).to.include.members(["wireless mouse", "USB Cable"]);
    });
  });

  describe("Mixed case transformations", () => {
    it("should handle toLowerCase and toUpperCase in same query", async () => {
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users")
            .join(
              from(dbContext, "products"),
              () => true,
              () => true,
              (u, p) => ({ user: u, product: p }),
            )
            .where(
              (joined) =>
                joined.user.name.toLowerCase() == params.userName &&
                joined.product.category!.toUpperCase() == params.productCategory,
            )
            .select((joined) => ({
              userName: joined.user.name,
              productName: joined.product.name,
            })),
        { userName: "john smith", productCategory: "ELECTRONICS" },
      );

      expect(results).to.have.length(3); // JOHN SMITH with all 3 electronics products
      results.forEach((r) => {
        expect(r.userName).to.equal("JOHN SMITH");
      });
    });

    it("should handle OR conditions with case transformations", async () => {
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users").where(
            (u) => u.name.toLowerCase() == params.name1 || u.name.toLowerCase() == params.name2,
          ),
        { name1: "john smith", name2: "bob johnson" },
      );

      expect(results).to.have.length(2);
      const names = results.map((u) => u.name);
      expect(names).to.include.members(["JOHN SMITH", "Bob Johnson"]);
    });

    it("should work with pattern matching and case transformation", async () => {
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products").where((p) =>
            p.name.toLowerCase().includes(params.searchTerm),
          ),
        { searchTerm: "usb" },
      );

      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("name", "USB Cable");
    });

    it("should handle NULL coalescing with toLowerCase", async () => {
      // Test with potentially null manager names (via self-join)
      const results = await execute(
        db,
        () =>
          from(dbContext, "users")
            .select((u) => ({
              id: u.id,
              name: u.name,
              nameLower: u.name.toLowerCase(),
            }))
            .where((u) => u.nameLower == "jane doe"),
        {},
      );

      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("name", "jane doe");
      expect(results[0]).to.have.property("nameLower", "jane doe");
    });
  });

  describe("Performance considerations", () => {
    it("should use functional index when available", async () => {
      // Create a functional index for better performance
      await db.none("CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users(LOWER(name))");

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users")
            .where((u) => u.name.toLowerCase() == params.search)
            .select((u) => ({ id: u.id, name: u.name })),
        { search: "jane doe" },
      );

      expect(results).to.have.length(1);
      expect(results[0]).to.have.property("name", "jane doe");

      // Clean up index
      await db.none("DROP INDEX IF EXISTS idx_users_name_lower");
    });

    it("should handle large result sets with case-insensitive filtering", async () => {
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.category!.toUpperCase() == params.category)
            .orderBy((p) => p.price)
            .take(params.limit),
        { category: "ELECTRONICS", limit: 2 },
      );

      expect(results).to.have.length(2);
      // Should be ordered by price: USB Cable ($9.99), wireless mouse ($29.99)
      expect(results[0]).to.have.property("name", "USB Cable");
      expect(results[1]).to.have.property("name", "wireless mouse");
    });
  });

  // Clean up test data
  after(async () => {
    await db.none("DELETE FROM users WHERE id >= 100");
    await db.none("DELETE FROM products WHERE id >= 100");
  });
});
