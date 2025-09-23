/**
 * Terminal operation integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { execute, executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";

describe("PostgreSQL Integration - Terminal Operations", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("first() and firstOrDefault()", () => {
    it("should return first user", async () => {
      const user = await executeSimple(db, () =>
        from(db, "users")
          .orderBy((u) => u.id)
          .first(),
      );

      expect(user).to.be.an("object");
      expect(user).to.have.property("id");
      expect(user).to.have.property("name");
      expect(user.id).to.equal(1);
    });

    it("should return first user matching condition", async () => {
      const user = await executeSimple(db, () => from(db, "users").first((u) => u.age > 40));

      expect(user).to.be.an("object");
      expect(user.age).to.be.greaterThan(40);
    });

    it("should throw error when no match for first()", async () => {
      try {
        await executeSimple(db, () => from(db, "users").first((u) => u.age > 100));
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("No elements found");
      }
    });

    it("should return null for firstOrDefault() when no match", async () => {
      const user = await executeSimple(db, () =>
        from(db, "users").firstOrDefault((u) => u.age > 100),
      );

      expect(user).to.be.null;
    });

    it("should work with complex queries", async () => {
      const result = await executeSimple(db, () =>
        from(db, "users")
          .join(from(db, "departments"), (u, d) => u.department_id === d.id)
          .where((u) => u.is_active === true)
          .orderBy((u) => u.age)
          .select((u, d) => ({
            userName: u.name,
            departmentName: d.name,
            age: u.age,
          }))
          .first(),
      );

      expect(result).to.be.an("object");
      expect(result).to.have.property("userName");
      expect(result).to.have.property("departmentName");
      expect(result).to.have.property("age");
    });
  });

  describe("single() and singleOrDefault()", () => {
    it("should return single user by unique email", async () => {
      const user = await executeSimple(db, () =>
        from(db, "users").single((u) => u.email === "john@example.com"),
      );

      expect(user).to.be.an("object");
      expect(user.name).to.equal("John Doe");
    });

    it("should throw error when multiple matches for single()", async () => {
      try {
        await executeSimple(db, () => from(db, "users").single((u) => u.department_id === 1));
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Multiple elements found");
      }
    });

    it("should throw error when no match for single()", async () => {
      try {
        await executeSimple(db, () =>
          from(db, "users").single((u) => u.email === "nonexistent@example.com"),
        );
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("No elements found");
      }
    });

    it("should return null for singleOrDefault() when no match", async () => {
      const user = await executeSimple(db, () =>
        from(db, "users").singleOrDefault((u) => u.email === "nonexistent@example.com"),
      );

      expect(user).to.be.null;
    });

    it("should throw error for singleOrDefault() with multiple matches", async () => {
      try {
        await executeSimple(db, () =>
          from(db, "users").singleOrDefault((u) => u.department_id === 1),
        );
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Multiple elements found");
      }
    });
  });

  describe("last() and lastOrDefault()", () => {
    it("should return last user", async () => {
      const user = await executeSimple(db, () =>
        from(db, "users")
          .orderBy((u) => u.id)
          .last(),
      );

      expect(user).to.be.an("object");
      expect(user.id).to.equal(10); // Henry Ford is the last inserted
    });

    it("should return last user matching condition", async () => {
      const user = await executeSimple(db, () =>
        from(db, "users")
          .where((u) => u.department_id === 1)
          .orderBy((u) => u.name)
          .last(),
      );

      expect(user).to.be.an("object");
      expect(user.department_id).to.equal(1);
    });

    it("should return null for lastOrDefault() when no match", async () => {
      const user = await executeSimple(db, () =>
        from(db, "users").lastOrDefault((u) => u.age > 100),
      );

      expect(user).to.be.null;
    });
  });

  describe("any() and all()", () => {
    it("should return true when any user matches condition", async () => {
      const hasYoungUsers = await executeSimple(db, () => from(db, "users").any((u) => u.age < 30));

      expect(hasYoungUsers).to.be.true;
    });

    it("should return false when no user matches condition", async () => {
      const hasCentenarians = await executeSimple(db, () =>
        from(db, "users").any((u) => u.age > 100),
      );

      expect(hasCentenarians).to.be.false;
    });

    it("should return true when any() is called without predicate on non-empty table", async () => {
      const hasUsers = await executeSimple(db, () => from(db, "users").any());

      expect(hasUsers).to.be.true;
    });

    it("should check if all users match condition", async () => {
      const allHaveEmail = await executeSimple(db, () =>
        from(db, "users").all((u) => u.email !== null),
      );

      expect(allHaveEmail).to.be.true;
    });

    it("should return false when not all match condition", async () => {
      const allActive = await executeSimple(db, () =>
        from(db, "users").all((u) => u.is_active === true),
      );

      expect(allActive).to.be.false; // Some users are inactive
    });

    it("should work with WHERE clause", async () => {
      const allEngineersActive = await executeSimple(db, () =>
        from(db, "users")
          .where((u) => u.department_id === 1)
          .all((u) => u.is_active === true),
      );

      // Check the actual data to verify the result
      const engineerStatus = await executeSimple(db, () =>
        from(db, "users")
          .where((u) => u.department_id === 1)
          .select((u) => ({ is_active: u.is_active })),
      );

      const expectedResult = engineerStatus.every((u) => u.is_active === true);
      expect(allEngineersActive).to.equal(expectedResult);
    });
  });

  describe("toArray() and toList()", () => {
    it("should return array of results", async () => {
      const users = await executeSimple(db, () =>
        from(db, "users")
          .where((u) => u.is_active === true)
          .orderBy((u) => u.name)
          .toArray(),
      );

      expect(users).to.be.an("array");
      expect(users.length).to.be.greaterThan(0);
      users.forEach((user) => {
        expect(user.is_active).to.be.true;
      });
    });

    it("should return list of results", async () => {
      const products = await executeSimple(db, () =>
        from(db, "products")
          .where((p) => p.stock > 50)
          .orderByDescending((p) => p.price)
          .toList(),
      );

      expect(products).to.be.an("array");
      products.forEach((product) => {
        expect(product.stock).to.be.greaterThan(50);
      });

      // Verify descending order
      for (let i = 1; i < products.length; i++) {
        expect(products[i - 1].price).to.be.at.least(products[i].price);
      }
    });
  });

  describe("Complex terminal operation scenarios", () => {
    it("should handle parameterized terminal operations", async () => {
      const targetEmail = "jane@example.com";
      const user = await execute(
        db,
        (params) => from(db, "users").single((u) => u.email === params.email),
        { email: targetEmail },
      );

      expect(user).to.be.an("object");
      expect(user.email).to.equal(targetEmail);
      expect(user.name).to.equal("Jane Smith");
    });

    it("should check product availability", async () => {
      const hasExpensiveElectronics = await executeSimple(db, () =>
        from(db, "products").any((p) => p.category === "Electronics" && p.price > 500),
      );

      expect(hasExpensiveElectronics).to.be.true; // Laptop is $999.99
    });

    it("should verify all completed orders have positive totals", async () => {
      const allPositive = await executeSimple(db, () =>
        from(db, "orders")
          .where((o) => o.status === "completed")
          .all((o) => o.total_amount > 0),
      );

      expect(allPositive).to.be.true;
    });
  });
});
