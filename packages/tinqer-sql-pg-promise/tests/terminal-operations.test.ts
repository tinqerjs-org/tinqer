/**
 * Terminal Operations SQL Generation Tests
 * Verifies that first, last, single operations generate correct SQL
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

describe("Terminal Operations", () => {
  describe("FIRST operations", () => {
    it("should generate SQL for first()", () => {
      const result = query(() => from<User>("users").first(), {});
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for first() with predicate", () => {
      const result = query(() => from<User>("users").first((u) => u.age > 18), {});
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age > $(_age1) LIMIT 1');
      expect(result.params).to.deep.equal({ _age1: 18 });
    });

    it("should generate SQL for firstOrDefault()", () => {
      const result = query(() => from<User>("users").firstOrDefault(), {});
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for firstOrDefault() with predicate", () => {
      const result = query(() => from<User>("users").firstOrDefault((u) => u.isActive), {});
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE isActive LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should combine WHERE and first() predicate", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.age > 18)
            .first((u) => u.isActive),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE age > $(_age1) AND isActive LIMIT 1',
      );
      expect(result.params).to.deep.equal({ _age1: 18 });
    });
  });

  describe("SINGLE operations", () => {
    it("should generate SQL for single()", () => {
      const result = query(() => from<User>("users").single(), {});
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 LIMIT 2');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for single() with predicate", () => {
      const result = query(() => from<User>("users").single((u) => u.id == 1), {});
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE id = $(_id1) LIMIT 2');
      expect(result.params).to.deep.equal({ _id1: 1 });
    });

    it("should generate SQL for singleOrDefault()", () => {
      const result = query(() => from<User>("users").singleOrDefault(), {});
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 LIMIT 2');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for singleOrDefault() with predicate", () => {
      const result = query(() => from<User>("users").singleOrDefault((u) => u.name == "John"), {});
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE name = $(_name1) LIMIT 2');
      expect(result.params).to.deep.equal({ _name1: "John" });
    });
  });

  describe("LAST operations", () => {
    it("should generate SQL for last() without ORDER BY", () => {
      const result = query(() => from<User>("users").last(), {});
      // Without ORDER BY, we add a default ORDER BY 1 DESC
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 ORDER BY 1 DESC LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for last() with existing ORDER BY", () => {
      const result = query(
        () =>
          from<User>("users")
            .orderBy((u) => u.id)
            .last(),
        {},
      );
      // With existing ORDER BY, we should keep it (TODO: reverse it)
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 ORDER BY id ASC LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for last() with predicate", () => {
      const result = query(() => from<User>("users").last((u) => u.isActive), {});
      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE isActive ORDER BY 1 DESC LIMIT 1',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for lastOrDefault()", () => {
      const result = query(() => from<User>("users").lastOrDefault(), {});
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 ORDER BY 1 DESC LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for lastOrDefault() with predicate", () => {
      const result = query(() => from<User>("users").lastOrDefault((u) => u.age < 30), {});
      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 WHERE age < $(_age1) ORDER BY 1 DESC LIMIT 1',
      );
      expect(result.params).to.deep.equal({ _age1: 30 });
    });
  });

  describe("Complex terminal operations", () => {
    it("should work with SELECT projection and first()", () => {
      const result = query(
        () =>
          from<User>("users")
            .select((u) => ({ name: u.name }))
            .first(),
        {},
      );
      // Note: name AS name is generated for object projections
      expect(result.sql).to.equal('SELECT name AS name FROM "users" AS t0 LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should work with JOIN and single()", () => {
      interface Order {
        id: number;
        userId: number;
        amount: number;
      }

      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Order>("orders"),
              (u) => u.id,
              (o) => o.userId,
              (u, o) => ({ userName: u.name, orderAmount: o.amount }),
            )
            .single(),
        {},
      );
      // TODO: JOIN projections are not fully implemented yet
      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS t0 INNER JOIN (SELECT * FROM "orders" AS t0) AS t1 ON t0.id = t1.userId LIMIT 2',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should work with DISTINCT and first()", () => {
      const result = query(
        () =>
          from<User>("users")
            .select((u) => ({ name: u.name }))
            .distinct()
            .first(),
        {},
      );
      expect(result.sql).to.equal('SELECT DISTINCT name AS name FROM "users" AS t0 LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should work with ORDER BY and last()", () => {
      const result = query(
        () =>
          from<User>("users")
            .orderBy((u) => u.name)
            .last(),
        {},
      );
      // TODO: Should reverse ORDER BY for LAST
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 ORDER BY name ASC LIMIT 1');
      expect(result.params).to.deep.equal({});
    });
  });
});
