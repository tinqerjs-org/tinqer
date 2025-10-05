/**
 * Tests for string methods (toLowerCase/toUpperCase) in WHERE clause
 * These tests verify that case transformation methods work correctly in comparisons
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
import { db } from "./test-schema.js";

describe("String methods in WHERE clause", () => {
  describe("toLowerCase", () => {
    it("should handle toLowerCase on column", () => {
      const result = selectStatement(
        db,
        (ctx) => ctx.from("users").where((u) => u.name.toLowerCase() == "john"),
        {},
      );

      expect(result.sql).to.include("LOWER(");
      expect(result.sql).to.match(/WHERE\s+LOWER\("name"\)\s*=\s*\$\(__p\d+\)/);
      expect(result.params).to.have.property("__p1", "john");
    });

    it("should handle toLowerCase with params", () => {
      const result = selectStatement(
        db,
        (ctx, params: { search: string }) =>
          ctx.from("users").where((u) => u.name.toLowerCase() == params.search),
        { search: "john" },
      );

      expect(result.sql).to.include("LOWER(");
      expect(result.sql).to.match(/WHERE\s+LOWER\("name"\)\s*=\s*\$\(search\)/);
      expect(result.params).to.have.property("search", "john");
    });

    it("should handle toLowerCase on both sides", () => {
      const result = selectStatement(
        db,
        (ctx, params: { search: string }) =>
          ctx.from("users").where((u) => u.name.toLowerCase() == params.search.toLowerCase()),
        { search: "JOHN" },
      );

      // Note: params.search.toLowerCase() happens in JavaScript before query
      // So it becomes a literal "john" in the query
      expect(result.sql).to.include("LOWER(");
      expect(result.sql).to.match(/WHERE\s+LOWER\("name"\)/);
    });

    it("should combine toLowerCase with other conditions", () => {
      const result = selectStatement(
        db,
        (ctx, params: { search: string; minAge: number }) =>
          ctx
            .from("users")
            .where((u) => u.name.toLowerCase() == params.search && u.age > params.minAge),
        { search: "john", minAge: 18 },
      );

      expect(result.sql).to.include("LOWER(");
      expect(result.sql).to.include("AND");
      expect(result.sql).to.match(/LOWER\("name"\)\s*=\s*\$\(search\)/);
      expect(result.sql).to.match(/"age"\s*>\s*\$\(minAge\)/);
      expect(result.params).to.have.property("search", "john");
      expect(result.params).to.have.property("minAge", 18);
    });

    it("should work with startsWith and toLowerCase", () => {
      const result = selectStatement(
        db,
        (ctx, params: { prefix: string; minAge: number }) =>
          ctx
            .from("users")
            .where(
              (u) =>
                u.name.toLowerCase().startsWith(params.prefix as string) && u.age >= params.minAge,
            ),
        { prefix: "j", minAge: 21 },
      );

      expect(result.sql).to.include("LOWER(");
      expect(result.sql).to.include("LIKE");
      expect(result.sql).to.match(/LOWER\("name"\)\s+LIKE\s+\$\(prefix\)\s*\|\|\s*'%'/);
      expect(result.params).to.have.property("prefix", "j");
      expect(result.params).to.have.property("minAge", 21);
    });
  });

  describe("toUpperCase", () => {
    it("should handle toUpperCase on column", () => {
      const result = selectStatement(
        db,
        (ctx) => ctx.from("users").where((u) => u.name.toUpperCase() == "JOHN"),
        {},
      );

      expect(result.sql).to.include("UPPER(");
      expect(result.sql).to.match(/WHERE\s+UPPER\("name"\)\s*=\s*\$\(__p\d+\)/);
      expect(result.params).to.have.property("__p1", "JOHN");
    });

    it("should handle toUpperCase with params", () => {
      const result = selectStatement(
        db,
        (ctx, params: { search: string }) =>
          ctx.from("users").where((u) => u.name.toUpperCase() == params.search),
        { search: "JOHN" },
      );

      expect(result.sql).to.include("UPPER(");
      expect(result.sql).to.match(/WHERE\s+UPPER\("name"\)\s*=\s*\$\(search\)/);
      expect(result.params).to.have.property("search", "JOHN");
    });

    it("should combine toUpperCase with other conditions", () => {
      const result = selectStatement(
        db,
        (ctx, params: { category: string; excludeName: string }) =>
          ctx
            .from("products")
            .where(
              (p) => p.category.toUpperCase() == params.category && p.name != params.excludeName,
            ),
        { category: "ELECTRONICS", excludeName: "Phone" },
      );

      expect(result.sql).to.include("UPPER(");
      expect(result.sql).to.include("AND");
      expect(result.sql).to.match(/UPPER\("category"\)\s*=\s*\$\(category\)/);
      expect(result.sql).to.match(/"name"\s*!=\s*\$\(excludeName\)/);
      expect(result.params).to.have.property("category", "ELECTRONICS");
      expect(result.params).to.have.property("excludeName", "Phone");
    });
  });

  describe("Complex scenarios", () => {
    it("should handle nested expressions with toLowerCase", () => {
      const result = selectStatement(
        db,
        (ctx, params: { name1: string; name2: string }) =>
          ctx
            .from("users")
            .where(
              (u) => u.name.toLowerCase() == params.name1 || u.name.toLowerCase() == params.name2,
            ),
        { name1: "john", name2: "jane" },
      );

      expect(result.sql).to.include("LOWER(");
      expect(result.sql).to.include("OR");
      expect(result.sql).to.match(
        /\(LOWER\("name"\)\s*=\s*\$\(name1\)\s+OR\s+LOWER\("name"\)\s*=\s*\$\(name2\)\)/,
      );
      expect(result.params).to.have.property("name1", "john");
      expect(result.params).to.have.property("name2", "jane");
    });

    it("should handle multiple string methods in one query", () => {
      const result = selectStatement(
        db,
        (ctx, params: { searchName: string; searchCategory: string }) =>
          ctx
            .from("products")
            .where(
              (p) =>
                p.name.toLowerCase() == params.searchName &&
                p.category.toUpperCase() == params.searchCategory,
            ),
        { searchName: "laptop", searchCategory: "ELECTRONICS" },
      );

      expect(result.sql).to.include("LOWER(");
      expect(result.sql).to.include("UPPER(");
      expect(result.sql).to.include("AND");
      expect(result.params).to.have.property("searchName", "laptop");
      expect(result.params).to.have.property("searchCategory", "ELECTRONICS");
    });

    it("should handle string methods with NULL coalescing", () => {
      const result = selectStatement(
        db,
        (ctx, params: { defaultName: string; search: string }) =>
          ctx
            .from("users")
            .where((u) => (u.name ?? params.defaultName).toLowerCase() == params.search),
        { defaultName: "Unknown", search: "unknown" },
      );

      expect(result.sql).to.include("COALESCE");
      expect(result.sql).to.include("LOWER(");
      expect(result.sql).to.match(/LOWER\(COALESCE\("name",\s*\$\(defaultName\)\)\)/);
      expect(result.params).to.have.property("defaultName", "Unknown");
      expect(result.params).to.have.property("search", "unknown");
    });
  });

  describe("Error cases", () => {
    it("should throw error for unsupported toString() method", () => {
      // toString() is not supported - this documents the expected behavior
      expect(() =>
        selectStatement(
          db,
          (ctx) => ctx.from("users").where((u) => u.age.toString().toLowerCase() == "25"),
          {},
        ),
      ).to.throw("Failed to parse query");
    });
  });
});
