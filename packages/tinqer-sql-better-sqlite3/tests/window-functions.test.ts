/**
 * Window Functions Tests - SQLite
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
import { db, from } from "./test-schema.js";

describe("Window Functions - SQLite", () => {
  describe("ROW_NUMBER", () => {
    it("should generate ROW_NUMBER with partition and order", () => {
      const result = selectStatement(
        (_, h) =>
          from(db, "users").select((u) => ({
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
        (_, h) =>
          from(db, "users").select((u) => ({
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
        (_, h) =>
          from(db, "users").select((u) => ({
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
        (_, h) =>
          from(db, "users").select((u) => ({
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
        (_, h) =>
          from(db, "users").select((u) => ({
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
        (_, h) =>
          from(db, "users").select((u) => ({
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
        (_, h) =>
          from(db, "users").select((u) => ({
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
        (_, h) =>
          from(db, "users").select((u) => ({
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
        (_, h) =>
          from(db, "users").select((u) => ({
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
        (_, h) =>
          from(db, "users").select((u) => ({
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
});
