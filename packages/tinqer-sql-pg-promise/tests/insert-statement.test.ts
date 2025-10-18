/**
 * Tests for INSERT statement generation
 */

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { insertStatement } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("INSERT Statement Generation", () => {
  describe("Basic INSERT", () => {
    it("should generate INSERT with all columns", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q.insertInto("users").values({
            name: "Alice",
            age: 30,
            email: "alice@example.com",
          }),
        {},
      );

      assert.equal(
        result.sql,
        `INSERT INTO "users" ("name", "age", "email") VALUES ($(__p1), $(__p2), $(__p3))`,
      );
      assert.deepEqual(result.params, {
        __p1: "Alice",
        __p2: 30,
        __p3: "alice@example.com",
      });
    });

    it("should generate INSERT with partial columns", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q.insertInto("users").values({
            name: "Bob",
            age: 25,
          }),
        {},
      );

      assert.equal(result.sql, `INSERT INTO "users" ("name", "age") VALUES ($(__p1), $(__p2))`);
      assert.deepEqual(result.params, {
        __p1: "Bob",
        __p2: 25,
      });
    });

    it("should generate INSERT with schema prefix in table name", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q.insertInto("public.users").values({
            name: "Charlie",
            age: 35,
          }),
        {},
      );

      assert.equal(
        result.sql,
        `INSERT INTO "public"."users" ("name", "age") VALUES ($(__p1), $(__p2))`,
      );
    });
  });

  describe("INSERT with parameters", () => {
    it("should use external parameters", () => {
      const result = insertStatement(
        schema,
        (q, p) =>
          q.insertInto("users").values({
            name: p.name,
            age: p.age,
          }),
        { name: "David", age: 40 },
      );

      assert.equal(result.sql, `INSERT INTO "users" ("name", "age") VALUES ($(name), $(age))`);
      assert.deepEqual(result.params, {
        name: "David",
        age: 40,
      });
    });

    it("should mix external parameters with literals", () => {
      const result = insertStatement(
        schema,
        (q, p) =>
          q.insertInto("users").values({
            name: p.name,
            age: 25,
            email: "default@example.com",
          }),
        { name: "Eve" },
      );

      assert.equal(
        result.sql,
        `INSERT INTO "users" ("name", "age", "email") VALUES ($(name), $(__p1), $(__p2))`,
      );
      assert.deepEqual(result.params, {
        name: "Eve",
        __p1: 25,
        __p2: "default@example.com",
      });
    });
  });

  describe("INSERT with optional fields", () => {
    it("should skip columns with undefined parameter values", () => {
      type InsertParams = { name: string; email?: string };
      const result = insertStatement(
        schema,
        (q, p: InsertParams) =>
          q
            .insertInto("users")
            .values({ name: p.name, email: p.email })
            .returning((u) => u.id),
        { name: "Optional User" },
      );

      assert.equal(result.sql, `INSERT INTO "users" ("name") VALUES ($(name)) RETURNING "id"`);
      assert.deepEqual(result.params, { name: "Optional User" });
    });

    it("should throw when all insert values are undefined", () => {
      type InsertParams = { name?: string; email?: string };
      assert.throws(() => {
        insertStatement(
          schema,
          (q, p: InsertParams) => q.insertInto("users").values({ name: p.name, email: p.email }),
          {},
        );
      }, /All provided values were undefined/);
    });
  });

  describe("INSERT with RETURNING", () => {
    it("should generate INSERT with RETURNING single column", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q
            .insertInto("users")
            .values({ name: "Frank", age: 45 })
            .returning((u) => u.id),
        {},
      );

      assert.equal(
        result.sql,
        `INSERT INTO "users" ("name", "age") VALUES ($(__p1), $(__p2)) RETURNING "id"`,
      );
    });

    it("should generate INSERT with RETURNING multiple columns", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q
            .insertInto("users")
            .values({ name: "Grace", age: 50 })
            .returning((u) => ({ id: u.id, name: u.name })),
        {},
      );

      assert.equal(
        result.sql,
        `INSERT INTO "users" ("name", "age") VALUES ($(__p1), $(__p2)) RETURNING "id" AS "id", "name" AS "name"`,
      );
    });

    it("should generate INSERT with RETURNING all columns (*)", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q
            .insertInto("users")
            .values({ name: "Helen", age: 55 })
            .returning((u) => u),
        {},
      );

      assert.equal(
        result.sql,
        `INSERT INTO "users" ("name", "age") VALUES ($(__p1), $(__p2)) RETURNING *`,
      );
    });
  });

  describe("INSERT with special values", () => {
    it("should handle boolean values", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q.insertInto("users").values({
            name: "Ian",
            age: 60,
            isActive: true,
          }),
        {},
      );

      assert.equal(
        result.sql,
        `INSERT INTO "users" ("name", "age", "isActive") VALUES ($(__p1), $(__p2), $(__p3))`,
      );
      assert.deepEqual(result.params, {
        __p1: "Ian",
        __p2: 60,
        __p3: true,
      });
    });

    it("should handle null values", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q.insertInto("users").values({
            name: "Jane",
            age: 65,
            email: null,
          }),
        {},
      );

      assert.equal(
        result.sql,
        `INSERT INTO "users" ("name", "age", "email") VALUES ($(__p1), $(__p2), NULL)`,
      );
      assert.deepEqual(result.params, {
        __p1: "Jane",
        __p2: 65,
      });
    });

    it("should handle numeric edge cases", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q.insertInto("users").values({
            name: "Kevin",
            age: 0,
            salary: -1000,
          }),
        {},
      );

      assert.equal(
        result.sql,
        `INSERT INTO "users" ("name", "age", "salary") VALUES ($(__p1), $(__p2), $(__p3))`,
      );
      assert.deepEqual(result.params, {
        __p1: "Kevin",
        __p2: 0,
        __p3: -1000,
      });
    });
  });

  describe("INSERT with special characters", () => {
    it("should handle strings with quotes", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q.insertInto("users").values({
            name: "O'Brien",
            email: 'test"email@example.com',
          }),
        {},
      );

      assert.equal(result.sql, `INSERT INTO "users" ("name", "email") VALUES ($(__p1), $(__p2))`);
      assert.deepEqual(result.params, {
        __p1: "O'Brien",
        __p2: 'test"email@example.com',
      });
    });

    it("should handle Unicode characters", () => {
      const result = insertStatement(
        schema,
        (q) =>
          q.insertInto("users").values({
            name: "李明",
            email: "test@例え.com",
          }),
        {},
      );

      assert.deepEqual(result.params, {
        __p1: "李明",
        __p2: "test@例え.com",
      });
    });
  });
});
