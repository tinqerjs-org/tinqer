/**
 * Complex WHERE clause integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { execute, executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";

describe("PostgreSQL Integration - Complex WHERE", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("Nested logical conditions", () => {
    it("should handle complex nested AND/OR conditions", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users").where(
          (u) =>
            (u.age >= 25 && u.age <= 35 && u.is_active) || (u.department_id === 4 && u.age >= 40),
        ),
      );

      expect(results).to.be.an("array");
      results.forEach((user) => {
        const condition1 = user.age >= 25 && user.age <= 35 && user.is_active;
        const condition2 = user.department_id === 4 && user.age >= 40;
        expect(condition1 || condition2).to.be.true;
      });
    });

    it("should handle deeply nested conditions", async () => {
      const results = await executeSimple(db, () =>
        from(db, "products").where(
          (p) =>
            ((p.price > 100 && p.price < 500) || (p.price > 800 && p.stock > 40)) &&
            (p.category === "Electronics" || (p.category === "Furniture" && p.stock < 50)),
        ),
      );

      expect(results).to.be.an("array");
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

    it("should handle multiple NOT conditions", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users").where((u) => !(u.department_id === 1) && !(u.age < 30) && !!u.is_active),
      );

      expect(results).to.be.an("array");
      results.forEach((user) => {
        expect(user.department_id).to.not.equal(1);
        expect(user.age).to.be.at.least(30);
        expect(user.is_active).to.be.true;
      });
    });
  });

  describe("Range conditions", () => {
    it("should handle BETWEEN-like conditions", async () => {
      const results = await executeSimple(db, () =>
        from(db, "products").where((p) => p.price >= 50 && p.price <= 300),
      );

      expect(results).to.be.an("array");
      results.forEach((product) => {
        expect(product.price).to.be.at.least(50);
        expect(product.price).to.be.at.most(300);
      });
    });

    it("should handle multiple range conditions", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users").where(
          (u) => (u.age >= 25 && u.age <= 30) || (u.age >= 40 && u.age <= 50),
        ),
      );

      expect(results).to.be.an("array");
      results.forEach((user) => {
        const inFirstRange = user.age >= 25 && user.age <= 30;
        const inSecondRange = user.age >= 40 && user.age <= 50;
        expect(inFirstRange || inSecondRange).to.be.true;
      });
    });

    it("should handle exclusive ranges", async () => {
      const results = await executeSimple(db, () =>
        from(db, "products").where((p) => p.stock > 100 && p.stock < 500),
      );

      expect(results).to.be.an("array");
      results.forEach((product) => {
        expect(product.stock).to.be.greaterThan(100);
        expect(product.stock).to.be.lessThan(500);
      });
    });
  });

  describe("IN-like conditions with arrays", () => {
    it("should simulate IN with array includes", async () => {
      const targetIds = [1, 3, 5, 7];
      const results = await executeSimple(db, () =>
        from(db, "users").where((u) => targetIds.includes(u.id)),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(4);
      results.forEach((user) => {
        expect(targetIds).to.include(user.id);
      });
    });

    it("should simulate NOT IN with negated includes", async () => {
      const excludedCategories = ["Furniture", "Stationery"];
      const results = await executeSimple(db, () =>
        from(db, "products").where((p) => !excludedCategories.includes(p.category)),
      );

      expect(results).to.be.an("array");
      results.forEach((product) => {
        expect(excludedCategories).to.not.include(product.category);
      });
    });

    it("should handle empty array includes", async () => {
      const emptyList: number[] = [];
      const results = await executeSimple(db, () =>
        from(db, "users").where((u) => emptyList.includes(u.id)),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(0);
    });
  });

  describe("NULL handling", () => {
    it("should handle IS NULL checks", async () => {
      // All our test users have department_id, but let's test the syntax
      const results = await executeSimple(db, () =>
        from(db, "users").where((u) => u.department_id !== null && u.is_active === true),
      );

      expect(results).to.be.an("array");
      results.forEach((user) => {
        expect(user.department_id).to.not.be.null;
        expect(user.is_active).to.be.true;
      });
    });

    it("should handle complex NULL checks", async () => {
      const results = await executeSimple(db, () =>
        from(db, "products").where(
          (p) => p.description !== null && (p.category === null || p.stock > 100),
        ),
      );

      expect(results).to.be.an("array");
      results.forEach((product) => {
        expect(product.description).to.not.be.null;
        expect(product.category === null || product.stock > 100).to.be.true;
      });
    });
  });

  describe("Arithmetic expressions in WHERE", () => {
    it("should handle arithmetic comparisons", async () => {
      const results = await executeSimple(db, () =>
        from(db, "products").where((p) => p.price * 0.9 > 100),
      );

      expect(results).to.be.an("array");
      results.forEach((product) => {
        expect(product.price * 0.9).to.be.greaterThan(100);
      });
    });

    it("should handle complex arithmetic", async () => {
      const results = await executeSimple(db, () =>
        from(db, "order_items").where((oi) => oi.quantity * oi.unit_price > 500),
      );

      expect(results).to.be.an("array");
      results.forEach((item) => {
        expect(item.quantity * item.unit_price).to.be.greaterThan(500);
      });
    });

    it("should handle division and modulo", async () => {
      const results = await executeSimple(db, () => from(db, "users").where((u) => u.id % 2 === 0));

      expect(results).to.be.an("array");
      results.forEach((user) => {
        expect(user.id % 2).to.equal(0);
      });
    });
  });

  describe("Multiple WHERE clauses chained", () => {
    it("should combine 3 WHERE clauses", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users")
          .where((u) => u.age >= 25)
          .where((u) => u.is_active === true)
          .where((u) => u.department_id !== 4),
      );

      expect(results).to.be.an("array");
      results.forEach((user) => {
        expect(user.age).to.be.at.least(25);
        expect(user.is_active).to.be.true;
        expect(user.department_id).to.not.equal(4);
      });
    });

    it("should combine 5 WHERE clauses", async () => {
      const results = await executeSimple(db, () =>
        from(db, "products")
          .where((p) => p.price > 10)
          .where((p) => p.stock > 0)
          .where((p) => p.category !== null)
          .where((p) => p.name !== "")
          .where((p) => p.id < 100),
      );

      expect(results).to.be.an("array");
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
    it("should handle complex conditions with external parameters", async () => {
      const params = {
        minAge: 30,
        maxAge: 50,
        targetDept: 1,
        mustBeActive: true,
      };

      const results = await execute(
        db,
        (p) =>
          from(db, "users").where(
            (u) =>
              u.age >= p.minAge &&
              u.age <= p.maxAge &&
              (u.department_id === p.targetDept || u.is_active === p.mustBeActive),
          ),
        params,
      );

      expect(results).to.be.an("array");
      results.forEach((user) => {
        expect(user.age).to.be.at.least(params.minAge);
        expect(user.age).to.be.at.most(params.maxAge);
        expect(user.department_id === params.targetDept || user.is_active === params.mustBeActive)
          .to.be.true;
      });
    });

    it("should mix parameters with auto-parameterized constants", async () => {
      const params = { threshold: 100 };

      const results = await execute(
        db,
        (p) =>
          from(db, "products").where(
            (prod) =>
              prod.price > p.threshold && prod.stock > 50 && prod.category === "Electronics",
          ),
        params,
      );

      expect(results).to.be.an("array");
      results.forEach((product) => {
        expect(product.price).to.be.greaterThan(params.threshold);
        expect(product.stock).to.be.greaterThan(50);
        expect(product.category).to.equal("Electronics");
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle very long condition chains", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users").where(
          (u) =>
            u.id > 0 &&
            u.id < 1000 &&
            u.name !== "" &&
            u.email !== "" &&
            u.age > 0 &&
            u.age < 200 &&
            (u.is_active === true || u.is_active === false) &&
            u.department_id >= 1 &&
            u.department_id <= 10,
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
    });

    it("should handle conditions with all comparison operators", async () => {
      const results = await executeSimple(db, () =>
        from(db, "products").where(
          (p) =>
            p.id === p.id && // equality
            p.price !== 0 && // inequality
            p.stock > 0 && // greater than
            p.stock >= 1 && // greater than or equal
            p.price < 10000 && // less than
            p.price <= 9999.99, // less than or equal
        ),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.equal(10); // All products match
    });

    it("should handle boolean field comparisons", async () => {
      const activeResults = await executeSimple(db, () =>
        from(db, "users").where((u) => u.is_active),
      );

      const inactiveResults = await executeSimple(db, () =>
        from(db, "users").where((u) => !u.is_active),
      );

      expect(activeResults).to.be.an("array");
      expect(inactiveResults).to.be.an("array");
      expect(activeResults.length + inactiveResults.length).to.equal(10);
    });
  });
});
