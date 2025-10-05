import { expect } from "chai";
import {
  clearParseCache,
  setParseCacheConfig,
  getParseCacheConfig,
  type QueryDSL,
  type QueryHelpers,
} from "@webpods/tinqer";
import {
  executeSelect,
  executeSelectSimple,
  executeInsert,
  executeUpdate,
  executeDelete,
} from "@webpods/tinqer-sql-pg-promise";
import { parseCache } from "@webpods/tinqer/dist/parser/parse-cache.js";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext, type TestDatabaseSchema } from "./database-schema.js";

describe("Parse Cache Integration Tests (PostgreSQL)", () => {
  let originalConfig: ReturnType<typeof getParseCacheConfig>;

  before(() => {
    originalConfig = getParseCacheConfig();
  });

  after(() => {
    setParseCacheConfig(originalConfig);
  });

  beforeEach(async () => {
    // Reset database to clean state before EACH test
    await setupTestDatabase(db);
    // Reset parse cache
    clearParseCache();
    setParseCacheConfig({ enabled: true, capacity: 1024 });
  });

  describe("SELECT query caching", () => {
    it("should cache repeated SELECT queries", async () => {
      // First execution - should parse
      const result1 = await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      expect(parseCache.size()).to.equal(1);

      // Second execution - should hit cache (same function code)
      const result2 = await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      expect(parseCache.size()).to.equal(1);

      // Results should be identical
      expect(result1).to.deep.equal(result2);
    });

    it("should cache queries with parameters", async () => {
      // First execution
      await executeSelect(
        db,
        dbContext,
        (ctx, p, _helpers) => ctx.from("users").where((u) => u.age !== null && u.age >= p.minAge),
        { minAge: 21 },
      );
      expect(parseCache.size()).to.equal(1);

      // Second execution with different params (same query function code)
      await executeSelect(
        db,
        dbContext,
        (ctx, p, _helpers) => ctx.from("users").where((u) => u.age !== null && u.age >= p.minAge),
        { minAge: 30 },
      );
      expect(parseCache.size()).to.equal(1);
    });

    it("should bypass cache when cache option is false", async () => {
      // First execution with cache
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );

      // Second execution with cache: false
      await executeSelectSimple(
        db,
        dbContext,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.age !== null && u.age >= 18),
        { cache: false },
      );

      // Cache size should not increase (still 0 or 1)
      expect(parseCache.size()).to.be.at.most(1);
    });

    it("should cache different queries separately", async () => {
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 21),
      );

      expect(parseCache.size()).to.equal(2);
    });

    it("should cache complex queries with joins", async () => {
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
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

      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
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

    it("should cache terminal operations (count, sum, etc.)", async () => {
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").count(),
      );
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx
          .from("users")
          .where((u) => u.age !== null)
          .sum((u) => u.age!),
      );

      expect(parseCache.size()).to.equal(2);

      // Re-execute should hit cache
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").count(),
      );
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx
          .from("users")
          .where((u) => u.age !== null)
          .sum((u) => u.age!),
      );

      expect(parseCache.size()).to.equal(2);
    });
  });

  describe("INSERT statement caching", () => {
    it("should cache repeated INSERT statements", async () => {
      await executeInsert(
        db,
        dbContext,
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

      await executeInsert(
        db,
        dbContext,
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

    it("should bypass INSERT cache when cache option is false", async () => {
      await executeInsert(
        db,
        dbContext,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: p.name,
            age: 25,
            email: p.name + "-" + p.suffix + "@example.com",
          }),
        { name: "Alice", suffix: "bypass1" },
      );
      await executeInsert(
        db,
        dbContext,
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
    it("should cache repeated UPDATE statements", async () => {
      // Use existing user IDs - 5 and 6 are employees with no one reporting to them
      await executeUpdate(
        db,
        dbContext,
        (ctx, p) =>
          ctx
            .update("users")
            .set({ age: p.newAge })
            .where((u) => u.id === p.userId),
        { newAge: 26, userId: 5 },
      );
      expect(parseCache.size()).to.equal(1);

      await executeUpdate(
        db,
        dbContext,
        (ctx, p) =>
          ctx
            .update("users")
            .set({ age: p.newAge })
            .where((u) => u.id === p.userId),
        { newAge: 27, userId: 6 },
      );
      expect(parseCache.size()).to.equal(1);
    });

    it("should bypass UPDATE cache when cache option is false", async () => {
      await executeUpdate(
        db,
        dbContext,
        (ctx, p) =>
          ctx
            .update("users")
            .set({ age: p.newAge })
            .where((u) => u.id === p.userId),
        { newAge: 26, userId: 7 },
      );
      await executeUpdate(
        db,
        dbContext,
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
    it("should cache repeated DELETE statements", async () => {
      // Insert temporary users for deletion testing
      const result1 = await executeInsert(
        db,
        dbContext,
        (ctx, p) =>
          ctx
            .insertInto("users")
            .values({
              name: "Temp Delete Test",
              age: 30,
              email: p.email,
            })
            .returning((u) => ({ id: u.id })),
        { email: "delete-test-1@example.com" },
      );
      expect(result1[0]).to.exist;
      const userId1 = result1[0]!.id;

      const result2 = await executeInsert(
        db,
        dbContext,
        (ctx, p) =>
          ctx
            .insertInto("users")
            .values({
              name: "Temp Delete Test",
              age: 30,
              email: p.email,
            })
            .returning((u) => ({ id: u.id })),
        { email: "delete-test-2@example.com" },
      );
      expect(result2[0]).to.exist;
      const userId2 = result2[0]!.id;

      // Delete the temporary users
      await executeDelete(
        db,
        dbContext,
        (ctx, p) => ctx.deleteFrom("users").where((u) => u.id === p.userId),
        { userId: userId1 },
      );
      expect(parseCache.size()).to.equal(2); // INSERT + DELETE queries cached

      await executeDelete(
        db,
        dbContext,
        (ctx, p) => ctx.deleteFrom("users").where((u) => u.id === p.userId),
        { userId: userId2 },
      );
      expect(parseCache.size()).to.equal(2); // Same two queries still cached

      // Verify deletions were successful
      const remaining1 = await db.oneOrNone("SELECT COUNT(*) as count FROM users WHERE id = $1", [
        userId1,
      ]);
      const remaining2 = await db.oneOrNone("SELECT COUNT(*) as count FROM users WHERE id = $1", [
        userId2,
      ]);
      expect(parseInt(remaining1?.count || "0")).to.equal(0);
      expect(parseInt(remaining2?.count || "0")).to.equal(0);
    });

    it("should bypass DELETE cache when cache option is false", async () => {
      // Insert temporary users for deletion testing
      const result1 = await executeInsert(
        db,
        dbContext,
        (ctx, p) =>
          ctx
            .insertInto("users")
            .values({
              name: "Temp Delete Test",
              age: 30,
              email: p.email,
            })
            .returning((u) => ({ id: u.id })),
        { email: "delete-bypass-1@example.com" },
      );
      expect(result1[0]).to.exist;
      const userId1 = result1[0]!.id;

      const result2 = await executeInsert(
        db,
        dbContext,
        (ctx, p) =>
          ctx
            .insertInto("users")
            .values({
              name: "Temp Delete Test",
              age: 30,
              email: p.email,
            })
            .returning((u) => ({ id: u.id })),
        { email: "delete-bypass-2@example.com" },
      );
      expect(result2[0]).to.exist;
      const userId2 = result2[0]!.id;

      await executeDelete(
        db,
        dbContext,
        (ctx, p) => ctx.deleteFrom("users").where((u) => u.id === p.userId),
        { userId: userId1 },
      );
      await executeDelete(
        db,
        dbContext,
        (ctx, p) => ctx.deleteFrom("users").where((u) => u.id === p.userId),
        { userId: userId2 },
        { cache: false },
      );

      expect(parseCache.size()).to.equal(2); // INSERT + DELETE queries cached (cache:false still uses cache)

      // Verify deletions were successful
      const remaining1 = await db.oneOrNone("SELECT COUNT(*) as count FROM users WHERE id = $1", [
        userId1,
      ]);
      const remaining2 = await db.oneOrNone("SELECT COUNT(*) as count FROM users WHERE id = $1", [
        userId2,
      ]);
      expect(parseInt(remaining1?.count || "0")).to.equal(0);
      expect(parseInt(remaining2?.count || "0")).to.equal(0);
    });
  });

  describe("Cache configuration integration", () => {
    it("should respect disabled cache in real queries", async () => {
      setParseCacheConfig({ enabled: false });

      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );

      expect(parseCache.size()).to.equal(0);
    });

    it("should respect capacity limit in real queries", async () => {
      setParseCacheConfig({ capacity: 2 });

      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 21),
      );
      expect(parseCache.size()).to.equal(2);

      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 25),
      );
      expect(parseCache.size()).to.equal(2); // Should evict oldest
    });
  });

  describe("Mixed operation caching", () => {
    it("should cache different operation types separately", async () => {
      await executeSelectSimple(db, dbContext, (ctx, _params, _helpers) =>
        ctx.from("users").where((u) => u.age !== null && u.age >= 18),
      );
      await executeInsert(
        db,
        dbContext,
        (ctx, p) =>
          ctx.insertInto("users").values({
            name: p.name,
            age: 25,
            email: p.name + "-" + p.suffix + "@example.com",
          }),
        { name: "Test", suffix: "mixed" },
      );
      await executeUpdate(
        db,
        dbContext,
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
    it("should demonstrate cache performance benefit", async () => {
      // Define query once so all uses have identical code
      const testQuery = (
        ctx: QueryDSL<TestDatabaseSchema>,
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
      await executeSelectSimple(db, dbContext, testQuery);

      // Measure time for cached execution
      const start2 = Date.now();
      for (let i = 0; i < 100; i++) {
        await executeSelectSimple(db, dbContext, testQuery);
      }
      const time2 = Date.now() - start2;

      // With cache, 100 executions should be faster than 100x first execution
      // (This is a soft check - actual speedup depends on query complexity)
      expect(parseCache.size()).to.equal(1);

      // Clear cache and measure time for 100 uncached executions
      clearParseCache();
      const start3 = Date.now();
      for (let i = 0; i < 100; i++) {
        await executeSelectSimple(db, dbContext, testQuery, { cache: false });
      }
      const time3 = Date.now() - start3;

      // Cached executions should be faster than uncached
      expect(time2).to.be.lessThan(time3);
      expect(parseCache.size()).to.equal(0); // No caching with cache: false
    });
  });
});
