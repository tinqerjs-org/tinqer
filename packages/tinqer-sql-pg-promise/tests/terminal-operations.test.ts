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
      expect(result.sql).to.equal('SELECT * FROM "users" LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for first() with predicate", () => {
      const result = query(() => from<User>("users").first((u) => u.age > 18), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" > $(__p1) LIMIT 1');
      expect(result.params).to.deep.equal({ __p1: 18 });
    });

    it("should generate SQL for firstOrDefault()", () => {
      const result = query(() => from<User>("users").firstOrDefault(), {});
      expect(result.sql).to.equal('SELECT * FROM "users" LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for firstOrDefault() with predicate", () => {
      const result = query(() => from<User>("users").firstOrDefault((u) => u.isActive), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "isActive" LIMIT 1');
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
        'SELECT * FROM "users" WHERE "age" > $(__p1) AND "isActive" LIMIT 1',
      );
      expect(result.params).to.deep.equal({ __p1: 18 });
    });
  });

  describe("SINGLE operations", () => {
    it("should generate SQL for single()", () => {
      const result = query(() => from<User>("users").single(), {});
      expect(result.sql).to.equal('SELECT * FROM "users" LIMIT 2');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for single() with predicate", () => {
      const result = query(() => from<User>("users").single((u) => u.id == 1), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "id" = $(__p1) LIMIT 2');
      expect(result.params).to.deep.equal({ __p1: 1 });
    });

    it("should generate SQL for singleOrDefault()", () => {
      const result = query(() => from<User>("users").singleOrDefault(), {});
      expect(result.sql).to.equal('SELECT * FROM "users" LIMIT 2');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for singleOrDefault() with predicate", () => {
      const result = query(() => from<User>("users").singleOrDefault((u) => u.name == "John"), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "name" = $(__p1) LIMIT 2');
      expect(result.params).to.deep.equal({ __p1: "John" });
    });
  });

  describe("LAST operations", () => {
    it("should generate SQL for last() without ORDER BY", () => {
      const result = query(() => from<User>("users").last(), {});
      // Without ORDER BY, we add a default ORDER BY 1 DESC
      expect(result.sql).to.equal('SELECT * FROM "users" ORDER BY 1 DESC LIMIT 1');
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
      // With existing ORDER BY, last() reverses the direction
      expect(result.sql).to.equal('SELECT * FROM "users" ORDER BY "id" DESC LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for last() with predicate", () => {
      const result = query(() => from<User>("users").last((u) => u.isActive), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "isActive" ORDER BY 1 DESC LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for lastOrDefault()", () => {
      const result = query(() => from<User>("users").lastOrDefault(), {});
      expect(result.sql).to.equal('SELECT * FROM "users" ORDER BY 1 DESC LIMIT 1');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for lastOrDefault() with predicate", () => {
      const result = query(() => from<User>("users").lastOrDefault((u) => u.age < 30), {});
      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE "age" < $(__p1) ORDER BY 1 DESC LIMIT 1',
      );
      expect(result.params).to.deep.equal({ __p1: 30 });
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
      expect(result.sql).to.equal('SELECT "name" AS "name" FROM "users" LIMIT 1');
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
              (u, o) => ({ u, o }),
            )
            .select((joined) => ({ userName: joined.u.name, orderAmount: joined.o.amount }))
            .single(),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT "t0"."name" AS "userName", "t1"."amount" AS "orderAmount" FROM "users" AS "t0" INNER JOIN "orders" AS "t1" ON "t0"."id" = "t1"."userId" LIMIT 2',
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
      expect(result.sql).to.equal('SELECT DISTINCT "name" AS "name" FROM "users" LIMIT 1');
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
      // last() reverses ORDER BY direction
      expect(result.sql).to.equal('SELECT * FROM "users" ORDER BY "name" DESC LIMIT 1');
      expect(result.params).to.deep.equal({});
    });
  });
});
