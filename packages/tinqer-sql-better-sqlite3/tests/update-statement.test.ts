/**
 * Tests for UPDATE statement generation (SQLite)
 */

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { updateTable } from "@webpods/tinqer";
import { updateStatement } from "../dist/index.js";
import { db } from "./test-schema.js";

describe("UPDATE Statement Generation (SQLite)", () => {
  describe("Basic UPDATE", () => {
    it("should generate UPDATE with WHERE clause using @param format", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ age: 31 })
            .where((u) => u.id === 1),
        {},
      );

      assert.equal(result.sql, `UPDATE "users" SET "age" = @__p1 WHERE "id" = @__p2`);
      assert.deepEqual(result.params, {
        __p1: 31,
        __p2: 1,
      });
    });

    it("should generate UPDATE with multiple columns", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ age: 32, email: "updated@example.com" })
            .where((u) => u.id === 2),
        {},
      );

      assert.equal(
        result.sql,
        `UPDATE "users" SET "age" = @__p1, "email" = @__p2 WHERE "id" = @__p3`,
      );
      assert.deepEqual(result.params, {
        __p1: 32,
        __p2: "updated@example.com",
        __p3: 2,
      });
    });

    it("should generate UPDATE with schema prefix in table name", () => {
      const result = updateStatement(
        () =>
          updateTable<{ id: number; age: number }>("main.users")
            .set({ age: 33 })
            .where((u) => u.id === 3),
        {},
      );

      assert.equal(result.sql, `UPDATE "main"."users" SET "age" = @__p1 WHERE "id" = @__p2`);
    });
  });

  describe("UPDATE with complex WHERE clauses", () => {
    it("should handle AND conditions", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ age: 34 })
            .where((u) => u.id === 4 && u.name === "Alice"),
        {},
      );

      assert.equal(
        result.sql,
        `UPDATE "users" SET "age" = @__p1 WHERE ("id" = @__p2 AND "name" = @__p3)`,
      );
    });

    it("should handle OR conditions", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ isActive: true })
            .where((u) => u.age > 50 || u.department === "Sales"),
        {},
      );

      assert.equal(
        result.sql,
        `UPDATE "users" SET "isActive" = @__p1 WHERE ("age" > @__p2 OR "department" = @__p3)`,
      );
    });

    it("should handle complex nested conditions", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ salary: 75000 })
            .where((u) => (u.age > 30 && u.department === "IT") || u.role === "Manager"),
        {},
      );

      assert.equal(
        result.sql,
        `UPDATE "users" SET "salary" = @__p1 WHERE (("age" > @__p2 AND "department" = @__p3) OR "role" = @__p4)`,
      );
    });
  });

  describe("UPDATE with parameters", () => {
    it("should use external parameters in SET", () => {
      const result = updateStatement(
        (p: { newAge: number; userId: number }) =>
          updateTable(db, "users")
            .set({ age: p.newAge })
            .where((u) => u.id === p.userId),
        { newAge: 35, userId: 5 },
      );

      assert.equal(result.sql, `UPDATE "users" SET "age" = @newAge WHERE "id" = @userId`);
      assert.deepEqual(result.params, {
        newAge: 35,
        userId: 5,
      });
    });

    it("should mix external parameters with literals", () => {
      const result = updateStatement(
        (p: { userId: number }) =>
          updateTable(db, "users")
            .set({ age: 36, email: "fixed@example.com" })
            .where((u) => u.id === p.userId),
        { userId: 6 },
      );

      assert.equal(
        result.sql,
        `UPDATE "users" SET "age" = @__p1, "email" = @__p2 WHERE "id" = @userId`,
      );
      assert.deepEqual(result.params, {
        __p1: 36,
        __p2: "fixed@example.com",
        userId: 6,
      });
    });
  });

  describe("UPDATE with RETURNING", () => {
    it("should generate UPDATE with RETURNING single column", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ age: 37 })
            .where((u) => u.id === 7)
            .returning((u) => u.age),
        {},
      );

      assert.equal(
        result.sql,
        `UPDATE "users" SET "age" = @__p1 WHERE "id" = @__p2 RETURNING "age"`,
      );
    });

    it("should generate UPDATE with RETURNING multiple columns", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ age: 38, email: "new@example.com" })
            .where((u) => u.id === 8)
            .returning((u) => ({ id: u.id, age: u.age, email: u.email })),
        {},
      );

      assert.equal(
        result.sql,
        `UPDATE "users" SET "age" = @__p1, "email" = @__p2 WHERE "id" = @__p3 RETURNING "id" AS "id", "age" AS "age", "email" AS "email"`,
      );
    });

    it("should generate UPDATE with RETURNING all columns (*)", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ age: 39 })
            .where((u) => u.id === 9)
            .returning((u) => u),
        {},
      );

      assert.equal(result.sql, `UPDATE "users" SET "age" = @__p1 WHERE "id" = @__p2 RETURNING *`);
    });
  });

  describe("UPDATE with allowFullTableUpdate", () => {
    it("should generate UPDATE without WHERE when allowed", () => {
      const result = updateStatement(
        () => updateTable(db, "users").set({ isActive: true }).allowFullTableUpdate(),
        {},
      );

      assert.equal(result.sql, `UPDATE "users" SET "isActive" = @__p1`);
    });

    it("should throw error when UPDATE has no WHERE and no allow flag", () => {
      assert.throws(() => {
        updateStatement(() => updateTable(db, "users").set({ isActive: true }), {});
      }, /UPDATE requires a WHERE clause or explicit allowFullTableUpdate/);
    });
  });

  describe("UPDATE with special values", () => {
    it("should handle boolean values (will be converted to 1/0 at execution time)", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ isActive: false })
            .where((u) => u.id === 10),
        {},
      );

      assert.deepEqual(result.params, {
        __p1: false, // Converted to 0 at execution time
        __p2: 10,
      });
    });

    it("should handle null values", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ email: null })
            .where((u) => u.id === 11),
        {},
      );

      assert.equal(result.sql, `UPDATE "users" SET "email" = NULL WHERE "id" = @__p1`);
    });

    it("should handle numeric edge cases", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ age: 0, salary: -500 })
            .where((u) => u.id === 12),
        {},
      );

      assert.deepEqual(result.params, {
        __p1: 0,
        __p2: -500,
        __p3: 12,
      });
    });
  });

  describe("UPDATE with string operations in WHERE", () => {
    it("should handle startsWith in WHERE", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ department: "Engineering" })
            .where((u) => u.name.startsWith("A")),
        {},
      );

      assert.equal(
        result.sql,
        `UPDATE "users" SET "department" = @__p1 WHERE "name" LIKE @__p2 || '%'`,
      );
    });

    it("should handle contains in WHERE", () => {
      const result = updateStatement(
        () =>
          updateTable(db, "users")
            .set({ role: "Senior" })
            .where((u) => u.email !== null && u.email.includes("@company.com")),
        {},
      );

      assert.equal(
        result.sql,
        `UPDATE "users" SET "role" = @__p1 WHERE ("email" IS NOT NULL AND "email" LIKE '%' || @__p2 || '%')`,
      );
    });
  });
});
