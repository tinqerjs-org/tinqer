/**
 * Tests for auto-parameterization feature
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import { getOperation } from "./test-utils/operation-helpers.js";
import { db } from "./test-schema.js";

describe("Auto-Parameterization", () => {
  describe("Numeric literals", () => {
    it("should auto-parameterize numeric constants in comparisons", () => {
      const query = () => from(db, "users").where((x) => x.age >= 18);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: 18 });
      expect(getOperation(result)).to.not.be.null;
    });

    it("should handle multiple numeric constants with same column", () => {
      const query = () =>
        from(db, "users")
          .where((x) => x.age >= 18)
          .where((x) => x.age <= 65);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: 18, __p2: 65 });
    });

    it("should auto-parameterize in take operations", () => {
      const query = () => from(db, "users").take(10);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: 10 });
    });

    it("should auto-parameterize in skip operations", () => {
      const query = () => from(db, "users").skip(20);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: 20 });
    });

    it("should handle both skip and take", () => {
      const query = () => from(db, "users").skip(10).take(25);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: 10, __p2: 25 });
    });
  });

  describe("String literals", () => {
    it("should auto-parameterize string constants", () => {
      const query = () => from(db, "users").where((x) => x.name == "John");
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: "John" });
    });

    it("should handle multiple string constants with same column", () => {
      const query = () =>
        from(db, "users").where((x) => x.role == "admin" || x.role == "moderator");
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: "admin", __p2: "moderator" });
    });

    it("should handle string constants with different columns", () => {
      const query = () =>
        from(db, "users").where((x) => x.firstName == "John" && x.lastName == "Doe");
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: "John", __p2: "Doe" });
    });
  });

  describe("Boolean literals", () => {
    it("should auto-parameterize boolean constants", () => {
      const query = () => from(db, "users").where((x) => x.isActive == true);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: true });
    });

    it("should handle false values", () => {
      const query = () => from(db, "users").where((x) => x.isDeleted == false);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: false });
    });
  });

  describe("Null literals", () => {
    it("should NOT auto-parameterize null constants (for IS NULL generation)", () => {
      const query = () => from(db, "users").where((x) => x.email == null);
      const result = parseQuery(query);

      // Null should not be parameterized - it becomes a ConstantExpression for IS NULL
      expect(result?.autoParams).to.deep.equal({});
    });

    it("should handle null check with != operator", () => {
      const query = () => from(db, "users").where((x) => x.phone != null);
      const result = parseQuery(query);

      // Null should not be parameterized - it becomes a ConstantExpression for IS NOT NULL
      expect(result?.autoParams).to.deep.equal({});
    });
  });

  describe("Complex queries", () => {
    it("should handle multiple different types of literals", () => {
      const query = () =>
        from(db, "users").where(
          (x) => x.age >= 18 && x.name == "John" && x.isActive == true && x.email != null,
        );
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({
        __p1: 18,
        __p2: "John",
        __p3: true,
        // Note: null is NOT parameterized (for IS NOT NULL generation)
      });
    });

    it("should handle literals in arithmetic expressions", () => {
      const query = () => from(db, "products").where((x) => x.price + 10 > 100);
      const result = parseQuery(query);

      // Both 10 and 100 should be parameterized
      // The 10 gets column hint from price (left side of +)
      // The 100 gets generic "value" since left side is complex arithmetic
      expect(result?.autoParams).to.deep.equal({
        __p1: 10, // First literal encountered (10)
        __p2: 100, // Second literal encountered (100)
      });
    });

    it("should handle pagination with filtering", () => {
      const query = () =>
        from(db, "users")
          .where((x) => x.age >= 21)
          .where((x) => x.isActive == true)
          .orderBy((x) => x.age)
          .skip(50)
          .take(25);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({
        __p1: 21,
        __p2: true,
        __p3: 50,
        __p4: 25,
      });
    });
  });

  describe("Sequential auto-param numbering", () => {
    it("should use sequential numbering regardless of column context", () => {
      const query = () => from(db, "users").where((x) => x.age > 100);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ __p1: 100 });
    });

    it("should use sequential numbering for constants without table context", () => {
      const query = () => from(db, "users").where((_x) => 5 < 10);
      const result = parseQuery(query);

      // Sequential numbering for all auto-params
      expect(result?.autoParams).to.have.property("__p1", 5);
      expect(result?.autoParams).to.have.property("__p2", 10);
    });

    it("should use sequential numbering for multiple literals", () => {
      const query = () =>
        from(db, "orders").where(
          (x) => x.status == "pending" || x.status == "processing" || x.status == "shipped",
        );
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({
        __p1: "pending",
        __p2: "processing",
        __p3: "shipped",
      });
    });
  });

  describe("External parameters should not be auto-parameterized", () => {
    it("should keep external parameters as-is", () => {
      const query = (p: { minAge: number; maxAge: number }) =>
        from(db, "users").where((x) => x.age >= p.minAge && x.age <= p.maxAge);
      const result = parseQuery(query);

      // Should not have any auto-params for external parameters
      expect(result?.autoParams).to.deep.equal({});
    });

    it("should mix external params with auto-parameterized constants", () => {
      const query = (p: { role: string }) =>
        from(db, "users").where((x) => x.age >= 18 && x.role == p.role && x.isActive == true);
      const result = parseQuery(query);

      // Only the constants should be auto-parameterized
      expect(result?.autoParams).to.deep.equal({
        __p1: 18,
        __p2: true,
      });
    });
  });
});
