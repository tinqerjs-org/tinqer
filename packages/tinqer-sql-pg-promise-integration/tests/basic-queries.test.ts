/**
 * Basic query integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { execute, executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";

describe("PostgreSQL Integration - Basic Queries", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("SELECT queries", () => {
    it("should select all users", async () => {
      const results = await executeSimple(db, () => from(db, "users"));

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      expect(results[0]).to.have.property("id");
      expect(results[0]).to.have.property("name");
      expect(results[0]).to.have.property("email");
    });

    it("should select specific columns", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users").select((u) => ({
          id: u.id,
          name: u.name,
        })),
      );

      expect(results).to.be.an("array");
      expect(results[0]).to.have.property("id");
      expect(results[0]).to.have.property("name");
      expect(results[0]).to.not.have.property("email");
    });

    it("should rename columns in projection", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users").select((u) => ({
          userId: u.id,
          fullName: u.name,
          userEmail: u.email,
        })),
      );

      expect(results[0]).to.have.property("userId");
      expect(results[0]).to.have.property("fullName");
      expect(results[0]).to.have.property("userEmail");
    });
  });

  describe("WHERE clause", () => {
    it("should filter users by age", async () => {
      const results = await executeSimple(db, () => from(db, "users").where((u) => u.age >= 30));

      expect(results).to.be.an("array");
      results.forEach((user) => {
        expect(user.age).to.be.at.least(30);
      });
    });

    it("should filter with multiple conditions", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users").where((u) => u.age >= 25 && u.is_active === true),
      );

      expect(results).to.be.an("array");
      results.forEach((user) => {
        expect(user.age).to.be.at.least(25);
        expect(user.is_active).to.be.true;
      });
    });

    it("should filter with OR conditions", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users").where((u) => u.age < 30 || u.department_id === 4),
      );

      expect(results).to.be.an("array");
      results.forEach((user) => {
        expect(user.age < 30 || user.department_id === 4).to.be.true;
      });
    });

    it("should filter with parameters", async () => {
      const results = await execute(
        db,
        (params) => from(db, "users").where((u) => u.age >= params.minAge),
        { minAge: 35 },
      );

      expect(results).to.be.an("array");
      results.forEach((user) => {
        expect(user.age).to.be.at.least(35);
      });
    });
  });

  describe("ORDER BY", () => {
    it("should order users by name", async () => {
      const results = await executeSimple(db, () => from(db, "users").orderBy((u) => u.name));

      expect(results).to.be.an("array");
      for (let i = 1; i < results.length; i++) {
        expect(results[i].name >= results[i - 1].name).to.be.true;
      }
    });

    it("should order users by age descending", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users").orderByDescending((u) => u.age),
      );

      expect(results).to.be.an("array");
      for (let i = 1; i < results.length; i++) {
        expect(results[i].age <= results[i - 1].age).to.be.true;
      }
    });

    it("should order with multiple columns", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users")
          .orderBy((u) => u.department_id)
          .thenByDescending((u) => u.age),
      );

      expect(results).to.be.an("array");
      let prevDept = results[0].department_id;
      let prevAge = results[0].age;

      for (let i = 1; i < results.length; i++) {
        if (results[i].department_id === prevDept) {
          expect(results[i].age <= prevAge).to.be.true;
        }
        prevDept = results[i].department_id;
        prevAge = results[i].age;
      }
    });
  });

  describe("LIMIT and OFFSET", () => {
    it("should limit results", async () => {
      const results = await executeSimple(db, () => from(db, "users").take(5));

      expect(results).to.have.lengthOf(5);
    });

    it("should skip results", async () => {
      const allResults = await executeSimple(db, () => from(db, "users").orderBy((u) => u.id));
      const skippedResults = await executeSimple(db, () =>
        from(db, "users")
          .orderBy((u) => u.id)
          .skip(3),
      );

      expect(skippedResults[0].id).to.equal(allResults[3].id);
    });

    it("should paginate results", async () => {
      const page1 = await executeSimple(db, () =>
        from(db, "users")
          .orderBy((u) => u.id)
          .take(3),
      );
      const page2 = await executeSimple(db, () =>
        from(db, "users")
          .orderBy((u) => u.id)
          .skip(3)
          .take(3),
      );

      expect(page1).to.have.lengthOf(3);
      expect(page2).to.have.lengthOf(3);
      expect(page1[0].id).to.not.equal(page2[0].id);
    });
  });

  describe("DISTINCT", () => {
    it("should return distinct department IDs", async () => {
      const results = await executeSimple(db, () =>
        from(db, "users")
          .select((u) => ({ department_id: u.department_id }))
          .distinct(),
      );

      const uniqueDepts = new Set(results.map((r) => r.department_id));
      expect(results.length).to.equal(uniqueDepts.size);
    });
  });
});