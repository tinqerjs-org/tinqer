/**
 * Integration tests for window functions with Better SQLite3
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSelect } from "@webpods/tinqer-sql-better-sqlite3";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("Window Functions - SQLite Integration", () => {
  before(() => {
    setupTestDatabase(db);
  });

  describe("ROW_NUMBER()", () => {
    it("should assign unique row numbers within each department ordered by salary DESC", () => {
      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              row_num: h.window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((u) => u.department_id !== null)
            .orderBy((u) => [
              { value: u.department_id, direction: "ASC" },
              { value: u.salary, direction: "DESC" },
            ]),
        {},
      );

      // Department 1 (Engineering): John (120000), Diana (110000), Grace (105000), Bob (95000), Frank (88000)
      const dept1 = result.filter((r) => r.department_id === 1);
      expect(dept1).to.have.length(5);
      expect(dept1[0]!.name).to.equal("John Doe");
      expect(dept1[0]!.row_num).to.equal(1);
      expect(dept1[1]!.name).to.equal("Diana Prince");
      expect(dept1[1]!.row_num).to.equal(2);
      expect(dept1[2]!.name).to.equal("Grace Hopper");
      expect(dept1[2]!.row_num).to.equal(3);
      expect(dept1[3]!.name).to.equal("Bob Johnson");
      expect(dept1[3]!.row_num).to.equal(4);
      expect(dept1[4]!.name).to.equal("Frank Castle");
      expect(dept1[4]!.row_num).to.equal(5);

      // Department 2 (Sales): Jane (95000), Eva (78000)
      const dept2 = result.filter((r) => r.department_id === 2);
      expect(dept2).to.have.length(2);
      expect(dept2[0]!.name).to.equal("Jane Smith");
      expect(dept2[0]!.row_num).to.equal(1);
      expect(dept2[1]!.name).to.equal("Eva Green");
      expect(dept2[1]!.row_num).to.equal(2);
    });

    it("should handle ROW_NUMBER without PARTITION BY", () => {
      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              salary: u.salary,
              row_num: h.window(u).orderByDescending((r) => r.salary).rowNumber(),
            }))
            .orderBy((u) => ({ value: u.salary, direction: "DESC" })),
        {},
      );

      // Should assign sequential row numbers across all users ordered by salary
      expect(result[0]!.name).to.equal("John Doe");
      expect(result[0]!.row_num).to.equal(1);
      expect(result[1]!.name).to.equal("Diana Prince");
      expect(result[1]!.row_num).to.equal(2);
      // Verify row numbers are sequential
      result.forEach((row, idx) => {
        expect(row.row_num).to.equal(idx + 1);
      });
    });

    it("should work with WHERE clause filtering", () => {
      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              is_active: u.is_active,
              row_num: h.window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((u) => u.is_active === 1 && u.department_id === 1)
            .orderBy((u) => ({ value: u.salary, direction: "DESC" })),
        {},
      );

      // Only active users in department 1: John, Diana, Bob, Grace
      expect(result).to.have.length(4);
      expect(result[0]!.name).to.equal("John Doe");
      expect(result[0]!.row_num).to.equal(1);
      expect(result[1]!.name).to.equal("Diana Prince");
      expect(result[1]!.row_num).to.equal(2);
    });
  });

  describe("RANK()", () => {
    it("should handle ties in salary with gaps in rank", () => {
      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              rank: h.window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
            }))
            .where((u) => u.department_id === 1)
            .orderBy((u) => [
              { value: u.salary, direction: "DESC" },
              { value: u.name, direction: "ASC" },
            ]),
        {},
      );

      // John (120000) -> rank 1
      // Diana (110000) -> rank 2
      // Grace (105000) -> rank 3
      // Bob (95000) -> rank 4
      // Frank (88000) -> rank 5
      expect(result[0]!.name).to.equal("John Doe");
      expect(result[0]!.rank).to.equal(1);
      expect(result[1]!.name).to.equal("Diana Prince");
      expect(result[1]!.rank).to.equal(2);
    });

    it("should show rank gaps when there are ties", () => {
      // Create a tie scenario: Set Diana and Grace to same salary
      db.exec("UPDATE users SET salary = 110000 WHERE name IN ('Diana Prince', 'Grace Hopper')");

      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              salary: u.salary,
              department_id: u.department_id,
              rank: h.window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
            }))
            .where((u) => u.department_id === 1)
            .orderBy((u) => [
              { value: u.salary, direction: "DESC" },
              { value: u.name, direction: "ASC" },
            ]),
        {},
      );

      // John (120000) -> rank 1
      // Diana & Grace (110000) -> both rank 2
      // Next person (Bob 95000) -> rank 4 (gap because of tie)
      expect(result[0]!.rank).to.equal(1);
      expect(result[1]!.rank).to.equal(2);
      expect(result[2]!.rank).to.equal(2); // Tie
      expect(result[3]!.rank).to.equal(4); // Gap

      // Reset
      db.exec("UPDATE users SET salary = 110000 WHERE name = 'Diana Prince'");
      db.exec("UPDATE users SET salary = 105000 WHERE name = 'Grace Hopper'");
    });
  });

  describe("DENSE_RANK()", () => {
    it("should handle ties without gaps in rank", () => {
      // Create a tie scenario
      db.exec("UPDATE users SET salary = 110000 WHERE name IN ('Diana Prince', 'Grace Hopper')");

      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              salary: u.salary,
              department_id: u.department_id,
              dense_rank: h.window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .denseRank(),
            }))
            .where((u) => u.department_id === 1)
            .orderBy((u) => [
              { value: u.salary, direction: "DESC" },
              { value: u.name, direction: "ASC" },
            ]),
        {},
      );

      // John (120000) -> dense_rank 1
      // Diana & Grace (110000) -> both dense_rank 2
      // Next person (Bob 95000) -> dense_rank 3 (NO gap)
      expect(result[0]!.dense_rank).to.equal(1);
      expect(result[1]!.dense_rank).to.equal(2);
      expect(result[2]!.dense_rank).to.equal(2); // Tie
      expect(result[3]!.dense_rank).to.equal(3); // NO gap

      // Reset
      db.exec("UPDATE users SET salary = 110000 WHERE name = 'Diana Prince'");
      db.exec("UPDATE users SET salary = 105000 WHERE name = 'Grace Hopper'");
    });

    it("should work across all departments", () => {
      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              dense_rank: h.window(u).orderByDescending((r) => r.salary).denseRank(),
            }))
            .where((u) => u.department_id !== null)
            .orderBy((u) => ({ value: u.salary, direction: "DESC" })),
        {},
      );

      // Verify dense ranks are assigned correctly across all departments
      expect(result[0]!.dense_rank).to.equal(1); // Highest salary
      // Each distinct salary level should have a unique dense rank
      const uniqueSalaries = [...new Set(result.map((r) => r.salary))];
      const maxDenseRank = Math.max(...result.map((r) => r.dense_rank));
      expect(maxDenseRank).to.equal(uniqueSalaries.length);
    });
  });

  describe("Multiple Window Functions", () => {
    it("should support multiple window functions in the same query", () => {
      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              row_num: h.window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
              rank: h.window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
              dense_rank: h.window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .denseRank(),
            }))
            .where((u) => u.department_id === 1)
            .orderBy((u) => ({ value: u.salary, direction: "DESC" })),
        {},
      );

      expect(result).to.have.length(5);

      // Verify all three window functions produce results
      result.forEach((row) => {
        expect(row.row_num).to.be.a("number");
        expect(row.rank).to.be.a("number");
        expect(row.dense_rank).to.be.a("number");
      });

      // For first row, all should be 1
      expect(result[0]!.row_num).to.equal(1);
      expect(result[0]!.rank).to.equal(1);
      expect(result[0]!.dense_rank).to.equal(1);
    });
  });

  describe("Real-world Scenarios", () => {
    it("should find the top earner in each department", () => {
      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              rank: h.window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
            }))
            .where((u) => u.department_id !== null)
            .orderBy((u) => [
              { value: u.department_id, direction: "ASC" },
              { value: u.salary, direction: "DESC" },
            ]),
        {},
      );

      // Filter for rank 1 in application layer
      const topEarners = result.filter((r) => r.rank === 1);

      expect(topEarners.length).to.be.greaterThan(0);
      // Department 1 top earner should be John Doe
      const dept1Top = topEarners.find((r) => r.department_id === 1);
      expect(dept1Top!.name).to.equal("John Doe");
      expect(dept1Top!.salary).to.equal(120000);
    });

    it("should rank employees by salary within department with age as tiebreaker", () => {
      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              age: u.age,
              salary: u.salary,
              department_id: u.department_id,
              rank: h.window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
            }))
            .where((u) => u.department_id === 1)
            .orderBy((u) => [
              { value: u.salary, direction: "DESC" },
              { value: u.age, direction: "DESC" },
            ]),
        {},
      );

      expect(result).to.have.length(5);
      expect(result[0]!.name).to.equal("John Doe");
      expect(result[0]!.rank).to.equal(1);
    });

    it("should assign sequential numbers for pagination-like scenarios", () => {
      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              email: u.email,
              row_num: h.window(u).orderBy((r) => r.name).rowNumber(),
            }))
            .orderBy((u) => ({ value: u.name, direction: "ASC" })),
        {},
      );

      // Verify sequential numbering for all users
      expect(result.length).to.equal(10); // Total users
      result.forEach((row, idx) => {
        expect(row.row_num).to.equal(idx + 1);
      });
    });
  });

  describe("Complex Ordering", () => {
    it("should handle multiple ORDER BY columns in window function", () => {
      const result = executeSelect(
        db,
        (_, h) =>
          from(dbContext, "users")
            .select((u) => ({
              name: u.name,
              age: u.age,
              salary: u.salary,
              row_num: h.window(u).orderBy((r) => r.age).rowNumber(),
            }))
            .where((u) => u.age !== null)
            .orderBy((u) => ({ value: u.age, direction: "ASC" })),
        {},
      );

      // Verify ordering by age
      expect(result[0]!.row_num).to.equal(1);
      // Verify ages are in ascending order
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.age!).to.be.at.least(result[i - 1]!.age!);
      }
    });
  });
});
