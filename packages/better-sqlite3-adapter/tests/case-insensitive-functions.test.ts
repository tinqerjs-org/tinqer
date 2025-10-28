/**
 * Tests for case-insensitive functions SQL generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect } from "@tinqerjs/tinqer";
import { toSql } from "../dist/index.js";
import { createSchema } from "@tinqerjs/tinqer";

type User = {
  id: number;
  name: string;
  email: string;
  age: number;
  bio?: string | null;
  role?: string | null;
};

interface Schema {
  users: User;
}

const schema = createSchema<Schema>();

describe("Case-Insensitive Functions - SQL Generation", () => {
  describe("iequals function", () => {
    it("should generate LOWER() = LOWER() for iequals", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q.from("users").where((u) => h.functions.iequals(u.name, "John")),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE LOWER("name") = LOWER(@__p1)');
      expect(result.params).to.deep.equal({ __p1: "John", users: [] });
    });

    it("should handle column-to-column comparison", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q.from("users").where((u) => h.functions.iequals(u.name, u.email)),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE LOWER("name") = LOWER("email")');
      expect(result.params).to.deep.equal({ users: [] });
    });

    it("should handle query parameters", () => {
      const result = toSql(
        defineSelect(schema, (q, params: { searchName: string; users?: unknown[] }, h) =>
          q.from("users").where((u) => h.functions.iequals(u.name, params.searchName)),
        ),
        { users: [], searchName: "Alice" },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE LOWER("name") = LOWER(@searchName)');
      expect(result.params).to.deep.equal({ users: [], searchName: "Alice" });
    });
  });

  describe("istartsWith function", () => {
    it("should generate LOWER() LIKE LOWER() || '%' for istartsWith", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q.from("users").where((u) => h.functions.istartsWith(u.name, "J")),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE LOWER("name") LIKE LOWER(@__p1) || \'%\'',
      );
      expect(result.params).to.deep.equal({ __p1: "J", users: [] });
    });

    it("should handle complex prefix values", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q.from("users").where((u) => h.functions.istartsWith(u.email, "admin@")),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE LOWER("email") LIKE LOWER(@__p1) || \'%\'',
      );
      expect(result.params).to.deep.equal({ __p1: "admin@", users: [] });
    });
  });

  describe("iendsWith function", () => {
    it("should generate LOWER() LIKE '%' || LOWER() for iendsWith", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q.from("users").where((u) => h.functions.iendsWith(u.email, ".com")),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE LOWER("email") LIKE \'%\' || LOWER(@__p1)',
      );
      expect(result.params).to.deep.equal({ __p1: ".com", users: [] });
    });
  });

  describe("icontains function", () => {
    it("should generate LOWER() LIKE '%' || LOWER() || '%' for icontains", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q.from("users").where((u) => h.functions.icontains(u.bio!, "developer")),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"users\" WHERE LOWER(\"bio\") LIKE '%' || LOWER(@__p1) || '%'",
      );
      expect(result.params).to.deep.equal({ __p1: "developer", users: [] });
    });

    it("should handle null-safe navigation", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q.from("users").where((u) => h.functions.icontains(u.bio!, "engineer")),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"users\" WHERE LOWER(\"bio\") LIKE '%' || LOWER(@__p1) || '%'",
      );
      expect(result.params).to.deep.equal({ __p1: "engineer", users: [] });
    });
  });

  describe("Complex queries with case-insensitive functions", () => {
    it("should handle AND conditions", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q.from("users").where((u) => h.functions.iequals(u.name, "John") && u.age > 18),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE (LOWER("name") = LOWER(@__p1) AND "age" > @__p2)',
      );
      expect(result.params).to.deep.equal({ __p1: "John", __p2: 18, users: [] });
    });

    it("should handle OR conditions", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q
            .from("users")
            .where(
              (u) => h.functions.istartsWith(u.name, "A") || h.functions.istartsWith(u.name, "B"),
            ),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE (LOWER("name") LIKE LOWER(@__p1) || \'%\' OR LOWER("name") LIKE LOWER(@__p2) || \'%\')',
      );
      expect(result.params).to.deep.equal({ __p1: "A", __p2: "B", users: [] });
    });

    it("should handle mixed case-sensitive and case-insensitive operations", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q
            .from("users")
            .where((u) => h.functions.icontains(u.email, "admin") && u.email.endsWith(".com")),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        "SELECT * FROM \"users\" WHERE (LOWER(\"email\") LIKE '%' || LOWER(@__p1) || '%' AND \"email\" LIKE '%' || @__p2)",
      );
      expect(result.params).to.deep.equal({ __p1: "admin", __p2: ".com", users: [] });
    });

    it("should work with select projection", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q
            .from("users")
            .where((u) => h.functions.iequals(u.role!, "ADMIN"))
            .select((u) => ({
              id: u.id,
              name: u.name,
              role: u.role,
            })),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        'SELECT "id" AS "id", "name" AS "name", "role" AS "role" FROM "users" WHERE LOWER("role") = LOWER(@__p1)',
      );
      expect(result.params).to.deep.equal({ __p1: "ADMIN", users: [] });
    });

    it("should work with orderBy", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q
            .from("users")
            .where((u) => h.functions.icontains(u.bio!, "software"))
            .orderBy((u) => u.name),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE LOWER("bio") LIKE \'%\' || LOWER(@__p1) || \'%\' ORDER BY "name" ASC',
      );
      expect(result.params).to.deep.equal({ __p1: "software", users: [] });
    });
  });

  describe("NOT operator with case-insensitive functions", () => {
    it("should handle NOT with iequals", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q.from("users").where((u) => !h.functions.iequals(u.role!, "admin")),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE NOT (LOWER("role") = LOWER(@__p1))');
      expect(result.params).to.deep.equal({ __p1: "admin", users: [] });
    });

    it("should handle complex NOT conditions", () => {
      const result = toSql(
        defineSelect(schema, (q, _params, h) =>
          q
            .from("users")
            .where(
              (u) =>
                !(
                  h.functions.istartsWith(u.name, "test") || h.functions.iendsWith(u.email, ".test")
                ),
            ),
        ),
        { users: [] },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE NOT ((LOWER("name") LIKE LOWER(@__p1) || \'%\' OR LOWER("email") LIKE \'%\' || LOWER(@__p2)))',
      );
      expect(result.params).to.deep.equal({ __p1: "test", __p2: ".test", users: [] });
    });
  });
});
