/**
 * Tests for auto-parameterization feature
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import { getOperation } from "./test-utils/operation-helpers.js";

describe("Auto-Parameterization", () => {
  describe("Numeric literals", () => {
    it("should auto-parameterize numeric constants in comparisons", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age >= 18);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _age1: 18 });
      expect(getOperation(result)).to.not.be.null;
    });

    it("should handle multiple numeric constants with same column", () => {
      const query = () =>
        from<{ age: number }>("users")
          .where((x) => x.age >= 18)
          .where((x) => x.age <= 65);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _age1: 18, _age2: 65 });
    });

    it("should auto-parameterize in take operations", () => {
      const query = () => from<{ id: number }>("users").take(10);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _limit1: 10 });
    });

    it("should auto-parameterize in skip operations", () => {
      const query = () => from<{ id: number }>("users").skip(20);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _offset1: 20 });
    });

    it("should handle both skip and take", () => {
      const query = () => from<{ id: number }>("users").skip(10).take(25);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _offset1: 10, _limit1: 25 });
    });
  });

  describe("String literals", () => {
    it("should auto-parameterize string constants", () => {
      const query = () => from<{ name: string }>("users").where((x) => x.name == "John");
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _name1: "John" });
    });

    it("should handle multiple string constants with same column", () => {
      const query = () =>
        from<{ role: string }>("users").where((x) => x.role == "admin" || x.role == "moderator");
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _role1: "admin", _role2: "moderator" });
    });

    it("should handle string constants with different columns", () => {
      const query = () =>
        from<{ firstName: string; lastName: string }>("users").where(
          (x) => x.firstName == "John" && x.lastName == "Doe",
        );
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _firstName1: "John", _lastName1: "Doe" });
    });
  });

  describe("Boolean literals", () => {
    it("should auto-parameterize boolean constants", () => {
      const query = () => from<{ isActive: boolean }>("users").where((x) => x.isActive == true);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _isActive1: true });
    });

    it("should handle false values", () => {
      const query = () => from<{ isDeleted: boolean }>("users").where((x) => x.isDeleted == false);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _isDeleted1: false });
    });
  });

  describe("Null literals", () => {
    it("should NOT auto-parameterize null constants (for IS NULL generation)", () => {
      const query = () => from<{ email: string | null }>("users").where((x) => x.email == null);
      const result = parseQuery(query);

      // Null should not be parameterized - it becomes a ConstantExpression for IS NULL
      expect(result?.autoParams).to.deep.equal({});
    });

    it("should handle null check with != operator", () => {
      const query = () => from<{ phone: string | null }>("users").where((x) => x.phone != null);
      const result = parseQuery(query);

      // Null should not be parameterized - it becomes a ConstantExpression for IS NOT NULL
      expect(result?.autoParams).to.deep.equal({});
    });
  });

  describe("Complex queries", () => {
    it("should handle multiple different types of literals", () => {
      const query = () =>
        from<{ age: number; name: string; isActive: boolean; email: string | null }>("users").where(
          (x) => x.age >= 18 && x.name == "John" && x.isActive == true && x.email != null,
        );
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({
        _age1: 18,
        _name1: "John",
        _isActive1: true,
        // Note: null is NOT parameterized (for IS NOT NULL generation)
      });
    });

    it("should handle literals in arithmetic expressions", () => {
      const query = () =>
        from<{ price: number; tax: number }>("products").where((x) => x.price + 10 > 100);
      const result = parseQuery(query);

      // Both 10 and 100 should be parameterized
      // The 10 gets column hint from price (left side of +)
      // The 100 gets generic "value" since left side is complex arithmetic
      expect(result?.autoParams).to.deep.equal({
        _price1: 10, // Gets hint from price column in x.price + 10
        _value1: 100, // No column hint for comparison with arithmetic expression
      });
    });

    it("should handle pagination with filtering", () => {
      const query = () =>
        from<{ age: number; isActive: boolean }>("users")
          .where((x) => x.age >= 21)
          .where((x) => x.isActive == true)
          .orderBy((x) => x.age)
          .skip(50)
          .take(25);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({
        _age1: 21,
        _isActive1: true,
        _offset1: 50,
        _limit1: 25,
      });
    });
  });

  describe("Column hint logic", () => {
    it("should use column name for hint when comparing with column", () => {
      const query = () => from<{ score: number }>("games").where((x) => x.score > 100);
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({ _score1: 100 });
    });

    it("should use value for constants without column context", () => {
      const query = () => from<{ x: number }>("points").where((x) => 5 < 10);
      const result = parseQuery(query);

      // When there's no column context, use "value" as the base name
      expect(result?.autoParams).to.have.property("_value1", 5);
      expect(result?.autoParams).to.have.property("_value2", 10);
    });

    it("should increment counter for same column", () => {
      const query = () =>
        from<{ status: string }>("orders").where(
          (x) => x.status == "pending" || x.status == "processing" || x.status == "shipped",
        );
      const result = parseQuery(query);

      expect(result?.autoParams).to.deep.equal({
        _status1: "pending",
        _status2: "processing",
        _status3: "shipped",
      });
    });
  });

  describe("External parameters should not be auto-parameterized", () => {
    it("should keep external parameters as-is", () => {
      const query = (p: { minAge: number; maxAge: number }) =>
        from<{ age: number }>("users").where((x) => x.age >= p.minAge && x.age <= p.maxAge);
      const result = parseQuery(query);

      // Should not have any auto-params for external parameters
      expect(result?.autoParams).to.deep.equal({});
    });

    it("should mix external params with auto-parameterized constants", () => {
      const query = (p: { role: string }) =>
        from<{ age: number; role: string; isActive: boolean }>("users").where(
          (x) => x.age >= 18 && x.role == p.role && x.isActive == true,
        );
      const result = parseQuery(query);

      // Only the constants should be auto-parameterized
      expect(result?.autoParams).to.deep.equal({
        _age1: 18,
        _isActive1: true,
      });
    });
  });
});
