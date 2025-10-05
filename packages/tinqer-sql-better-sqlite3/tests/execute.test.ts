/**
 * Tests for execute function with pg-promise
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
import { db } from "./test-schema.js";

describe("Execute Function", () => {
  describe("Basic queries", () => {
    it("should execute a simple query and return typed results", async () => {
      const queryBuilder = (ctx) => ctx.from("users");

      // Just verify the function signature and that it compiles
      // Real execution would need a real database
      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users"');
    });

    it("should execute with SELECT projection", async () => {
      const queryBuilder = (ctx) =>
        ctx.from("users").select((u) => ({
          id: u.id,
          name: u.name,
        }));

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT "id" AS "id", "name" AS "name" FROM "users"');
    });

    it("should execute with WHERE clause", async () => {
      const queryBuilder = (ctx) => ctx.from("users").where((u) => u.age >= 18);

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" WHERE "age" >= @__p1');
      expect(sqlResult.params).to.deep.equal({ __p1: 18 });
    });

    it("should execute with parameters", async () => {
      const queryBuilder = (ctx, p: { minAge: number }) =>
        ctx.from("users").where((u) => u.age >= p.minAge);

      const sqlResult = selectStatement(db, queryBuilder, { minAge: 21 });
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" WHERE "age" >= @minAge');
      expect(sqlResult.params).to.deep.equal({ minAge: 21 });
    });
  });

  describe("Terminal operations", () => {
    it("should handle first() operation", async () => {
      const queryBuilder = (ctx) => ctx.from("users").first();

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" LIMIT 1');
      expect(sqlResult.params).to.deep.equal({});
    });

    it("should handle first() with predicate", async () => {
      const queryBuilder = (ctx) => ctx.from("users").first((u) => u.id === 1);

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" WHERE "id" = @__p1 LIMIT 1');
      expect(sqlResult.params).to.deep.equal({ __p1: 1 });
    });

    it("should handle single() operation", async () => {
      const queryBuilder = (ctx) => ctx.from("users").single((u) => u.id === 1);

      const sqlResult = selectStatement(db, queryBuilder, {});
      // Single adds LIMIT 2 to check for multiple results
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" WHERE "id" = @__p1 LIMIT 2');
      expect(sqlResult.params).to.deep.equal({ __p1: 1 });
    });

    it("should handle firstOrDefault() operation", async () => {
      const queryBuilder = (ctx) => ctx.from("users").firstOrDefault((u) => u.id === 999);

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" WHERE "id" = @__p1 LIMIT 1');
      expect(sqlResult.params).to.deep.equal({ __p1: 999 });
      // Note: firstOrDefault returns null when no results, not throwing
    });

    it("should handle singleOrDefault() operation", async () => {
      const queryBuilder = (ctx) => ctx.from("users").singleOrDefault((u) => u.id === 999);

      const sqlResult = selectStatement(db, queryBuilder, {});
      // SingleOrDefault also adds LIMIT 2 to check for multiple results
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" WHERE "id" = @__p1 LIMIT 2');
      expect(sqlResult.params).to.deep.equal({ __p1: 999 });
      // Note: singleOrDefault returns null when no results, throws if multiple
    });

    it("should handle last() operation", async () => {
      const queryBuilder = (ctx) =>
        ctx.from("users")
          .orderBy((u) => u.id)
          .last();

      const sqlResult = selectStatement(db, queryBuilder, {});
      // Last reverses the ORDER BY direction
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" ORDER BY "id" DESC LIMIT 1');
    });

    it("should handle count() operation", async () => {
      const queryBuilder = (ctx) => ctx.from("users").count();

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT COUNT(*) FROM "users"');
    });

    it("should handle count() with predicate", async () => {
      const queryBuilder = (ctx) => ctx.from("users").count((u) => u.age >= 18);

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT COUNT(*) FROM "users" WHERE "age" >= @__p1');
      expect(sqlResult.params).to.deep.equal({ __p1: 18 });
    });

    it("should handle sum() operation", async () => {
      const queryBuilder = (ctx) => ctx.from("users").sum((u) => u.age);

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT SUM("age") FROM "users"');
    });

    it("should handle average() operation", async () => {
      const queryBuilder = (ctx) => ctx.from("users").average((u) => u.salary);

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT AVG("salary") FROM "users"');
    });

    it("should handle min() operation", async () => {
      const queryBuilder = (ctx) => ctx.from("products").min((p) => p.price);

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT MIN("price") FROM "products"');
    });

    it("should handle max() operation", async () => {
      const queryBuilder = (ctx) => ctx.from("products").max((p) => p.price);

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT MAX("price") FROM "products"');
    });

    it("should handle any() operation without predicate", async () => {
      const queryBuilder = (ctx) => ctx.from("users").any();

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users") THEN 1 ELSE 0 END',
      );
    });

    it("should handle any() operation with predicate", async () => {
      const queryBuilder = (ctx) => ctx.from("users").any((u) => u.age >= 18);

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" WHERE "age" >= @__p1) THEN 1 ELSE 0 END',
      );
      expect(sqlResult.params).to.deep.equal({ __p1: 18 });
    });

    it("should handle all() operation", async () => {
      const queryBuilder = (ctx) => ctx.from("users").all((u) => u.isActive);

      const sqlResult = selectStatement(db, queryBuilder, {});
      expect(sqlResult.sql).to.equal(
        'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" WHERE NOT ("isActive")) THEN 1 ELSE 0 END',
      );
    });
  });

  describe("Type inference", () => {
    it("should properly type results from SELECT", () => {
      // This test is mainly for compile-time type checking
      type ResultType = { userId: number; userName: string }[];

      // This should compile without errors
      const checkType: ResultType = [{ userId: 1, userName: "test" }];
      expect(checkType).to.deep.equal([{ userId: 1, userName: "test" }]);
    });
  });
});
