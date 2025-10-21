/**
 * Tests for WHERE clause generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("WHERE SQL Generation", () => {
  describe("Comparison operators", () => {
    it("should generate equality comparison", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((x) => x.id == 1)),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "id" = @__p1');
      expect(result.params).to.deep.equal({ __p1: 1 });
    });

    it("should generate greater than comparison", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((x) => x.age > 18)),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" > @__p1');
      expect(result.params).to.deep.equal({ __p1: 18 });
    });

    it("should generate greater than or equal comparison", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((x) => x.age >= 18)),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" >= @__p1');
      expect(result.params).to.deep.equal({ __p1: 18 });
    });
  });

  describe("Logical operators", () => {
    it("should generate AND condition", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((x) => x.age >= 18 && x.isActive)),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE ("age" >= @__p1 AND "isActive")');
      expect(result.params).to.deep.equal({ __p1: 18 });
    });

    it("should generate OR condition", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q.from("users").where((x) => x.role == "admin" || x.role == "moderator"),
        ),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE ("role" = @__p1 OR "role" = @__p2)');
      expect(result.params).to.deep.equal({ __p1: "admin", __p2: "moderator" });
    });
  });

  describe("External parameters", () => {
    it("should handle simple parameter", () => {
      const result = toSql(
        defineSelect(schema, (q, p: { minAge: number }) =>
          q.from("users").where((x) => x.age >= p.minAge),
        ),
        { minAge: 18 },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" >= @minAge');
      expect(result.params).to.deep.equal({ minAge: 18 });
    });

    it("should handle multiple parameters", () => {
      const result = toSql(
        defineSelect(schema, (q, p: { minAge: number; maxAge: number }) =>
          q.from("users").where((x) => x.age >= p.minAge && x.age <= p.maxAge),
        ),
        { minAge: 18, maxAge: 65 },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("age" >= @minAge AND "age" <= @maxAge)',
      );
      expect(result.params).to.deep.equal({ minAge: 18, maxAge: 65 });
    });
  });

  describe("Multiple WHERE clauses", () => {
    it("should combine two WHERE clauses with AND", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((x) => x.age >= 18)
            .where((x) => x.role == "admin"),
        ),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" >= @__p1 AND "role" = @__p2');
      expect(result.params).to.deep.equal({ __p1: 18, __p2: "admin" });
    });

    it("should combine three WHERE clauses with AND", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((x) => x.age >= 18)
            .where((x) => x.role == "admin")
            .where((x) => x.active == true),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE "age" >= @__p1 AND "role" = @__p2 AND "active" = @__p3',
      );
      expect(result.params).to.deep.equal({ __p1: 18, __p2: "admin", __p3: true });
    });

    it("should handle complex conditions in multiple WHERE clauses", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((x) => x.age >= 18 && x.age <= 65)
            .where((x) => x.role == "admin" || x.role == "moderator")
            .where((x) => x.department != "temp"),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("age" >= @__p1 AND "age" <= @__p2) AND ("role" = @__p3 OR "role" = @__p4) AND "department" != @__p5',
      );
      expect(result.params).to.deep.equal({
        __p1: 18,
        __p2: 65,
        __p3: "admin",
        __p4: "moderator",
        __p5: "temp",
      });
    });

    it("should combine WHERE clauses with SELECT", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((x) => x.age >= 21)
            .where((x) => x.role == "admin")
            .select((x) => ({ id: x.id, name: x.name })),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE "age" >= @__p1 AND "role" = @__p2',
      );
      expect(result.params).to.deep.equal({ __p1: 21, __p2: "admin" });
    });

    it("should combine WHERE clauses with ORDER BY", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((x) => x.age >= 18)
            .where((x) => x.active == true)
            .orderBy((x) => x.name),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE "age" >= @__p1 AND "active" = @__p2 ORDER BY "name" ASC',
      );
      expect(result.params).to.deep.equal({ __p1: 18, __p2: true });
    });

    it("should combine WHERE clauses with TAKE and SKIP", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("tasks")
            .where((x) => x.status == "pending")
            .where((x) => x.priority > 5)
            .skip(10)
            .take(5),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "tasks" WHERE "status" = @__p1 AND "priority" > @__p2 LIMIT @__p4 OFFSET @__p3',
      );
      expect(result.params).to.deep.equal({
        __p1: "pending",
        __p2: 5,
        __p4: 5,
        __p3: 10,
      });
    });

    it("should handle WHERE clauses with GROUP BY", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("sales")
            .where((s) => s.amount > 100)
            .where((s) => s.status == "completed")
            .groupBy((s) => s.category),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "category" FROM "sales" WHERE "amount" > @__p1 AND "status" = @__p2 GROUP BY "category"',
      );
      expect(result.params).to.deep.equal({ __p1: 100, __p2: "completed" });
    });

    it("should handle single WHERE with multiple conditions vs multiple WHERE clauses", () => {
      // Single WHERE with AND - adds parentheses around the AND expression
      const single = toSql(
        defineSelect(schema, (q) => q.from("users").where((x) => x.age >= 18 && x.role == "admin")),
        {},
      );

      // Multiple WHERE clauses - no parentheses needed
      const multiple = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((x) => x.age >= 18)
            .where((x) => x.role == "admin"),
        ),
        {},
      );

      // They generate slightly different but equivalent SQL
      expect(single.sql).to.equal(
        'SELECT * FROM "users" WHERE ("age" >= @__p1 AND "role" = @__p2)',
      );
      expect(single.params).to.deep.equal({ __p1: 18, __p2: "admin" });

      expect(multiple.sql).to.equal(
        'SELECT * FROM "users" WHERE "age" >= @__p1 AND "role" = @__p2',
      );
      expect(multiple.params).to.deep.equal({ __p1: 18, __p2: "admin" });

      // Both are valid PostgreSQL and produce the same results
    });

    it("should handle WHERE clauses with parameters", () => {
      const result = toSql(
        defineSelect(schema, (q, p: { minAge: number; targetRole: string }) =>
          q
            .from("users")
            .where((x) => x.age >= p.minAge)
            .where((x) => x.role == p.targetRole)
            .where((x) => x.active == true),
        ),
        { minAge: 21, targetRole: "admin" },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE "age" >= @minAge AND "role" = @targetRole AND "active" = @__p1',
      );
      expect(result.params).to.deep.equal({ minAge: 21, targetRole: "admin", __p1: true });
    });

    it("should handle WHERE clauses with JOIN", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((u) => u.id > 100)
            .where((u) => u.name != "")
            .join(
              q.from("departments"),
              (u) => u.deptId,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .select((joined) => ({ user: joined.u.name, dept: joined.d.name })),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "t0"."name" AS "user", "t1"."name" AS "dept" FROM "users" AS "t0" INNER JOIN "departments" AS "t1" ON "t0"."deptId" = "t1"."id" WHERE "t0"."id" > @__p1 AND "t0"."name" != @__p2',
      );
      expect(result.params).to.deep.equal({ __p1: 100, __p2: "" });
    });
  });
});
