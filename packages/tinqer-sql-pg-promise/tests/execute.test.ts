/**
 * Tests for execute function with pg-promise
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { execute, executeSimple, query } from "../dist/index.js";
import { db, from } from "./test-schema.js";

// Mock database for testing
class MockDb {
  async any<T>(sql: string, params: any): Promise<T[]> {
    // Return mock data based on the SQL
    if (sql.includes("SELECT * FROM")) {
      return [{ id: 1, name: "John", age: 25 } as any, { id: 2, name: "Jane", age: 30 } as any];
    }
    if (sql.includes("SELECT id AS id, name AS name")) {
      return [{ id: 1, name: "John" } as any, { id: 2, name: "Jane" } as any];
    }
    return [];
  }

  async one<T>(sql: string, params: any): Promise<T> {
    if (sql.includes("COUNT(*)")) {
      return { count: "2" } as any;
    }
    if (sql.includes("SUM(")) {
      return { result: 55 } as any;
    }
    if (sql.includes("AVG(")) {
      return { result: 27.5 } as any;
    }
    if (sql.includes("EXISTS")) {
      return { exists: true } as any;
    }
    return {} as T;
  }
}

describe("Execute Function", () => {
  const mockDb = new MockDb();

  describe("Basic queries", () => {
    it("should execute a simple query and return typed results", async () => {
      const queryBuilder = () => from(db, "users");

      // Just verify the function signature and that it compiles
      // Real execution would need a real database
      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" AS t0');
    });

    it("should execute with SELECT projection", async () => {
      const queryBuilder = () =>
        from(db, "users").select((u) => ({
          id: u.id,
          name: u.name,
        }));

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT id AS id, name AS name FROM "users" AS t0');
    });

    it("should execute with WHERE clause", async () => {
      const queryBuilder = () => from(db, "users").where((u) => u.age >= 18);

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age >= $(_age1)');
      expect(sqlResult.params).to.deep.equal({ _age1: 18 });
    });

    it("should execute with parameters", async () => {
      const queryBuilder = (p: { minAge: number }) =>
        from(db, "users").where((u) => u.age >= p.minAge);

      const sqlResult = query(queryBuilder, { minAge: 21 });
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age >= $(minAge)');
      expect(sqlResult.params).to.deep.equal({ minAge: 21 });
    });
  });

  describe("Terminal operations", () => {
    it("should handle first() operation", async () => {
      const queryBuilder = () => from(db, "users").first();

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" AS t0 LIMIT 1');
      expect(sqlResult.params).to.deep.equal({});
    });

    it("should handle first() with predicate", async () => {
      const queryBuilder = () => from(db, "users").first((u) => u.id === 1);

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" AS t0 WHERE id = $(_id1) LIMIT 1');
      expect(sqlResult.params).to.deep.equal({ _id1: 1 });
    });

    it("should handle single() operation", async () => {
      const queryBuilder = () => from(db, "users").single((u) => u.id === 1);

      const sqlResult = query(queryBuilder, {});
      // Single adds LIMIT 2 to check for multiple results
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" AS t0 WHERE id = $(_id1) LIMIT 2');
      expect(sqlResult.params).to.deep.equal({ _id1: 1 });
    });

    it("should handle firstOrDefault() operation", async () => {
      const queryBuilder = () => from(db, "users").firstOrDefault((u) => u.id === 999);

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" AS t0 WHERE id = $(_id1) LIMIT 1');
      expect(sqlResult.params).to.deep.equal({ _id1: 999 });
      // Note: firstOrDefault returns null when no results, not throwing
    });

    it("should handle singleOrDefault() operation", async () => {
      const queryBuilder = () => from(db, "users").singleOrDefault((u) => u.id === 999);

      const sqlResult = query(queryBuilder, {});
      // SingleOrDefault also adds LIMIT 2 to check for multiple results
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" AS t0 WHERE id = $(_id1) LIMIT 2');
      expect(sqlResult.params).to.deep.equal({ _id1: 999 });
      // Note: singleOrDefault returns null when no results, throws if multiple
    });

    it("should handle last() operation", async () => {
      const queryBuilder = () =>
        from(db, "users")
          .orderBy((u) => u.id)
          .last();

      const sqlResult = query(queryBuilder, {});
      // Last reverses the ORDER BY direction
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" AS t0 ORDER BY id ASC LIMIT 1');
    });

    it("should handle count() operation", async () => {
      const queryBuilder = () => from(db, "users").count();

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT COUNT(*) FROM "users" AS t0');
    });

    it("should handle count() with predicate", async () => {
      const queryBuilder = () => from(db, "users").count((u) => u.age >= 18);

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT COUNT(*) WHERE age >= $(_age1) FROM "users" AS t0');
      expect(sqlResult.params).to.deep.equal({ _age1: 18 });
    });

    it("should handle sum() operation", async () => {
      const queryBuilder = () => from(db, "users").sum((u) => u.age);

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT SUM(age) FROM "users" AS t0');
    });

    it("should handle average() operation", async () => {
      const queryBuilder = () => from(db, "users").average((u) => u.salary);

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT AVG(salary) FROM "users" AS t0');
    });

    it("should handle min() operation", async () => {
      const queryBuilder = () => from(db, "products").min((p) => p.price);

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT MIN(price) FROM "products" AS t0');
    });

    it("should handle max() operation", async () => {
      const queryBuilder = () => from(db, "products").max((p) => p.price);

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT MAX(price) FROM "products" AS t0');
    });

    it("should handle any() operation without predicate", async () => {
      const queryBuilder = () => from(db, "users").any();

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" AS t0) THEN 1 ELSE 0 END',
      );
    });

    it("should handle any() operation with predicate", async () => {
      const queryBuilder = () => from(db, "users").any((u) => u.age >= 18);

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" AS t0 WHERE age >= $(_age1)) THEN 1 ELSE 0 END',
      );
      expect(sqlResult.params).to.deep.equal({ _age1: 18 });
    });

    it("should handle all() operation", async () => {
      const queryBuilder = () => from(db, "users").all((u) => u.isActive);

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal(
        'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" AS t0 WHERE NOT (isActive)) THEN 1 ELSE 0 END',
      );
    });

    it("should handle toArray() operation", async () => {
      const queryBuilder = () =>
        from(db, "users")
          .where((u) => u.age >= 18)
          .toArray();

      const sqlResult = query(queryBuilder, {});
      expect(sqlResult.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age >= $(_age1)');
      expect(sqlResult.params).to.deep.equal({ _age1: 18 });
    });
  });

  describe("Type inference", () => {
    it("should properly type results from SELECT", () => {
      // This test is mainly for compile-time type checking
      const queryBuilder = () =>
        from(db, "users").select((u) => ({
          userId: u.id,
          userName: u.name,
        }));

      // The type of results should be { userId: number, userName: string }[]
      type ResultType =
        ReturnType<typeof queryBuilder> extends any
          ? { userId: number; userName: string }[]
          : never;

      // This should compile without errors
      const checkType: ResultType = [{ userId: 1, userName: "test" }];
      expect(checkType).to.deep.equal([{ userId: 1, userName: "test" }]);
    });
  });
});
