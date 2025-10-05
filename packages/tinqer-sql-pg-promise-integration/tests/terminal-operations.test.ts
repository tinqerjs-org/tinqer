/**
 * Terminal operation integration tests with real PostgreSQL
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { executeSelect, executeSelectSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("PostgreSQL Integration - Terminal Operations", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("first() and firstOrDefault()", () => {
    it("should return first user", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const user = await executeSelectSimple(
        db,
        (ctx) =>
          ctx.from("users")
            .orderBy((u) => u.id)
            .first(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" ORDER BY "id" ASC LIMIT 1');
      expect(capturedSql!.params).to.deep.equal({});

      expect(user).to.be.an("object");
      expect(user).to.have.property("id");
      expect(user).to.have.property("name");
      expect(user.id).to.equal(1);
    });

    it("should return first user matching condition", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const user = await executeSelectSimple(
        db,
        () => from(dbContext, "users").first((u) => u.age !== null && u.age > 40),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("age" IS NOT NULL AND "age" > $(__p1)) LIMIT 1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 40 });

      expect(user).to.be.an("object");
      expect(user.age).to.be.greaterThan(40);
    });

    it("should throw error when no match for first()", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      try {
        await executeSelectSimple(
          db,
          () => from(dbContext, "users").first((u) => u.age !== null && u.age > 100),
          {
            onSql: (result) => {
              capturedSql = result;
            },
          },
        );
        expect.fail("Should have thrown error");
      } catch (error: unknown) {
        expect(capturedSql).to.exist;
        expect(capturedSql!.sql).to.equal(
          'SELECT * FROM "users" WHERE ("age" IS NOT NULL AND "age" > $(__p1)) LIMIT 1',
        );
        expect(capturedSql!.params).to.deep.equal({ __p1: 100 });

        expect((error as Error).message).to.include("No elements found");
      }
    });

    it("should return null for firstOrDefault() when no match", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const user = await executeSelectSimple(
        db,
        () => from(dbContext, "users").firstOrDefault((u) => u.age !== null && u.age > 100),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("age" IS NOT NULL AND "age" > $(__p1)) LIMIT 1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 100 });

      expect(user).to.be.null;
    });

    it("should work with complex queries", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const result = await executeSelectSimple(
        db,
        (ctx) =>
          ctx.from("users")
            .join(
              from(dbContext, "departments"),
              (u) => u.department_id,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .where((joined) => joined.u.is_active === true)
            .orderBy((joined) => joined.u.age!)
            .select((joined) => ({
              userName: joined.u.name,
              departmentName: joined.d.name,
              age: joined.u.age,
            }))
            .first(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."name" AS "userName", "t1"."name" AS "departmentName", "t0"."age" AS "age" ' +
          'FROM "users" AS "t0" INNER JOIN "departments" AS "t1" ON "t0"."department_id" = "t1"."id" ' +
          'WHERE "t0"."is_active" = $(__p1) ORDER BY "t0"."age" ASC LIMIT 1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: true });

      expect(result).to.be.an("object");
      expect(result).to.have.property("userName");
      expect(result).to.have.property("departmentName");
      expect(result).to.have.property("age");
    });
  });

  describe("single() and singleOrDefault()", () => {
    it("should return single user by unique email", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const user = await executeSelectSimple(
        db,
        () => from(dbContext, "users").single((u) => u.email === "john@example.com"),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" = $(__p1) LIMIT 2');
      expect(capturedSql!.params).to.deep.equal({ __p1: "john@example.com" });

      expect(user).to.be.an("object");
      expect(user.name).to.equal("John Doe");
    });

    it("should throw error when multiple matches for single()", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      try {
        await executeSelectSimple(
          db,
          () => from(dbContext, "users").single((u) => u.department_id === 1),
          {
            onSql: (result) => {
              capturedSql = result;
            },
          },
        );
        expect.fail("Should have thrown error");
      } catch (error: unknown) {
        expect(capturedSql).to.exist;
        expect(capturedSql!.sql).to.equal(
          'SELECT * FROM "users" WHERE "department_id" = $(__p1) LIMIT 2',
        );
        expect(capturedSql!.params).to.deep.equal({ __p1: 1 });

        expect((error as Error).message).to.include("Multiple elements found");
      }
    });

    it("should throw error when no match for single()", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      try {
        await executeSelectSimple(
          db,
          () => from(dbContext, "users").single((u) => u.email === "nonexistent@example.com"),
          {
            onSql: (result) => {
              capturedSql = result;
            },
          },
        );
        expect.fail("Should have thrown error");
      } catch (error: unknown) {
        expect(capturedSql).to.exist;
        expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" = $(__p1) LIMIT 2');
        expect(capturedSql!.params).to.deep.equal({ __p1: "nonexistent@example.com" });

        expect((error as Error).message).to.include("No elements found");
      }
    });

    it("should return null for singleOrDefault() when no match", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const user = await executeSelectSimple(
        db,
        (ctx) =>
          ctx.from("users").singleOrDefault((u) => u.email === "nonexistent@example.com"),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" = $(__p1) LIMIT 2');
      expect(capturedSql!.params).to.deep.equal({ __p1: "nonexistent@example.com" });

      expect(user).to.be.null;
    });

    it("should throw error for singleOrDefault() with multiple matches", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      try {
        await executeSelectSimple(
          db,
          () => from(dbContext, "users").singleOrDefault((u) => u.department_id === 1),
          {
            onSql: (result) => {
              capturedSql = result;
            },
          },
        );
        expect.fail("Should have thrown error");
      } catch (error: unknown) {
        expect(capturedSql).to.exist;
        expect(capturedSql!.sql).to.equal(
          'SELECT * FROM "users" WHERE "department_id" = $(__p1) LIMIT 2',
        );
        expect(capturedSql!.params).to.deep.equal({ __p1: 1 });

        expect((error as Error).message).to.include("Multiple elements found");
      }
    });
  });

  describe("last() and lastOrDefault()", () => {
    it("should return last user", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const user = await executeSelectSimple(
        db,
        (ctx) =>
          ctx.from("users")
            .orderBy((u) => u.id)
            .last(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" ORDER BY "id" DESC LIMIT 1');
      expect(capturedSql!.params).to.deep.equal({});

      expect(user).to.be.an("object");
      expect(user.id).to.equal(10); // Henry Ford is the last inserted
    });

    it("should return last user matching condition", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const user = await executeSelectSimple(
        db,
        (ctx) =>
          ctx.from("users")
            .where((u) => u.department_id === 1)
            .orderBy((u) => u.name)
            .last(),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE "department_id" = $(__p1) ORDER BY "name" DESC LIMIT 1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 1 });

      expect(user).to.be.an("object");
      expect(user.department_id).to.equal(1);
    });

    it("should return null for lastOrDefault() when no match", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const user = await executeSelectSimple(
        db,
        () => from(dbContext, "users").lastOrDefault((u) => u.age !== null && u.age > 100),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("age" IS NOT NULL AND "age" > $(__p1)) ORDER BY 1 DESC LIMIT 1',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 100 });

      expect(user).to.be.null;
    });
  });

  describe("any() and all()", () => {
    it("should return true when any user matches condition", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const hasYoungUsers = await executeSelectSimple(
        db,
        () => from(dbContext, "users").any((u) => u.age !== null && u.age < 30),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" WHERE ("age" IS NOT NULL AND "age" < $(__p1))) THEN 1 ELSE 0 END',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 30 });

      expect(hasYoungUsers).to.be.true;
    });

    it("should return false when no user matches condition", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const hasCentenarians = await executeSelectSimple(
        db,
        () => from(dbContext, "users").any((u) => u.age !== null && u.age > 100),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" WHERE ("age" IS NOT NULL AND "age" > $(__p1))) THEN 1 ELSE 0 END',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 100 });

      expect(hasCentenarians).to.be.false;
    });

    it("should return true when any() is called without predicate on non-empty table", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const hasUsers = await executeSelectSimple(db, () => from(dbContext, "users").any(), {
        onSql: (result) => {
          capturedSql = result;
        },
      });

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "users") THEN 1 ELSE 0 END',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(hasUsers).to.be.true;
    });

    it("should check if all users match condition", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const allHaveEmail = await executeSelectSimple(
        db,
        () => from(dbContext, "users").all((u) => u.email !== null),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" WHERE NOT ("email" IS NOT NULL)) THEN 1 ELSE 0 END',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(allHaveEmail).to.be.true;
    });

    it("should return false when not all match condition", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const allActive = await executeSelectSimple(
        db,
        () => from(dbContext, "users").all((u) => u.is_active === true),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" WHERE NOT ("is_active" = $(__p1))) THEN 1 ELSE 0 END',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: true });

      expect(allActive).to.be.false; // Some users are inactive
    });

    it("should work with WHERE clause", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const allEngineersActive = await executeSelectSimple(
        db,
        (ctx) =>
          ctx.from("users")
            .where((u) => u.department_id === 1)
            .all((u) => u.is_active === true),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" WHERE "department_id" = $(__p1) AND NOT ("is_active" = $(__p2))) THEN 1 ELSE 0 END',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 1, __p2: true });

      // Check the actual data to verify the result
      const engineerStatus = await executeSelectSimple(db, () =>
        from(dbContext, "users")
          .where((u) => u.department_id === 1)
          .select((u) => ({ is_active: u.is_active })),
      );

      const expectedResult = engineerStatus.every((u) => u.is_active === true);
      expect(allEngineersActive).to.equal(expectedResult);
    });
  });

  describe("toArray() and toList()", () => {
    it("should return array of results", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const users = await executeSelectSimple(
        db,
        (ctx) =>
          ctx.from("users")
            .where((u) => u.is_active === true)
            .orderBy((u) => u.name),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE "is_active" = $(__p1) ORDER BY "name" ASC',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: true });

      expect(users).to.be.an("array");
      expect(users.length).to.be.greaterThan(0);
      users.forEach((user) => {
        expect(user.is_active).to.be.true;
      });
    });

    it("should return list of results", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const products = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "products")
            .where((p) => p.stock > 50)
            .orderByDescending((p) => p.price),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "stock" > $(__p1) ORDER BY "price" DESC',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 50 });

      expect(products).to.be.an("array");
      products.forEach((product) => {
        expect(product.stock).to.be.greaterThan(50);
      });

      // Verify descending order
      for (let i = 1; i < products.length; i++) {
        expect(products[i - 1]!.price).to.be.at.least(products[i]!.price);
      }
    });
  });

  describe("Complex terminal operation scenarios", () => {
    it("should handle parameterized terminal operations", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const targetEmail = "jane@example.com";
      const user = await executeSelect(
        db,
        (params) => from(dbContext, "users").single((u) => u.email === params.email),
        { email: targetEmail },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" = $(email) LIMIT 2');
      expect(capturedSql!.params).to.deep.equal({ email: targetEmail });

      expect(user).to.be.an("object");
      expect(user.email).to.equal(targetEmail);
      expect(user.name).to.equal("Jane Smith");
    });

    it("should check product availability", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const hasExpensiveElectronics = await executeSelectSimple(
        db,
        () => from(dbContext, "products").any((p) => p.category === "Electronics" && p.price > 500),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT CASE WHEN EXISTS(SELECT 1 FROM "products" WHERE ("category" = $(__p1) AND "price" > $(__p2))) THEN 1 ELSE 0 END',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "Electronics", __p2: 500 });

      expect(hasExpensiveElectronics).to.be.true; // Laptop is $999.99
    });

    it("should verify all completed orders have positive totals", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const allPositive = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "orders")
            .where((o) => o.status === "completed")
            .all((o) => o.total_amount > 0),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "orders" WHERE "status" = $(__p1) AND NOT ("total_amount" > $(__p2))) THEN 1 ELSE 0 END',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: "completed", __p2: 0 });

      expect(allPositive).to.be.true;
    });
  });
});
