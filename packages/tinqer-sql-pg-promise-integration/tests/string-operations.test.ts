/**
 * String operation integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("PostgreSQL Integration - String Operations", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("startsWith", () => {
    it("should find users with names starting with 'J'", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.name.startsWith("J")),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.name[0]).to.equal("J");
      });
    });

    it("should find emails starting with specific prefix", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.email.startsWith("alice")),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1);
      expect(results[0]!.email).to.equal("alice@example.com");
    });

    it("should combine startsWith with other conditions", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.name.startsWith("J") && u.is_active === true),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.name[0]).to.equal("J");
        expect(user.is_active).to.be.true;
      });
    });
  });

  describe("endsWith", () => {
    it("should find emails ending with '@example.com'", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.email.endsWith("@example.com")),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(10); // All our test users have @example.com
      results.forEach((user) => {
        expect(user.email).to.match(/@example\.com$/);
      });
    });

    it("should find products with names ending with specific suffix", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "products").where((p) => p.name.endsWith("top")),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1);
      expect(results[0]!.name).to.equal("Laptop");
    });
  });

  describe("contains (includes)", () => {
    it("should find users with 'oh' in their name", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.name.includes("oh")),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.name.toLowerCase()).to.include("oh");
      });
    });

    it("should find products with 'office' in description", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "products").where(
          (p) => p.description !== null && p.description.includes("office"),
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1); // Ergonomic office chair
      expect(results[0]!.name).to.equal("Chair");
    });

    it("should combine multiple string operations", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "products").where(
          (p) =>
            p.category !== null &&
            p.category.startsWith("Electr") &&
            (p.name.includes("e") ||
              (p.description !== null && p.description.includes("performance"))),
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((product) => {
        expect(product.category).to.equal("Electronics");
      });
    });
  });

  describe("Complex string queries", () => {
    it("should find users with specific email patterns", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "users").where(
          (u) => u.email.startsWith("j") && u.email.endsWith("@example.com"),
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(2); // John and Jane
      results.forEach((user) => {
        expect(user.email[0]).to.equal("j");
      });
    });

    it("should search products by multiple string fields", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "products").where(
          (p) =>
            p.name.includes("e") || (p.description !== null && p.description.includes("wireless")),
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
    });

    it("should combine string operations with joins", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "users")
          .join(
            from(dbContext, "departments"),
            (u) => u.department_id,
            (d) => d.id,
            (u, d) => ({ u, d }),
          )
          .where((joined) => joined.u.name.startsWith("J") && joined.d.name.includes("ing"))
          .select((joined) => ({
            userName: joined.u.name,
            departmentName: joined.d.name,
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((r) => {
        expect(r.userName![0]).to.equal("J");
        expect(r.departmentName!).to.match(/ing/);
      });
    });

    it("should handle case-sensitive string operations", async () => {
      // Note: PostgreSQL LIKE is case-sensitive by default
      const upperResults = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.name.includes("J")),
      );

      const lowerResults = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.name.includes("o")),
      );

      // John, Jane, Bob Johnson have capital J
      expect(upperResults.length).to.be.greaterThan(0);
      // Several names have lowercase 'o' (John, Johnson, Brown, Hopper, Ford)
      expect(lowerResults.length).to.be.greaterThan(0);

      // Case sensitivity check - capital D vs lowercase d
      const capitalD = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.name.includes("D")),
      );
      const lowercaseD = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.name.includes("d")),
      );

      // Diana, John Doe have capital D
      expect(capitalD.length).to.be.greaterThan(0);
      // Henry Ford has lowercase d
      expect(lowercaseD.length).to.be.greaterThan(0);
    });
  });

  describe("String operations with aggregates", () => {
    it("should count users by email domain", async () => {
      const count = await executeSimple(db, () =>
        from(dbContext, "users")
          .where((u) => u.email.endsWith("@example.com"))
          .count(),
      );

      expect(count).to.equal(10);
    });
  });

  describe("String operations with NULL handling", () => {
    it("should handle nullable description fields", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "products").where(
          (p) => p.description !== null && p.description.includes("High"),
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(1); // High-performance laptop
      expect(results[0]!.name).to.equal("Laptop");
    });

    it("should check for non-null strings", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "products").where((p) => p.description !== null),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(10); // All products have descriptions
    });
  });
});
