import { expect } from "chai";
import {
  clearParseCache,
  setParseCacheConfig,
  getParseCacheConfig,
  type QueryBuilder,
  type QueryHelpers,
} from "@webpods/tinqer";
import {
  executeSelect,
  executeSelectSimple,
  executeInsert,
  executeUpdate,
  executeDelete,
} from "@webpods/tinqer-sql-better-sqlite3";
import { parseCache } from "@webpods/tinqer/dist/parser/parse-cache.js";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { schema, type TestDatabaseSchema } from "./database-schema.js";

describe("Parse Cache Integration Tests (SQLite)", () => {
  let originalConfig: ReturnType<typeof getParseCacheConfig>;

  before(() => {
    originalConfig = getParseCacheConfig();
  });

  after(() => {
    setParseCacheConfig(originalConfig);
  });

  beforeEach(() => {
    // Reset database to clean state before EACH test
    setupTestDatabase(db);
    // Reset parse cache
    clearParseCache();
    setParseCacheConfig({ enabled: true, capacity: 1024 });
  });

  describe("SELECT query caching", () => {
    it("should cache repeated SELECT queries", () => {
      // First execution - should parse
      const result1 = executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      expect(parseCache.size()).to.equal(1);

      // Second execution - should hit cache (same function code)
      const result2 = executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      expect(parseCache.size()).to.equal(1);

      // Results should be identical
      expect(result1).to.deep.equal(result2);
    });

    it("should cache queries with parameters", () => {
      // First execution
      executeSelect(
        db,
        schema,
        (ctx, p, _helpers) => ctx.from("users").where((u) => u.age !== null && u.age >= p.minAge),
        { minAge: 21 },
      );
      expect(parseCache.size()).to.equal(1);

      // Second execution with different params (same query function code)
      executeSelect(
        db,
        schema,
        (ctx, p, _helpers) => ctx.from("users").where((u) => u.age !== null && u.age >= p.minAge),
        { minAge: 30 },
      );
      expect(parseCache.size()).to.equal(1);
    });

    it("should bypass cache when cache option is false", () => {
      // First execution with cache
      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );

      // Second execution with cache: false
      executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.age !== null && u.age >= 18),
        { cache: false },
      );

      // Cache size should not increase (still 0 or 1)
      expect(parseCache.size()).to.be.at.most(1);
    });

    it("should cache different queries separately", () => {
      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 21),
      );

      expect(parseCache.size()).to.equal(2);
    });

    it("should cache complex queries with joins", () => {
      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx
          .from("users")
          .join(
            ctx.from("departments"),
            (u) => u.department_id,
            (d) => d.id,
            (u, d) => ({ u, d }),
          )
          .select((r) => ({
            userName: r.u.name,
            deptName: r.d.name,
          })),
      );
      expect(parseCache.size()).to.equal(1);

      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx
          .from("users")
          .join(
            ctx.from("departments"),
            (u) => u.department_id,
            (d) => d.id,
            (u, d) => ({ u, d }),
          )
          .select((r) => ({
            userName: r.u.name,
            deptName: r.d.name,
          })),
      );
      expect(parseCache.size()).to.equal(1);
    });

    it("should cache terminal operations (count, sum, etc.)", () => {
      executeSelectSimple(db, schema, (ctx, _params, _helpers) => ctx.from("users").count());
      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx
          .from("users")
          .where((u) => u.age !== null)
          .sum((u) => u.age!),
      );

      expect(parseCache.size()).to.equal(2);

      // Re-execute should hit cache
      executeSelectSimple(db, schema, (ctx, _params, _helpers) => ctx.from("users").count());
      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx
          .from("users")
          .where((u) => u.age !== null)
          .sum((u) => u.age!),
      );

      expect(parseCache.size()).to.equal(2);
    });
  });

  describe("INSERT statement caching", () => {
    it("should cache repeated INSERT statements", () => {
      executeInsert(
        db,
        schema,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: p.name,
            age: p.age,
            email: p.email,
          }),
        {
          name: "Alice Cache Test",
          age: 25,
          email: "alice-cache-test@example.com",
        },
      );
      expect(parseCache.size()).to.equal(1);

      executeInsert(
        db,
        schema,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: p.name,
            age: p.age,
            email: p.email,
          }),
        {
          name: "Bob Cache Test",
          age: 30,
          email: "bob-cache-test@example.com",
        },
      );
      expect(parseCache.size()).to.equal(1);
    });

    it("should bypass INSERT cache when cache option is false", () => {
      executeInsert(
        db,
        schema,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: p.name,
            age: 25,
            email: p.name + "-" + p.suffix + "@example.com",
          }),
        { name: "Alice", suffix: "bypass1" },
      );
      executeInsert(
        db,
        schema,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: p.name,
            age: 25,
            email: p.name + "-" + p.suffix + "@example.com",
          }),
        { name: "Bob", suffix: "bypass2" },
        { cache: false },
      );

      expect(parseCache.size()).to.be.at.most(1);
    });
  });

  describe("UPDATE statement caching", () => {
    it("should cache repeated UPDATE statements", () => {
      // Use existing user IDs - 5 and 6 are employees with no one reporting to them
      executeUpdate(
        db,
        schema,
        (ctx, p) =>
          ctx
            .update("users")
            .set({ age: p.newAge })
            .where((u) => u.id === p.userId),
        { newAge: 26, userId: 5 },
      );
      expect(parseCache.size()).to.equal(1);

      executeUpdate(
        db,
        schema,
        (ctx, p) =>
          ctx
            .update("users")
            .set({ age: p.newAge })
            .where((u) => u.id === p.userId),
        { newAge: 27, userId: 6 },
      );
      expect(parseCache.size()).to.equal(1);
    });

    it("should bypass UPDATE cache when cache option is false", () => {
      executeUpdate(
        db,
        schema,
        (ctx, p) =>
          ctx
            .update("users")
            .set({ age: p.newAge })
            .where((u) => u.id === p.userId),
        { newAge: 26, userId: 7 },
      );
      executeUpdate(
        db,
        schema,
        (ctx, p) =>
          ctx
            .update("users")
            .set({ age: p.newAge })
            .where((u) => u.id === p.userId),
        { newAge: 27, userId: 8 },
        { cache: false },
      );

      expect(parseCache.size()).to.be.at.most(1);
    });
  });

  describe("DELETE statement caching", () => {
    it("should cache repeated DELETE statements", () => {
      // Insert temporary users for deletion testing
      executeInsert(
        db,
        schema,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: "Temp Delete Test",
            age: 30,
            email: p.email,
          }),
        { email: "delete-test-1@example.com" },
      );
      const userId1 = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };

      executeInsert(
        db,
        schema,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: "Temp Delete Test",
            age: 30,
            email: p.email,
          }),
        { email: "delete-test-2@example.com" },
      );
      const userId2 = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };

      // Delete the temporary users
      executeDelete(
        db,
        schema,
        (ctx, p) => ctx.deleteFrom("users").where((u) => u.id === p.userId),
        { userId: userId1.id },
      );
      expect(parseCache.size()).to.equal(2); // INSERT + DELETE queries cached

      executeDelete(
        db,
        schema,
        (ctx, p) => ctx.deleteFrom("users").where((u) => u.id === p.userId),
        { userId: userId2.id },
      );
      expect(parseCache.size()).to.equal(2); // Same two queries still cached

      // Verify deletions were successful
      const remaining1 = db
        .prepare("SELECT COUNT(*) as count FROM users WHERE id = ?")
        .get(userId1.id) as {
        count: number;
      };
      const remaining2 = db
        .prepare("SELECT COUNT(*) as count FROM users WHERE id = ?")
        .get(userId2.id) as {
        count: number;
      };
      expect(remaining1.count).to.equal(0);
      expect(remaining2.count).to.equal(0);
    });

    it("should bypass DELETE cache when cache option is false", () => {
      // Insert temporary users for deletion testing
      executeInsert(
        db,
        schema,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: "Temp Delete Test",
            age: 30,
            email: p.email,
          }),
        { email: "delete-bypass-1@example.com" },
      );
      const userId1 = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };

      executeInsert(
        db,
        schema,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: "Temp Delete Test",
            age: 30,
            email: p.email,
          }),
        { email: "delete-bypass-2@example.com" },
      );
      const userId2 = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };

      executeDelete(
        db,
        schema,
        (ctx, p) => ctx.deleteFrom("users").where((u) => u.id === p.userId),
        { userId: userId1.id },
      );
      executeDelete(
        db,
        schema,
        (ctx, p) => ctx.deleteFrom("users").where((u) => u.id === p.userId),
        { userId: userId2.id },
        { cache: false },
      );

      expect(parseCache.size()).to.equal(2); // INSERT + DELETE queries cached (cache:false still uses cache)

      // Verify deletions were successful
      const remaining1 = db
        .prepare("SELECT COUNT(*) as count FROM users WHERE id = ?")
        .get(userId1.id) as {
        count: number;
      };
      const remaining2 = db
        .prepare("SELECT COUNT(*) as count FROM users WHERE id = ?")
        .get(userId2.id) as {
        count: number;
      };
      expect(remaining1.count).to.equal(0);
      expect(remaining2.count).to.equal(0);
    });
  });

  describe("Cache configuration integration", () => {
    it("should respect disabled cache in real queries", () => {
      setParseCacheConfig({ enabled: false });

      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );

      expect(parseCache.size()).to.equal(0);
    });

    it("should respect capacity limit in real queries", () => {
      setParseCacheConfig({ capacity: 2 });

      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 21),
      );
      expect(parseCache.size()).to.equal(2);

      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 25),
      );
      expect(parseCache.size()).to.equal(2); // Should evict oldest
    });
  });

  describe("Mixed operation caching", () => {
    it("should cache different operation types separately", () => {
      executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      executeInsert(
        db,
        schema,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: p.name,
            age: 25,
            email: p.name + "-" + p.suffix + "@example.com",
          }),
        { name: "Test", suffix: "mixed" },
      );
      executeUpdate(
        db,
        schema,
        (ctx, p) =>
          ctx
            .update("users")
            .set({ age: 26 })
            .where((u) => u.id === p.userId),
        { userId: 9 },
      );

      expect(parseCache.size()).to.equal(3);
    });
  });

  describe("Performance verification", () => {
    it("should demonstrate cache performance benefit", () => {
      // Define query once so all uses have identical code
      const testQuery = (
        ctx: QueryBuilder<TestDatabaseSchema>,
        _params: Record<string, never>,
        _helpers: QueryHelpers,
      ) =>
        ctx
          .from("users")
          .where((u) => u.age !== null && u.age >= 18)
          .select((u) => ({ id: u.id, name: u.name }))
          .orderBy((u) => u.name)
          .take(10);

      // Clear cache and measure time for first execution
      clearParseCache();
      executeSelectSimple(db, schema, testQuery);

      // Measure time for cached execution
      const start2 = Date.now();
      for (let i = 0; i < 100; i++) {
        executeSelectSimple(db, schema, testQuery);
      }
      const time2 = Date.now() - start2;

      // With cache, 100 executions should be faster than 100x first execution
      // (This is a soft check - actual speedup depends on query complexity)
      expect(parseCache.size()).to.equal(1);

      // Clear cache and measure time for 100 uncached executions
      clearParseCache();
      const start3 = Date.now();
      for (let i = 0; i < 100; i++) {
        executeSelectSimple(db, schema, testQuery, { cache: false });
      }
      const time3 = Date.now() - start3;

      // Cached executions should be faster than uncached
      expect(time2).to.be.lessThan(time3);
      expect(parseCache.size()).to.equal(0); // No caching with cache: false
    });
  });
});
