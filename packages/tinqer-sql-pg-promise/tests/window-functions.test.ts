/**
 * Window Functions Tests - PostgreSQL
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("Window Functions - PostgreSQL", () => {
  describe("ROW_NUMBER", () => {
    it("should generate ROW_NUMBER with partition and order", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q.from("users").select((u) => ({
            name: u.name,
            rn: h
              .window(u)
              .partitionBy((r) => r.department)
              .orderBy((r) => r.age)
              .rowNumber(),
          })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "name" AS "name", ROW_NUMBER() OVER (PARTITION BY "department" ORDER BY "age" ASC) AS "rn" FROM "users"',
      );
    });

    it("should generate ROW_NUMBER without partition", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q.from("users").select((u) => ({
            name: u.name,
            rn: h
              .window(u)
              .orderBy((r) => r.salary)
              .rowNumber(),
          })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "name" AS "name", ROW_NUMBER() OVER (ORDER BY "salary" ASC) AS "rn" FROM "users"',
      );
      expect(result.sql).not.to.include("PARTITION BY");
    });

    it("should generate ROW_NUMBER with descending order", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q.from("users").select((u) => ({
            name: u.name,
            rn: h
              .window(u)
              .orderByDescending((r) => r.createdAt)
              .rowNumber(),
          })),
        {},
      );

      expect(result.sql).to.include("ROW_NUMBER() OVER");
      expect(result.sql).to.include("ORDER BY");
      expect(result.sql).to.include("DESC");
    });

    it("should generate ROW_NUMBER with multiple partitions", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q.from("users").select((u) => ({
            name: u.name,
            rn: h
              .window(u)
              .partitionBy(
                (r) => r.department,
                (r) => r.city,
              )
              .orderBy((r) => r.salary)
              .rowNumber(),
          })),
        {},
      );

      expect(result.sql).to.include('PARTITION BY "department", "city"');
    });

    it("should generate ROW_NUMBER with thenBy", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q.from("users").select((u) => ({
            name: u.name,
            rn: h
              .window(u)
              .partitionBy((r) => r.department)
              .orderByDescending((r) => r.salary)
              .thenBy((r) => r.name)
              .rowNumber(),
          })),
        {},
      );

      expect(result.sql).to.include('ORDER BY "salary" DESC, "name" ASC');
    });
  });

  describe("RANK", () => {
    it("should generate RANK without partition", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q.from("users").select((u) => ({
            name: u.name,
            rank: h
              .window(u)
              .orderByDescending((r) => r.salary)
              .rank(),
          })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "name" AS "name", RANK() OVER (ORDER BY "salary" DESC) AS "rank" FROM "users"',
      );
    });

    it("should generate RANK with partition", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q.from("users").select((u) => ({
            name: u.name,
            rank: h
              .window(u)
              .partitionBy((r) => r.department)
              .orderByDescending((r) => r.salary)
              .rank(),
          })),
        {},
      );

      expect(result.sql).to.include("RANK() OVER");
      expect(result.sql).to.include('PARTITION BY "department"');
      expect(result.sql).to.include('ORDER BY "salary" DESC');
    });
  });

  describe("DENSE_RANK", () => {
    it("should generate DENSE_RANK with partition and multiple orderings", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q.from("users").select((u) => ({
            name: u.name,
            rank: h
              .window(u)
              .partitionBy((r) => r.department)
              .orderByDescending((r) => r.salary)
              .thenBy((r) => r.name)
              .denseRank(),
          })),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT "name" AS "name", DENSE_RANK() OVER (PARTITION BY "department" ORDER BY "salary" DESC, "name" ASC) AS "rank" FROM "users"',
      );
    });

    it("should generate DENSE_RANK with complex thenBy chain", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q.from("users").select((u) => ({
            name: u.name,
            rank: h
              .window(u)
              .partitionBy((r) => r.department)
              .orderByDescending((r) => r.salary)
              .thenByDescending((r) => r.age)
              .thenBy((r) => r.name)
              .denseRank(),
          })),
        {},
      );

      expect(result.sql).to.include('ORDER BY "salary" DESC, "age" DESC, "name" ASC');
    });
  });

  describe("Multiple window functions", () => {
    it("should generate multiple window functions in same SELECT", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q.from("users").select((u) => ({
            name: u.name,
            rowNum: h
              .window(u)
              .partitionBy((r) => r.department)
              .orderBy((r) => r.salary)
              .rowNumber(),
            rank: h
              .window(u)
              .partitionBy((r) => r.department)
              .orderBy((r) => r.salary)
              .rank(),
            denseRank: h
              .window(u)
              .partitionBy((r) => r.department)
              .orderBy((r) => r.salary)
              .denseRank(),
          })),
        {},
      );

      expect(result.sql).to.include("ROW_NUMBER() OVER");
      expect(result.sql).to.include("RANK() OVER");
      expect(result.sql).to.include("DENSE_RANK() OVER");
    });
  });

  describe("Recursive Nesting - Subquery Wrapping", () => {
    it("should generate double nested subquery for two window filters", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              salary: u.salary,
              rn1: h
                .window(u)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((u) => u.rn1 <= 10)
            .select((u) => ({
              name: u.name,
              salary: u.salary,
              rn1: u.rn1,
              rn2: h
                .window(u)
                .orderBy((r) => r.name)
                .rowNumber(),
            }))
            .where((u) => u.rn2 === 1),
        { __p1: 10, __p2: 1 },
      );

      // Should have two nested subqueries
      expect(result.sql).to.include("FROM (");
      // Count FROM occurrences - should be 3 (outermost + 2 subqueries)
      const fromCount = (result.sql.match(/FROM/g) || []).length;
      expect(fromCount).to.equal(3);
    });

    it("should generate triple nested subquery for three window filters", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              age: u.age,
              salary: u.salary,
              rn1: h
                .window(u)
                .orderBy((r) => r.salary)
                .rowNumber(),
            }))
            .where((u) => u.rn1 <= 10)
            .select((u) => ({
              name: u.name,
              age: u.age,
              rn1: u.rn1,
              rn2: h
                .window(u)
                .orderByDescending((r) => r.age)
                .rowNumber(),
            }))
            .where((u) => u.rn2 <= 5)
            .select((u) => ({
              name: u.name,
              rn1: u.rn1,
              rn2: u.rn2,
              rn3: h
                .window(u)
                .orderBy((r) => r.name)
                .rowNumber(),
            }))
            .where((u) => u.rn3 === 1),
        { __p1: 10, __p2: 5, __p3: 1 },
      );

      // Should have three nested subqueries
      // Count FROM occurrences - should be 4 (outermost + 3 subqueries)
      const fromCount = (result.sql.match(/FROM/g) || []).length;
      expect(fromCount).to.equal(4);
    });

    it("should handle spread operator in nested subqueries", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              ...u,
              rn1: h
                .window(u)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((u) => u.rn1 <= 3)
            .select((u) => ({
              ...u,
              rn2: h
                .window(u)
                .orderBy((r) => r.name)
                .rowNumber(),
            }))
            .where((u) => u.rn2 === 1),
        { __p1: 3, __p2: 1 },
      );

      // Should include * for spread operators
      expect(result.sql).to.include("*");
      // Should have nested structure
      const fromCount = (result.sql.match(/FROM/g) || []).length;
      expect(fromCount).to.equal(3);
    });

    it("should handle mixed regular and window filters", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q
            .from("users")
            .where((u) => u.age > 25) // Regular filter first
            .select((u) => ({
              name: u.name,
              age: u.age,
              rn: h
                .window(u)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((u) => u.rn <= 5), // Window filter
        { __p1: 25, __p2: 5 },
      );

      // Should have subquery for window filter
      expect(result.sql).to.include("FROM (");
      // Regular filter should be in innermost query
      expect(result.sql).to.include("$(__p1)");
    });

    it("should handle COUNT after window filter", () => {
      const result = selectStatement(
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              id: u.id,
              name: u.name,
              rn: h
                .window(u)
                .partitionBy((r) => r.department)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((u) => u.rn === 1)
            .count(),
        { __p1: 1 },
      );

      // Should wrap in subquery and then COUNT
      expect(result.sql).to.include("SELECT COUNT(*) FROM (");
      expect(result.sql).to.include("ROW_NUMBER() OVER");
      expect(result.sql).to.include('WHERE "rn" = $(__p1)');
    });
  });
});
