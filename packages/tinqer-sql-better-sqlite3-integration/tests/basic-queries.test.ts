/**
 * Basic query integration tests with Better SQLite3
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { executeSelect, executeSelectSimple } from "@webpods/tinqer-sql-better-sqlite3";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { schema } from "./database-schema.js";

describe("Better SQLite3 Integration - Basic Queries", () => {
  before(() => {
    setupTestDatabase(db);
  });

  describe("SELECT queries", () => {
    it("should select all users", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users"),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users"');
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      expect(results[0]).to.have.property("id");
      expect(results[0]).to.have.property("name");
      expect(results[0]).to.have.property("email");
    });

    it("should select specific columns", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx.from("users").select((u) => ({
            id: u.id,
            name: u.name,
          })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT "id" AS "id", "name" AS "name" FROM "users"');
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      expect(results[0]).to.have.property("id");
      expect(results[0]).to.have.property("name");
      expect(results[0]).to.not.have.property("email");
    });

    it("should rename columns in projection", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx.from("users").select((u) => ({
            userId: u.id,
            fullName: u.name,
            userEmail: u.email,
          })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "id" AS "userId", "name" AS "fullName", "email" AS "userEmail" FROM "users"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results[0]).to.have.property("userId");
      expect(results[0]).to.have.property("fullName");
      expect(results[0]).to.have.property("userEmail");
    });
  });

  describe("WHERE clause", () => {
    it("should filter users by age", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").where((u) => u.age !== null && u.age >= 30),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      // Verify SQL generation
      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("age" IS NOT NULL AND "age" >= @__p1)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 30 });

      // Verify actual results
      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.age).to.be.at.least(30);
      });
    });

    it("should filter with multiple conditions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx.from("users").where((u) => u.age !== null && u.age >= 25 && u.is_active === 1),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE (("age" IS NOT NULL AND "age" >= @__p1) AND "is_active" = @__p2)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 25, __p2: 1 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.age).to.be.at.least(25);
        expect(user.is_active).to.equal(1);
      });
    });

    it("should filter with OR conditions", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx.from("users").where((u) => (u.age !== null && u.age < 30) || u.department_id === 4),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE (("age" IS NOT NULL AND "age" < @__p1) OR "department_id" = @__p2)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 30, __p2: 4 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect((user.age !== null && user.age < 30) || user.department_id === 4).to.be.true;
      });
    });

    it("should filter with parameters", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        schema,
        (ctx, params, _helpers) =>
          ctx.from("users").where((u) => u.age !== null && u.age >= params.minAge),
        { minAge: 35 },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("age" IS NOT NULL AND "age" >= @minAge)',
      );
      expect(capturedSql!.params).to.deep.equal({ minAge: 35 });

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((user) => {
        expect(user.age).to.be.at.least(35);
      });
    });
  });

  describe("ORDER BY", () => {
    it("should order users by name", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").orderBy((u) => u.name),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" ORDER BY "name" ASC');
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(1);
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.name >= results[i - 1]!.name).to.be.true;
      }
    });

    it("should order users by age descending", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx
            .from("users")
            .where((u) => u.age !== null)
            .orderByDescending((u) => u.age!),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE "age" IS NOT NULL ORDER BY "age" DESC',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(1);
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.age! <= results[i - 1]!.age!).to.be.true;
      }
    });

    it("should order with multiple columns", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx
            .from("users")
            .where((u) => u.age !== null && u.department_id !== null)
            .orderBy((u) => u.department_id!)
            .thenByDescending((u) => u.age!),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("age" IS NOT NULL AND "department_id" IS NOT NULL) ' +
          'ORDER BY "department_id" ASC, "age" DESC',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      let prevDept = results[0]!.department_id;
      let prevAge = results[0]!.age;

      for (let i = 1; i < results.length; i++) {
        if (results[i]!.department_id === prevDept) {
          expect(results[i]!.age! <= prevAge!).to.be.true;
        }
        prevDept = results[i]!.department_id;
        prevAge = results[i]!.age;
      }
    });

    it("should order by boolean column ascending", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").orderBy((u) => u.is_active),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" ORDER BY "is_active" ASC');
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);

      // Verify ordering: inactive (0) should come before active (1)
      let foundActive = false;
      for (const user of results) {
        if (user.is_active === 1) {
          foundActive = true;
        } else if (foundActive) {
          // If we found an inactive user after an active one, ordering is wrong
          expect.fail("Inactive user found after active user - ordering incorrect");
        }
      }
    });

    it("should order by boolean column descending", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").orderByDescending((u) => u.is_active),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" ORDER BY "is_active" DESC');
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);

      // Verify ordering: active (1) should come before inactive (0)
      let foundInactive = false;
      for (const user of results) {
        if (user.is_active === 0) {
          foundInactive = true;
        } else if (foundInactive) {
          // If we found an active user after an inactive one, ordering is wrong
          expect.fail("Active user found after inactive user - ordering incorrect");
        }
      }
    });

    it("should order by boolean then by string", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx
            .from("users")
            .orderBy((u) => u.is_active)
            .thenBy((u) => u.name),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" ORDER BY "is_active" ASC, "name" ASC',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);

      // Verify ordering: within each is_active group, names should be sorted
      let prevActive = results[0]!.is_active;
      let prevName = results[0]!.name;

      for (let i = 1; i < results.length; i++) {
        const curr = results[i]!;
        if (curr.is_active === prevActive) {
          // Within same is_active value, names should be ascending
          expect(curr.name >= prevName).to.be.true;
        } else {
          // is_active should be ascending (0 before 1)
          expect(curr.is_active).to.be.greaterThan(prevActive);
        }
        prevActive = curr.is_active;
        prevName = curr.name;
      }
    });
  });

  describe("LIMIT and OFFSET", () => {
    it("should limit results", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) => ctx.from("users").take(5),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" LIMIT @__p1');
      expect(capturedSql!.params).to.deep.equal({ __p1: 5 });

      expect(results).to.have.lengthOf(5);
    });

    it("should skip results", () => {
      const allResults = executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx.from("users").orderBy((u) => u.id),
      );

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const skippedResults = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx
            .from("users")
            .orderBy((u) => u.id)
            .skip(3),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" ORDER BY "id" ASC LIMIT -1 OFFSET @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 3 });

      expect(skippedResults[0]!.id).to.equal(allResults[3]!.id);
    });

    it("should paginate results", () => {
      const page1 = executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
        ctx
          .from("users")
          .orderBy((u) => u.id)
          .take(3),
      );

      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const page2 = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx
            .from("users")
            .orderBy((u) => u.id)
            .skip(3)
            .take(3),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" ORDER BY "id" ASC LIMIT @__p2 OFFSET @__p1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 3, __p2: 3 });

      expect(page1).to.have.lengthOf(3);
      expect(page2).to.have.lengthOf(3);
      expect(page1[0]!.id).to.not.equal(page2[0]!.id);
    });
  });

  describe("DISTINCT", () => {
    it("should return distinct department IDs", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelectSimple(
        db,
        schema,
        (ctx, _params, _helpers) =>
          ctx
            .from("users")
            .select((u) => ({ department_id: u.department_id }))
            .distinct(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT DISTINCT "department_id" AS "department_id" FROM "users"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      const uniqueDepts = new Set(results.map((r) => r.department_id));
      expect(results.length).to.equal(uniqueDepts.size);
    });
  });
});
