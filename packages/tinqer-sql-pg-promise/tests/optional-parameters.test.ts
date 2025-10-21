/**
 * Tests for optional params and helpers parameters
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import type { QueryHelpers } from "@webpods/tinqer";
import { defineSelect, defineInsert, defineUpdate, defineDelete } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("Optional Parameters", () => {
  describe("selectStatement - without params or helpers", () => {
    it("should work with only query builder parameter", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users")),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users"');
      expect(result.params).to.deep.equal({});
    });

    it("should work with query builder and select", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").select((u) => ({ id: u.id, name: u.name }))),
        {},
      );

      expect(result.sql).to.equal('SELECT "id" AS "id", "name" AS "name" FROM "users"');
      expect(result.params).to.deep.equal({});
    });

    it("should work with query builder and where with literals", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((u) => u.age >= 18)),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" >= $(__p1)');
      expect(result.params).to.deep.equal({ __p1: 18 });
    });

    it("should work with query builder and multiple operations", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((u) => u.age >= 21)
            .orderBy((u) => u.name)
            .select((u) => u.name),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "name" FROM "users" WHERE "age" >= $(__p1) ORDER BY "name" ASC',
      );
      expect(result.params).to.deep.equal({ __p1: 21 });
    });
  });

  describe("selectStatement - with params but no helpers", () => {
    it("should work with query builder and params", () => {
      const result = toSql(
        defineSelect(schema, (q, p: { minAge: number }) =>
          q.from("users").where((u) => u.age >= p.minAge),
        ),
        { minAge: 25 },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" >= $(minAge)');
      expect(result.params).to.deep.equal({ minAge: 25 });
    });

    it("should work with complex params", () => {
      const result = toSql(
        defineSelect(schema, (q, p: { minAge: number; maxAge: number }) =>
          q
            .from("users")
            .where((u) => u.age >= p.minAge && u.age <= p.maxAge)
            .select((u) => ({ name: u.name, age: u.age })),
        ),
        { minAge: 18, maxAge: 65 },
      );

      expect(result.sql).to.equal(
        'SELECT "name" AS "name", "age" AS "age" FROM "users" WHERE ("age" >= $(minAge) AND "age" <= $(maxAge))',
      );
      expect(result.params).to.deep.equal({ minAge: 18, maxAge: 65 });
    });
  });

  describe("selectStatement - with params and helpers", () => {
    it("should work with all three parameters", () => {
      const result = toSql(
        defineSelect(schema, (q, p: { searchTerm: string }, h?: QueryHelpers) =>
          q
            .from("users")
            .where((u) => h!.functions.icontains(u.name, p.searchTerm))
            .select((u) => u.name),
        ),
        { searchTerm: "alice" },
      );

      // icontains generates LOWER() for case-insensitive matching
      expect(result.sql).to.include("LOWER");
      expect(result.params).to.have.property("searchTerm");
    });
  });

  describe("insertStatement - without params", () => {
    it("should work with only query builder", () => {
      const result = toSql(
        defineInsert(schema, (q) =>
          q.insertInto("users").values({ name: "Alice", email: "alice@example.com", age: 30 }),
        ),
        {},
      );

      expect(result.sql).to.include('INSERT INTO "users"');
      expect(result.params).to.have.property("__p1", "Alice");
      expect(result.params).to.have.property("__p2", "alice@example.com");
      expect(result.params).to.have.property("__p3", 30);
    });
  });

  describe("insertStatement - with params", () => {
    it("should work with query builder and params", () => {
      const result = toSql(
        defineInsert(schema, (q, p: { name: string; email: string; age: number }) =>
          q.insertInto("users").values({ name: p.name, email: p.email, age: p.age }),
        ),
        { name: "Bob", email: "bob@example.com", age: 25 },
      );

      expect(result.sql).to.include('INSERT INTO "users"');
      expect(result.params).to.have.property("name", "Bob");
      expect(result.params).to.have.property("email", "bob@example.com");
      expect(result.params).to.have.property("age", 25);
    });
  });

  describe("updateStatement - without params", () => {
    it("should work with only query builder", () => {
      const result = toSql(
        defineUpdate(schema, (q) =>
          q
            .update("users")
            .set({ age: 31 })
            .where((u) => u.id === 1),
        ),
        {},
      );

      expect(result.sql).to.include('UPDATE "users"');
      expect(result.sql).to.include("SET");
      expect(result.sql).to.include("WHERE");
    });
  });

  describe("updateStatement - with params", () => {
    it("should work with query builder and params", () => {
      const result = toSql(
        defineUpdate(schema, (q, p: { newAge: number; userId: number }) =>
          q
            .update("users")
            .set({ age: p.newAge })
            .where((u) => u.id === p.userId),
        ),
        { newAge: 32, userId: 1 },
      );

      expect(result.sql).to.include('UPDATE "users"');
      expect(result.params).to.have.property("newAge", 32);
      expect(result.params).to.have.property("userId", 1);
    });
  });

  describe("deleteStatement - without params", () => {
    it("should work with only query builder", () => {
      const result = toSql(
        defineDelete(schema, (q) => q.deleteFrom("users").where((u) => u.id === 999)),
        {},
      );

      expect(result.sql).to.include('DELETE FROM "users"');
      expect(result.sql).to.include("WHERE");
    });
  });

  describe("deleteStatement - with params", () => {
    it("should work with query builder and params", () => {
      const result = toSql(
        defineDelete(schema, (q, p: { userId: number }) =>
          q.deleteFrom("users").where((u) => u.id === p.userId),
        ),
        { userId: 123 },
      );

      expect(result.sql).to.include('DELETE FROM "users"');
      expect(result.params).to.have.property("userId", 123);
    });
  });

  describe("Type inference", () => {
    it("should infer correct types with no params", () => {
      // This test mainly checks that TypeScript compilation works
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").select((u) => ({ id: u.id, name: u.name }))),
        {},
      );

      // Runtime check
      expect(result.sql).to.be.a("string");
      expect(result.params).to.be.an("object");
    });

    it("should infer correct types with params", () => {
      // This test mainly checks that TypeScript compilation works
      const result = toSql(
        defineSelect(schema, (q, p: { minAge: number }) =>
          q.from("users").where((u) => u.age >= p.minAge),
        ),
        { minAge: 18 },
      );

      // Runtime check
      expect(result.sql).to.be.a("string");
      expect(result.params).to.have.property("minAge");
    });
  });
});
