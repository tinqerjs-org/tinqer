/**
 * Tests for WHERE clause generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

describe("WHERE SQL Generation", () => {
  describe("Comparison operators", () => {
    it("should generate equality comparison", () => {
      const result = query(
        () => from<{ id: number; name: string }>("users").where((x) => x.id == 1),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE id = 1');
    });

    it("should generate greater than comparison", () => {
      const result = query(
        () => from<{ id: number; age: number }>("users").where((x) => x.age > 18),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age > 18');
    });

    it("should generate greater than or equal comparison", () => {
      const result = query(
        () => from<{ id: number; age: number }>("users").where((x) => x.age >= 18),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age >= 18');
    });
  });

  describe("Logical operators", () => {
    it("should generate AND condition", () => {
      const result = query(
        () =>
          from<{ id: number; age: number; isActive: boolean }>("users").where(
            (x) => x.age >= 18 && x.isActive,
          ),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE (age >= 18 AND isActive)');
    });

    it("should generate OR condition", () => {
      const result = query(
        () =>
          from<{ id: number; role: string }>("users").where(
            (x) => x.role == "admin" || x.role == "moderator",
          ),
        {},
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"users\" AS t0 WHERE (role = 'admin' OR role = 'moderator')",
      );
    });
  });

  describe("External parameters", () => {
    it("should handle simple parameter", () => {
      const result = query(
        (p: { minAge: number }) =>
          from<{ id: number; age: number }>("users").where((x) => x.age >= p.minAge),
        { minAge: 18 },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age >= $(minAge)');
      expect(result.params).to.deep.equal({ minAge: 18 });
    });

    it("should handle multiple parameters", () => {
      const result = query(
        (p: { minAge: number; maxAge: number }) =>
          from<{ id: number; age: number }>("users").where(
            (x) => x.age >= p.minAge && x.age <= p.maxAge,
          ),
        { minAge: 18, maxAge: 65 },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE (age >= $(minAge) AND age <= $(maxAge))',
      );
      expect(result.params).to.deep.equal({ minAge: 18, maxAge: 65 });
    });
  });
});
