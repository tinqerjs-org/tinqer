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

  describe("Multiple WHERE clauses", () => {
    it("should combine two WHERE clauses with AND", () => {
      const result = query(
        () =>
          from<{ age: number; role: string }>("users")
            .where((x) => x.age >= 18)
            .where((x) => x.role == "admin"),
        {},
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"users\" AS t0 WHERE age >= 18 AND role = 'admin'",
      );
    });

    it("should combine three WHERE clauses with AND", () => {
      const result = query(
        () =>
          from<{ age: number; role: string; active: boolean }>("users")
            .where((x) => x.age >= 18)
            .where((x) => x.role == "admin")
            .where((x) => x.active == true),
        {},
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"users\" AS t0 WHERE age >= 18 AND role = 'admin' AND active = TRUE",
      );
    });

    it("should handle complex conditions in multiple WHERE clauses", () => {
      const result = query(
        () =>
          from<{ age: number; role: string; department: string }>("users")
            .where((x) => x.age >= 18 && x.age <= 65)
            .where((x) => x.role == "admin" || x.role == "moderator")
            .where((x) => x.department != "temp"),
        {},
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"users\" AS t0 WHERE (age >= 18 AND age <= 65) AND (role = 'admin' OR role = 'moderator') AND department != 'temp'",
      );
    });

    it("should combine WHERE clauses with SELECT", () => {
      const result = query(
        () =>
          from<{ id: number; name: string; age: number; role: string }>("users")
            .where((x) => x.age >= 21)
            .where((x) => x.role == "admin")
            .select((x) => ({ id: x.id, name: x.name })),
        {},
      );

      expect(result.sql).to.equal(
        "SELECT id AS id, name AS name FROM \"users\" AS t0 WHERE age >= 21 AND role = 'admin'",
      );
    });

    it("should combine WHERE clauses with ORDER BY", () => {
      const result = query(
        () =>
          from<{ name: string; age: number; active: boolean }>("users")
            .where((x) => x.age >= 18)
            .where((x) => x.active == true)
            .orderBy((x) => x.name),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE age >= 18 AND active = TRUE ORDER BY name ASC',
      );
    });

    it("should combine WHERE clauses with TAKE and SKIP", () => {
      const result = query(
        () =>
          from<{ id: number; status: string; priority: number }>("tasks")
            .where((x) => x.status == "pending")
            .where((x) => x.priority > 5)
            .skip(10)
            .take(5),
        {},
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"tasks\" AS t0 WHERE status = 'pending' AND priority > 5 LIMIT 5 OFFSET 10",
      );
    });

    it("should handle WHERE clauses with GROUP BY", () => {
      const result = query(
        () =>
          from<{ category: string; amount: number; status: string }>("sales")
            .where((s) => s.amount > 100)
            .where((s) => s.status == "completed")
            .groupBy((s) => s.category),
        {},
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"sales\" AS t0 WHERE amount > 100 AND status = 'completed' GROUP BY category",
      );
    });

    it("should handle single WHERE with multiple conditions vs multiple WHERE clauses", () => {
      // Single WHERE with AND - adds parentheses around the AND expression
      const single = query(
        () =>
          from<{ age: number; role: string }>("users").where(
            (x) => x.age >= 18 && x.role == "admin",
          ),
        {},
      );

      // Multiple WHERE clauses - no parentheses needed
      const multiple = query(
        () =>
          from<{ age: number; role: string }>("users")
            .where((x) => x.age >= 18)
            .where((x) => x.role == "admin"),
        {},
      );

      // They generate slightly different but equivalent SQL
      expect(single.sql).to.equal(
        "SELECT * FROM \"users\" AS t0 WHERE (age >= 18 AND role = 'admin')",
      );
      expect(multiple.sql).to.equal(
        "SELECT * FROM \"users\" AS t0 WHERE age >= 18 AND role = 'admin'",
      );

      // Both are valid PostgreSQL and produce the same results
    });

    it("should handle WHERE clauses with parameters", () => {
      const result = query(
        (p: { minAge: number; targetRole: string }) =>
          from<{ age: number; role: string; active: boolean }>("users")
            .where((x) => x.age >= p.minAge)
            .where((x) => x.role == p.targetRole)
            .where((x) => x.active == true),
        { minAge: 21, targetRole: "admin" },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE age >= $(minAge) AND role = $(targetRole) AND active = TRUE',
      );
      expect(result.params).to.deep.equal({ minAge: 21, targetRole: "admin" });
    });

    it("should handle WHERE clauses with JOIN", () => {
      const result = query(
        () =>
          from<{ id: number; name: string; deptId: number }>("users")
            .where((u) => u.id > 100)
            .where((u) => u.name != "")
            .join(
              from<{ id: number; name: string }>("departments"),
              (u) => u.deptId,
              (d) => d.id,
              (u, d) => ({ user: u.name, dept: d.name }),
            ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 INNER JOIN (SELECT * FROM "departments" AS t0) AS t1 ON t0.deptId = t1.id WHERE id > 100 AND name != \'\'',
      );
    });
  });
});
