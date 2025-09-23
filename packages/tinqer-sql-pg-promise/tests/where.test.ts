/**
 * Tests for WHERE clause generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { db, from } from "./test-schema.js";

describe("WHERE SQL Generation", () => {
  describe("Comparison operators", () => {
    it("should generate equality comparison", () => {
      const result = query(() => from(db, "users").where((x) => x.id == 1), {});

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE id = $(_id1)');
      expect(result.params).to.deep.equal({ _id1: 1 });
    });

    it("should generate greater than comparison", () => {
      const result = query(() => from(db, "users").where((x) => x.age > 18), {});

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age > $(_age1)');
      expect(result.params).to.deep.equal({ _age1: 18 });
    });

    it("should generate greater than or equal comparison", () => {
      const result = query(() => from(db, "users").where((x) => x.age >= 18), {});

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age >= $(_age1)');
      expect(result.params).to.deep.equal({ _age1: 18 });
    });
  });

  describe("Logical operators", () => {
    it("should generate AND condition", () => {
      const result = query(() => from(db, "users").where((x) => x.age >= 18 && x.isActive), {});

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE (age >= $(_age1) AND isActive)',
      );
      expect(result.params).to.deep.equal({ _age1: 18 });
    });

    it("should generate OR condition", () => {
      const result = query(
        () => from(db, "users").where((x) => x.role == "admin" || x.role == "moderator"),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE (role = $(_role1) OR role = $(_role2))',
      );
      expect(result.params).to.deep.equal({ _role1: "admin", _role2: "moderator" });
    });
  });

  describe("External parameters", () => {
    it("should handle simple parameter", () => {
      const result = query(
        (p: { minAge: number }) => from(db, "users").where((x) => x.age >= p.minAge),
        { minAge: 18 },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age >= $(minAge)');
      expect(result.params).to.deep.equal({ minAge: 18 });
    });

    it("should handle multiple parameters", () => {
      const result = query(
        (p: { minAge: number; maxAge: number }) =>
          from(db, "users").where((x) => x.age >= p.minAge && x.age <= p.maxAge),
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
          from(db, "users")
            .where((x) => x.age >= 18)
            .where((x) => x.role == "admin"),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE age >= $(_age1) AND role = $(_role1)',
      );
      expect(result.params).to.deep.equal({ _age1: 18, _role1: "admin" });
    });

    it("should combine three WHERE clauses with AND", () => {
      const result = query(
        () =>
          from(db, "users")
            .where((x) => x.age >= 18)
            .where((x) => x.role == "admin")
            .where((x) => x.active == true),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE age >= $(_age1) AND role = $(_role1) AND active = $(_active1)',
      );
      expect(result.params).to.deep.equal({ _age1: 18, _role1: "admin", _active1: true });
    });

    it("should handle complex conditions in multiple WHERE clauses", () => {
      const result = query(
        () =>
          from(db, "users")
            .where((x) => x.age >= 18 && x.age <= 65)
            .where((x) => x.role == "admin" || x.role == "moderator")
            .where((x) => x.department != "temp"),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE (age >= $(_age1) AND age <= $(_age2)) AND (role = $(_role1) OR role = $(_role2)) AND department != $(_department1)',
      );
      expect(result.params).to.deep.equal({
        _age1: 18,
        _age2: 65,
        _role1: "admin",
        _role2: "moderator",
        _department1: "temp",
      });
    });

    it("should combine WHERE clauses with SELECT", () => {
      const result = query(
        () =>
          from(db, "users")
            .where((x) => x.age >= 21)
            .where((x) => x.role == "admin")
            .select((x) => ({ id: x.id, name: x.name })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT id AS id, name AS name FROM "users" AS t0 WHERE age >= $(_age1) AND role = $(_role1)',
      );
      expect(result.params).to.deep.equal({ _age1: 21, _role1: "admin" });
    });

    it("should combine WHERE clauses with ORDER BY", () => {
      const result = query(
        () =>
          from(db, "users")
            .where((x) => x.age >= 18)
            .where((x) => x.active == true)
            .orderBy((x) => x.name),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE age >= $(_age1) AND active = $(_active1) ORDER BY name ASC',
      );
      expect(result.params).to.deep.equal({ _age1: 18, _active1: true });
    });

    it("should combine WHERE clauses with TAKE and SKIP", () => {
      const result = query(
        () =>
          from(db, "tasks")
            .where((x) => x.status == "pending")
            .where((x) => x.priority > 5)
            .skip(10)
            .take(5),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "tasks" AS t0 WHERE status = $(_status1) AND priority > $(_priority1) LIMIT $(_limit1) OFFSET $(_offset1)',
      );
      expect(result.params).to.deep.equal({
        _status1: "pending",
        _priority1: 5,
        _limit1: 5,
        _offset1: 10,
      });
    });

    it("should handle WHERE clauses with GROUP BY", () => {
      const result = query(
        () =>
          from(db, "sales")
            .where((s) => s.amount > 100)
            .where((s) => s.status == "completed")
            .groupBy((s) => s.category),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "sales" AS t0 WHERE amount > $(_amount1) AND status = $(_status1) GROUP BY category',
      );
      expect(result.params).to.deep.equal({ _amount1: 100, _status1: "completed" });
    });

    it("should handle single WHERE with multiple conditions vs multiple WHERE clauses", () => {
      // Single WHERE with AND - adds parentheses around the AND expression
      const single = query(
        () => from(db, "users").where((x) => x.age >= 18 && x.role == "admin"),
        {},
      );

      // Multiple WHERE clauses - no parentheses needed
      const multiple = query(
        () =>
          from(db, "users")
            .where((x) => x.age >= 18)
            .where((x) => x.role == "admin"),
        {},
      );

      // They generate slightly different but equivalent SQL
      expect(single.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE (age >= $(_age1) AND role = $(_role1))',
      );
      expect(single.params).to.deep.equal({ _age1: 18, _role1: "admin" });

      expect(multiple.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE age >= $(_age1) AND role = $(_role1)',
      );
      expect(multiple.params).to.deep.equal({ _age1: 18, _role1: "admin" });

      // Both are valid PostgreSQL and produce the same results
    });

    it("should handle WHERE clauses with parameters", () => {
      const result = query(
        (p: { minAge: number; targetRole: string }) =>
          from(db, "users")
            .where((x) => x.age >= p.minAge)
            .where((x) => x.role == p.targetRole)
            .where((x) => x.active == true),
        { minAge: 21, targetRole: "admin" },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE age >= $(minAge) AND role = $(targetRole) AND active = $(_active1)',
      );
      expect(result.params).to.deep.equal({ minAge: 21, targetRole: "admin", _active1: true });
    });

    it("should handle WHERE clauses with JOIN", () => {
      const result = query(
        () =>
          from(db, "users")
            .where((u) => u.id > 100)
            .where((u) => u.name != "")
            .join(
              from(db, "departments"),
              (u) => u.deptId,
              (d) => d.id,
              (u, d) => ({ user: u.name, dept: d.name }),
            ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 INNER JOIN (SELECT * FROM "departments" AS t0) AS t1 ON t0.deptId = t1.id WHERE id > $(_id1) AND name != $(_name1)',
      );
      expect(result.params).to.deep.equal({ _id1: 100, _name1: "" });
    });
  });
});
