/**
 * Integration tests for window functions with PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { executeSelect } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db as dbClient } from "./shared-db.js";
import { schema } from "./database-schema.js";

describe("Window Functions - PostgreSQL Integration", () => {
  before(async () => {
    await setupTestDatabase(dbClient);
  });

  describe("ROW_NUMBER()", () => {
    it("should assign unique row numbers within each department ordered by salary DESC", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              row_num: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((u) => u.department_id !== null)
            .orderBy((u) => u.department_id)
            .thenByDescending((u) => u.salary),
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

    it("should handle ROW_NUMBER without PARTITION BY", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              salary: u.salary,
              row_num: h
                .window(u)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .orderByDescending((u) => u.salary),
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

    it("should work with WHERE clause filtering", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              is_active: u.is_active,
              row_num: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((u) => u.is_active === true && u.department_id === 1)
            .orderByDescending((u) => u.salary),
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
    it("should handle ties in salary with gaps in rank", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              rank: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
            }))
            .where((u) => u.department_id === 1)
            .orderByDescending((u) => u.salary)
            .thenBy((u) => u.name),
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

    it("should show rank gaps when there are ties", async () => {
      // Create a tie scenario: Set Diana and Grace to same salary
      await dbClient.none(
        "UPDATE users SET salary = 110000 WHERE name IN ('Diana Prince', 'Grace Hopper')",
      );

      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              salary: u.salary,
              department_id: u.department_id,
              rank: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
            }))
            .where((u) => u.department_id === 1)
            .orderByDescending((u) => u.salary)
            .thenBy((u) => u.name),
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
      await dbClient.none("UPDATE users SET salary = 110000 WHERE name = 'Diana Prince'");
      await dbClient.none("UPDATE users SET salary = 105000 WHERE name = 'Grace Hopper'");
    });
  });

  describe("DENSE_RANK()", () => {
    it("should handle ties without gaps in rank", async () => {
      // Create a tie scenario
      await dbClient.none(
        "UPDATE users SET salary = 110000 WHERE name IN ('Diana Prince', 'Grace Hopper')",
      );

      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              salary: u.salary,
              department_id: u.department_id,
              dense_rank: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .denseRank(),
            }))
            .where((u) => u.department_id === 1)
            .orderByDescending((u) => u.salary)
            .thenBy((u) => u.name),
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
      await dbClient.none("UPDATE users SET salary = 110000 WHERE name = 'Diana Prince'");
      await dbClient.none("UPDATE users SET salary = 105000 WHERE name = 'Grace Hopper'");
    });

    it("should work across all departments", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              dense_rank: h
                .window(u)
                .orderByDescending((r) => r.salary)
                .denseRank(),
            }))
            .where((u) => u.department_id !== null)
            .orderByDescending((u) => u.salary),
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
    it("should support multiple window functions in the same query", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              row_num: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
              rank: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
              dense_rank: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .denseRank(),
            }))
            .where((u) => u.department_id === 1)
            .orderByDescending((u) => u.salary),
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
    it("should find the top earner in each department", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              rank: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
            }))
            .where((u) => u.department_id !== null)
            .orderBy((u) => u.department_id)
            .thenByDescending((u) => u.salary),
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

    it("should rank employees by salary within department with age as tiebreaker", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              age: u.age,
              salary: u.salary,
              department_id: u.department_id,
              rank: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
            }))
            .where((u) => u.department_id === 1)
            .orderByDescending((u) => u.salary)
            .thenByDescending((u) => u.age),
        {},
      );

      expect(result).to.have.length(5);
      expect(result[0]!.name).to.equal("John Doe");
      expect(result[0]!.rank).to.equal(1);
    });

    it("should assign sequential numbers for pagination-like scenarios", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              email: u.email,
              row_num: h
                .window(u)
                .orderBy((r) => r.name)
                .rowNumber(),
            }))
            .orderBy((u) => u.name),
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
    it("should handle multiple ORDER BY columns in window function", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              age: u.age,
              salary: u.salary,
              row_num: h
                .window(u)
                .orderBy((r) => r.age)
                .rowNumber(),
            }))
            .where((u) => u.age !== null)
            .orderBy((u) => u.age),
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

  describe("Filtering on Window Function Results", () => {
    it("should filter on ROW_NUMBER to get top 1 per department", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              ...u,
              rn: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((r) => r.rn === 1 && r.department_id !== null)
            .orderBy((r) => r.department_id),
        {},
      );

      // Should get only the top earner from each department
      expect(result).to.have.length(4); // 4 departments
      expect(result[0]!.name).to.equal("John Doe"); // Dept 1 top earner
      expect(result[0]!.rn).to.equal(1);
      expect(result[1]!.name).to.equal("Jane Smith"); // Dept 2 top earner
      expect(result[1]!.rn).to.equal(1);
      // Verify all have rn === 1
      result.forEach((row) => {
        expect(row.rn).to.equal(1);
      });
    });

    it("should filter on ROW_NUMBER to get top 3 per department", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              rn: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((r) => r.rn <= 3 && r.department_id === 1)
            .orderBy((r) => r.rn),
        {},
      );

      // Should get top 3 earners from department 1
      expect(result).to.have.length(3);
      expect(result[0]!.name).to.equal("John Doe");
      expect(result[0]!.rn).to.equal(1);
      expect(result[1]!.name).to.equal("Diana Prince");
      expect(result[1]!.rn).to.equal(2);
      expect(result[2]!.name).to.equal("Grace Hopper");
      expect(result[2]!.rn).to.equal(3);
    });

    it("should filter on RANK to get all rank 1 employees", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              rank: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rank(),
            }))
            .where((r) => r.rank === 1 && r.department_id !== null)
            .orderBy((r) => r.department_id),
        {},
      );

      // Should get top ranked employee from each department
      expect(result).to.have.length(4); // 4 departments
      // Verify all have rank === 1
      result.forEach((row) => {
        expect(row.rank).to.equal(1);
      });
    });

    it("should combine window filter with regular WHERE conditions", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              is_active: u.is_active,
              rn: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((r) => r.rn <= 2 && r.is_active === true && r.department_id === 1)
            .orderBy((r) => r.rn),
        {},
      );

      // Should get top 2 active earners from department 1
      expect(result.length).to.be.at.most(2);
      result.forEach((row) => {
        expect(row.is_active).to.equal(true);
        expect(row.department_id).to.equal(1);
        expect(row.rn).to.be.at.most(2);
      });
    });

    it("should handle spread operator with window functions", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              ...u,
              rn: h
                .window(u)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((r) => r.rn === 1)
            .orderBy((r) => r.salary),
        {},
      );

      // Should get the highest paid employee
      expect(result).to.have.length(1);
      expect(result[0]!.name).to.equal("John Doe");
      expect(result[0]!.rn).to.equal(1);
      // Verify all user columns are present (spread operator worked)
      expect(result[0]!).to.have.property("id");
      expect(result[0]!).to.have.property("name");
      expect(result[0]!).to.have.property("email");
      expect(result[0]!).to.have.property("age");
      expect(result[0]!).to.have.property("is_active");
    });
  });

  describe("Recursive Nesting - Multiple Window Filters", () => {
    it("should handle double nesting: top-3 per department, then top-1 overall", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              dept_rank: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((r) => r.dept_rank <= 3 && r.department_id === 1)
            .select((r) => ({
              name: r.name,
              department_id: r.department_id,
              salary: r.salary,
              dept_rank: r.dept_rank,
              overall_rank: h
                .window(r)
                .orderByDescending((x) => x.salary)
                .rowNumber(),
            }))
            .where((r) => r.overall_rank === 1)
            .orderByDescending((r) => r.salary),
        {},
      );

      // Should get the highest paid among top-3 from department 1
      expect(result).to.have.length(1);
      expect(result[0]!.name).to.equal("John Doe"); // John is top earner in dept 1
      expect(result[0]!.dept_rank).to.equal(1);
      expect(result[0]!.overall_rank).to.equal(1);
    });

    it("should handle triple nesting: salary -> performance -> name", async () => {
      const result = await executeSelect(
        dbClient,
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
            .where((r) => r.rn1 <= 5) // Top 5 by salary
            .select((r) => ({
              ...r,
              rn2: h
                .window(r)
                .orderBy((x) => x.age)
                .rowNumber(),
            }))
            .where((r) => r.rn2 <= 3) // Top 3 by age among those
            .select((r) => ({
              ...r,
              rn3: h
                .window(r)
                .orderBy((x) => x.name)
                .rowNumber(),
            }))
            .where((r) => r.rn3 === 1) // First alphabetically
            .orderBy((r) => r.name),
        {},
      );

      // Should get exactly one result
      expect(result).to.have.length(1);
      // Verify all rank columns are present
      expect(result[0]!.rn1).to.be.a("number");
      expect(result[0]!.rn2).to.be.a("number");
      expect(result[0]!.rn3).to.equal(1);
      // Verify all user columns are present (spread worked)
      expect(result[0]!).to.have.property("id");
      expect(result[0]!).to.have.property("name");
      expect(result[0]!).to.have.property("email");
    });

    it("should handle nested filters with different window functions", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              name: u.name,
              department_id: u.department_id,
              salary: u.salary,
              row_num: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((r) => r.row_num <= 2 && r.department_id !== null)
            .select((r) => ({
              name: r.name,
              department_id: r.department_id,
              salary: r.salary,
              row_num: r.row_num,
              rank: h
                .window(r)
                .orderByDescending((x) => x.salary)
                .rank(),
            }))
            .where((r) => r.rank <= 3)
            .orderByDescending((r) => r.salary),
        {},
      );

      // Should get top 2 from each department, then rank those and take top 3
      expect(result.length).to.be.at.most(8); // At most 2 per department
      result.forEach((row) => {
        expect(row.row_num).to.be.at.most(2);
        expect(row.rank).to.be.at.most(3);
      });
    });

    it("should handle nested filters with spread operator preserving all columns", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              ...u,
              rn1: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((r) => r.rn1 === 1 && r.department_id === 1)
            .select((r) => ({
              ...r,
              rn2: h
                .window(r)
                .orderBy((x) => x.name)
                .rowNumber(),
            }))
            .where((r) => r.rn2 === 1),
        {},
      );

      // Should get one result: top earner from dept 1
      expect(result).to.have.length(1);
      expect(result[0]!.name).to.equal("John Doe");
      expect(result[0]!.rn1).to.equal(1);
      expect(result[0]!.rn2).to.equal(1);
      // Verify all original columns are present
      expect(result[0]!).to.have.property("id");
      expect(result[0]!).to.have.property("email");
      expect(result[0]!).to.have.property("age");
      expect(result[0]!).to.have.property("salary");
      expect(result[0]!).to.have.property("is_active");
      expect(result[0]!).to.have.property("department_id");
    });

    it("should handle mixed regular WHERE and nested window filters", async () => {
      const result = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .where((u) => u.is_active === true) // Regular filter
            .select((u) => ({
              name: u.name,
              age: u.age,
              salary: u.salary,
              department_id: u.department_id,
              rn1: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((r) => r.rn1 <= 2 && r.department_id === 1) // Window filter
            .select((r) => ({
              ...r,
              rn2: h
                .window(r)
                .orderBy((x) => x.age)
                .rowNumber(),
            }))
            .where((r) => r.rn2 === 1) // Another window filter
            .orderBy((r) => r.age),
        {},
      );

      // Should get the youngest among top-2 active earners in dept 1
      expect(result.length).to.be.at.most(2);
      result.forEach((row) => {
        expect(row.department_id).to.equal(1);
        expect(row.rn1).to.be.at.most(2);
        expect(row.rn2).to.equal(1);
      });
    });

    it("should handle quadruple nesting (extreme case)", async () => {
      const result = await executeSelect(
        dbClient,
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
            .where((r) => r.rn1 <= 8)
            .select((r) => ({
              ...r,
              rn2: h
                .window(r)
                .orderBy((x) => x.name)
                .rowNumber(),
            }))
            .where((r) => r.rn2 <= 6)
            .select((r) => ({
              ...r,
              rn3: h
                .window(r)
                .orderByDescending((x) => x.salary)
                .rowNumber(),
            }))
            .where((r) => r.rn3 <= 4)
            .select((r) => ({
              ...r,
              rn4: h
                .window(r)
                .orderBy((x) => x.name)
                .rowNumber(),
            }))
            .where((r) => r.rn4 <= 2)
            .orderBy((r) => r.name),
        {},
      );

      // Should get results filtered through 4 levels
      expect(result.length).to.be.at.most(2);
      result.forEach((row) => {
        expect(row.rn1).to.be.at.most(8);
        expect(row.rn2).to.be.at.most(6);
        expect(row.rn3).to.be.at.most(4);
        expect(row.rn4).to.be.at.most(2);
      });
    });

    it("should handle COUNT after window filter", async () => {
      const count = await executeSelect(
        dbClient,
        schema,
        (q, _, h) =>
          q
            .from("users")
            .select((u) => ({
              id: u.id,
              name: u.name,
              department_id: u.department_id,
              rn: h
                .window(u)
                .partitionBy((r) => r.department_id)
                .orderByDescending((r) => r.salary)
                .rowNumber(),
            }))
            .where((r) => r.rn === 1 && r.department_id !== null)
            .count(),
        {},
      );

      // Should count top earner from each department
      expect(count).to.equal(4); // 4 departments
    });
  });
});
