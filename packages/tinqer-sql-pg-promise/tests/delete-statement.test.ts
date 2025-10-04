/**
 * Tests for DELETE statement generation
 */

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { deleteFrom } from "@webpods/tinqer";
import { deleteStatement } from "../dist/index.js";
import { db } from "./test-schema.js";

describe("DELETE Statement Generation", () => {
  describe("Basic DELETE", () => {
    it("should generate DELETE with simple WHERE clause", () => {
      const result = deleteStatement(() => deleteFrom(db, "users").where((u) => u.id === 1), {});

      assert.equal(result.sql, `DELETE FROM "users" WHERE "id" = $(__p1)`);
      assert.deepEqual(result.params, {
        __p1: 1,
      });
    });

    it("should generate DELETE with schema prefix in table name", () => {
      const result = deleteStatement(
        () => deleteFrom<{ id: number; name: string }>("public.users").where((u) => u.id === 2),
        {},
      );

      assert.equal(result.sql, `DELETE FROM "public"."users" WHERE "id" = $(__p1)`);
    });
  });

  describe("DELETE with complex WHERE clauses", () => {
    it("should handle AND conditions", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => u.id === 3 && u.isDeleted === true),
        {},
      );

      assert.equal(
        result.sql,
        `DELETE FROM "users" WHERE ("id" = $(__p1) AND "isDeleted" = $(__p2))`,
      );
      assert.deepEqual(result.params, {
        __p1: 3,
        __p2: true,
      });
    });

    it("should handle OR conditions", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => u.age > 100 || u.isDeleted === true),
        {},
      );

      assert.equal(
        result.sql,
        `DELETE FROM "users" WHERE ("age" > $(__p1) OR "isDeleted" = $(__p2))`,
      );
    });

    it("should handle complex nested conditions", () => {
      const result = deleteStatement(
        () =>
          deleteFrom(db, "users").where(
            (u) => (u.age < 18 && u.role !== "Admin") || u.isDeleted === true,
          ),
        {},
      );

      assert.equal(
        result.sql,
        `DELETE FROM "users" WHERE (("age" < $(__p1) AND "role" != $(__p2)) OR "isDeleted" = $(__p3))`,
      );
    });

    it("should handle NOT conditions", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => !(u.isActive === true)),
        {},
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE NOT ("isActive" = $(__p1))`);
    });
  });

  describe("DELETE with parameters", () => {
    it("should use external parameters", () => {
      const result = deleteStatement(
        (p: { userId: number }) => deleteFrom(db, "users").where((u) => u.id === p.userId),
        { userId: 4 },
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE "id" = $(userId)`);
      assert.deepEqual(result.params, {
        userId: 4,
      });
    });

    it("should mix external parameters with literals", () => {
      const result = deleteStatement(
        (p: { minAge: number }) =>
          deleteFrom(db, "users").where((u) => u.age > p.minAge && u.department === "Old"),
        { minAge: 65 },
      );

      assert.equal(
        result.sql,
        `DELETE FROM "users" WHERE ("age" > $(minAge) AND "department" = $(__p1))`,
      );
      assert.deepEqual(result.params, {
        minAge: 65,
        __p1: "Old",
      });
    });
  });

  describe("DELETE with allowFullTableDelete", () => {
    it("should generate DELETE without WHERE when allowed", () => {
      const result = deleteStatement(() => deleteFrom(db, "users").allowFullTableDelete(), {});

      assert.equal(result.sql, `DELETE FROM "users"`);
      assert.deepEqual(result.params, {});
    });

    it("should throw error when DELETE has no WHERE and no allow flag", () => {
      assert.throws(() => {
        deleteStatement(() => deleteFrom(db, "users"), {});
      }, /DELETE requires a WHERE clause or explicit allowFullTableDelete/);
    });
  });

  describe("DELETE with comparison operators", () => {
    it("should handle greater than", () => {
      const result = deleteStatement(() => deleteFrom(db, "users").where((u) => u.age > 50), {});

      assert.equal(result.sql, `DELETE FROM "users" WHERE "age" > $(__p1)`);
    });

    it("should handle less than or equal", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => u.salary <= 30000),
        {},
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE "salary" <= $(__p1)`);
    });

    it("should handle not equal", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => u.role !== "Admin"),
        {},
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE "role" != $(__p1)`);
    });
  });

  describe("DELETE with NULL checks", () => {
    it("should handle IS NULL", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => u.email === null),
        {},
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE "email" IS NULL`);
      assert.deepEqual(result.params, {});
    });

    it("should handle IS NOT NULL", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => u.email !== null),
        {},
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE "email" IS NOT NULL`);
      assert.deepEqual(result.params, {});
    });

    it("should handle NULL with AND conditions", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => u.email === null && u.phone === null),
        {},
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE ("email" IS NULL AND "phone" IS NULL)`);
    });
  });

  describe("DELETE with string operations", () => {
    it("should handle startsWith", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => u.name.startsWith("Test")),
        {},
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE "name" LIKE $(__p1) || '%'`);
      assert.deepEqual(result.params, {
        __p1: "Test",
      });
    });

    it("should handle endsWith", () => {
      const result = deleteStatement(
        () =>
          deleteFrom(db, "users").where((u) => u.email !== null && u.email.endsWith("@temp.com")),
        {},
      );

      assert.equal(
        result.sql,
        `DELETE FROM "users" WHERE ("email" IS NOT NULL AND "email" LIKE '%' || $(__p1))`,
      );
    });

    it("should handle contains", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => u.name.includes("Spam")),
        {},
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE "name" LIKE '%' || $(__p1) || '%'`);
    });
  });

  describe("DELETE with IN operations", () => {
    it("should handle array includes", () => {
      const result = deleteStatement(
        () => deleteFrom(db, "users").where((u) => [1, 2, 3].includes(u.id)),
        {},
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE "id" IN ($(__p1), $(__p2), $(__p3))`);
      assert.deepEqual(result.params, {
        __p1: 1,
        __p2: 2,
        __p3: 3,
      });
    });

    it("should handle parameterized array includes", () => {
      const result = deleteStatement(
        (p: { ids: number[] }) => deleteFrom(db, "users").where((u) => p.ids.includes(u.id)),
        { ids: [4, 5, 6] },
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE "id" IN ($(ids_0), $(ids_1), $(ids_2))`);
      assert.deepEqual(result.params, {
        ids: [4, 5, 6],
        ids_0: 4,
        ids_1: 5,
        ids_2: 6,
      });
    });
  });

  describe("DELETE with date comparisons", () => {
    it("should handle date parameters", () => {
      const result = deleteStatement(
        (p: { cutoffDate: Date }) =>
          deleteFrom(db, "users").where((u) => u.createdAt < p.cutoffDate),
        { cutoffDate: new Date("2020-01-01") },
      );

      assert.equal(result.sql, `DELETE FROM "users" WHERE "createdAt" < $(cutoffDate)`);
      assert.ok(result.params.cutoffDate instanceof Date);
    });
  });
});
