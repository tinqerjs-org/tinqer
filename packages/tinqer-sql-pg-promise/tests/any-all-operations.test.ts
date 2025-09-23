/**
 * ANY and ALL Operations SQL Generation Tests
 * Verifies that any() and all() operations generate correct SQL with EXISTS/NOT EXISTS
 */

import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

interface User {
  id: number;
  name: string;
  age: number;
  isActive: boolean;
}

describe("ANY and ALL Operations", () => {
  describe("ANY operations", () => {
    it("should generate SQL for any() without predicate", () => {
      const result = query(() => from<User>("users").any(), {});
      expect(result.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" AS t0) THEN 1 ELSE 0 END',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for any() with predicate", () => {
      const result = query(() => from<User>("users").any((u) => u.age >= 18), {});
      expect(result.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" AS t0 WHERE age >= $(_age1)) THEN 1 ELSE 0 END',
      );
      expect(result.params).to.deep.equal({ _age1: 18 });
    });

    it("should generate SQL for any() with boolean column", () => {
      const result = query(() => from<User>("users").any((u) => u.isActive), {});
      expect(result.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" AS t0 WHERE isActive) THEN 1 ELSE 0 END',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should combine WHERE with any() predicate", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.age > 21)
            .any((u) => u.isActive),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" AS t0 WHERE age > $(_age1) AND isActive) THEN 1 ELSE 0 END',
      );
      expect(result.params).to.deep.equal({ _age1: 21 });
    });
  });

  describe("ALL operations", () => {
    it("should generate SQL for all() with predicate", () => {
      const result = query(() => from<User>("users").all((u) => u.age >= 18), {});
      expect(result.sql).to.equal(
        'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" AS t0 WHERE NOT (age >= $(_age1))) THEN 1 ELSE 0 END',
      );
      expect(result.params).to.deep.equal({ _age1: 18 });
    });

    it("should generate SQL for all() with boolean column", () => {
      const result = query(() => from<User>("users").all((u) => u.isActive), {});
      expect(result.sql).to.equal(
        'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" AS t0 WHERE NOT (isActive)) THEN 1 ELSE 0 END',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should combine WHERE with all() predicate", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.name != "admin")
            .all((u) => u.age < 100),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" AS t0 WHERE name != $(_name1) AND NOT (age < $(_age1))) THEN 1 ELSE 0 END',
      );
      expect(result.params).to.deep.equal({ _name1: "admin", _age1: 100 });
    });
  });

  describe("Complex ANY/ALL scenarios", () => {
    it("should handle any() with complex conditions", () => {
      const result = query(
        () => from<User>("users").any((u) => u.age > 18 && u.isActive && u.name != "test"),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" AS t0 WHERE ((age > $(_age1) AND isActive) AND name != $(_name1))) THEN 1 ELSE 0 END',
      );
      expect(result.params).to.deep.equal({ _age1: 18, _name1: "test" });
    });

    it("should handle all() with complex conditions", () => {
      const result = query(
        () => from<User>("users").all((u) => u.age > 0 || u.name == "admin"),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" AS t0 WHERE NOT ((age > $(_age1) OR name = $(_name1)))) THEN 1 ELSE 0 END',
      );
      expect(result.params).to.deep.equal({ _age1: 0, _name1: "admin" });
    });

    it("should work with SELECT and any()", () => {
      const result = query(
        () =>
          from<User>("users")
            .select((u) => ({ name: u.name, age: u.age }))
            .any(),
        {},
      );
      // SELECT projection is ignored for ANY - we just check existence
      expect(result.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" AS t0) THEN 1 ELSE 0 END',
      );
      expect(result.params).to.deep.equal({});
    });
  });
});
