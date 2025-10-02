/**
 * SQL Injection Prevention Integration Tests
 * These tests ensure that Tinqer properly sanitizes and parameterizes all user input
 * to prevent SQL injection attacks when working with a real PostgreSQL database.
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSelect, executeSelectSimple } from "@webpods/tinqer-sql-better-sqlite3";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("Better SQLite3 Integration - SQL Injection Prevention", () => {
  before(() => {
    setupTestDatabase(db);
  });

  describe("String literals with SQL keywords", () => {
    it("should safely handle DROP TABLE in string literals", () => {
      const maliciousName = "'; DROP TABLE users; --";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @maliciousName');
      expect(capturedSql!.params).to.deep.equal({ maliciousName });
      // Should return empty array, not drop the table
      expect(results).to.be.an("array");
      expect(results).to.have.length(0);

      // Verify table still exists
      let tableCheckSql: { sql: string; params: Record<string, unknown> } | undefined;
      const tableCheck = executeSelectSimple(db, () => from(dbContext, "users").take(1), {
        onSql: (result) => {
          tableCheckSql = result;
        },
      });
      expect(tableCheckSql).to.exist;
      expect(tableCheckSql!.sql).to.equal('SELECT * FROM "users" LIMIT @__p1');
      expect(tableCheckSql!.params).to.deep.equal({ __p1: 1 });
      expect(tableCheck).to.have.length(1);
    });

    it("should safely handle UNION SELECT in string literals", () => {
      const maliciousEmail = "' UNION SELECT * FROM users --";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.email == params.maliciousEmail),
        { maliciousEmail },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" = @maliciousEmail');
      expect(capturedSql!.params).to.deep.equal({ maliciousEmail });
      expect(results).to.be.an("array");
      expect(results).to.have.length(0);
    });

    it("should safely handle OR 1=1 in string literals", () => {
      const maliciousName = "admin' OR '1'='1";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @maliciousName');
      expect(capturedSql!.params).to.deep.equal({ maliciousName });
      expect(results).to.be.an("array");
      expect(results).to.have.length(0);
    });

    it("should safely handle UPDATE commands in strings", () => {
      const maliciousEmail = "test@test.com'; UPDATE users SET is_active=false; --";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.email == params.maliciousEmail),
        { maliciousEmail },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" = @maliciousEmail');
      expect(capturedSql!.params).to.deep.equal({ maliciousEmail });
      expect(results).to.have.length(0);

      // Verify no users were deactivated
      let activeUsersSql: { sql: string; params: Record<string, unknown> } | undefined;
      const activeUsers = executeSelectSimple(
        db,
        () => from(dbContext, "users").where((u) => u.is_active === 1),
        {
          onSql: (result) => {
            activeUsersSql = result;
          },
        },
      );
      expect(activeUsersSql).to.exist;
      expect(activeUsersSql!.sql).to.equal('SELECT * FROM "users" WHERE "is_active" = @__p1');
      expect(activeUsersSql!.params).to.deep.equal({ __p1: 1 });
      expect(activeUsers.length).to.be.greaterThan(5); // Most users should still be active
    });

    it("should safely handle DELETE commands in strings", () => {
      const maliciousName = "test'; DELETE FROM orders; --";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @maliciousName');
      expect(capturedSql!.params).to.deep.equal({ maliciousName });
      expect(results).to.have.length(0);

      // Verify orders still exist
      let ordersSql: { sql: string; params: Record<string, unknown> } | undefined;
      const orders = executeSelectSimple(db, () => from(dbContext, "orders").take(1), {
        onSql: (result) => {
          ordersSql = result;
        },
      });
      expect(ordersSql).to.exist;
      expect(ordersSql!.sql).to.equal('SELECT * FROM "orders" LIMIT @__p1');
      expect(ordersSql!.params).to.deep.equal({ __p1: 1 });
      expect(orders).to.have.length(1);
    });
  });

  describe("Special characters and escape sequences", () => {
    it("should handle single quotes in names", () => {
      const nameWithQuote = "O'Brien";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.nameWithQuote),
        { nameWithQuote },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @nameWithQuote');
      expect(capturedSql!.params).to.deep.equal({ nameWithQuote });
      expect(results).to.be.an("array");
      expect(results).to.have.length(0); // No such user in test data
    });

    it("should handle backslashes in strings", () => {
      const pathWithBackslash = "C:\\Users\\Admin";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) =>
          from(dbContext, "products").where((p) => p.description == params.pathWithBackslash),
        { pathWithBackslash },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "description" = @pathWithBackslash',
      );
      expect(capturedSql!.params).to.deep.equal({ pathWithBackslash });
      expect(results).to.be.an("array");
      expect(results).to.have.length(0);
    });

    it("should handle newlines and special characters", () => {
      const textWithSpecials = "Line 1\nLine 2\r\nLine 3\t\tTabbed";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) =>
          from(dbContext, "products").where((p) => p.description == params.textWithSpecials),
        { textWithSpecials },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "description" = @textWithSpecials',
      );
      expect(capturedSql!.params).to.deep.equal({ textWithSpecials });
      expect(results).to.be.an("array");
      expect(results).to.have.length(0);
    });
  });

  describe("Comment injection attempts", () => {
    it("should handle SQL line comments (--)", () => {
      const maliciousName = "admin'--";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @maliciousName');
      expect(capturedSql!.params).to.deep.equal({ maliciousName });
      expect(results).to.have.length(0);
    });

    it("should handle SQL block comments (/* */)", () => {
      const maliciousName = "admin'/*comment*/OR/**/1=1";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @maliciousName');
      expect(capturedSql!.params).to.deep.equal({ maliciousName });
      expect(results).to.have.length(0);
    });

    it("should handle hash comments (#)", () => {
      const maliciousEmail = "admin@test.com'#";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.email == params.maliciousEmail),
        { maliciousEmail },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" = @maliciousEmail');
      expect(capturedSql!.params).to.deep.equal({ maliciousEmail });
      expect(results).to.have.length(0);
    });
  });

  describe("Numeric injection attempts", () => {
    it("should parameterize numeric values", () => {
      const age = 25;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.age == params.age),
        { age },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "age" = @age');
      expect(capturedSql!.params).to.deep.equal({ age });
      // Should only return users with exact age match
      results.forEach((user) => {
        expect(user.age).to.equal(age);
      });
    });

    it("should handle numeric strings that look like SQL", () => {
      const maliciousId = 1; // Even though it's numeric, it's parameterized
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) =>
          from(dbContext, "users")
            .where((u) => u.id == params.maliciousId)
            .select((u) => ({ id: u.id, name: u.name })),
        { maliciousId },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE "id" = @maliciousId',
      );
      expect(capturedSql!.params).to.deep.equal({ maliciousId });
      expect(results).to.have.length(1);
      if (results[0]) {
        expect(results[0].id).to.equal(maliciousId);
      }
    });

    it("should handle negative numbers safely", () => {
      const negativeBalance = -500.25;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "accounts").where((a) => a.balance == params.negativeBalance),
        { negativeBalance },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "accounts" WHERE "balance" = @negativeBalance',
      );
      expect(capturedSql!.params).to.deep.equal({ negativeBalance });
      // Should match exact balance
      results.forEach((account) => {
        expect(Number(account.balance)).to.equal(negativeBalance);
      });
    });
  });

  describe("Boolean-based blind injection patterns", () => {
    it("should safely handle boolean logic injection attempts", () => {
      const maliciousEmail = "test@test.com' AND 1=1--";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.email == params.maliciousEmail),
        { maliciousEmail },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" = @maliciousEmail');
      expect(capturedSql!.params).to.deep.equal({ maliciousEmail });
      expect(results).to.have.length(0);
    });

    it("should handle CASE WHEN injection attempts", () => {
      const maliciousName = "'; CASE WHEN 1=1 THEN 'a' ELSE 'b' END--";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @maliciousName');
      expect(capturedSql!.params).to.deep.equal({ maliciousName });
      expect(results).to.have.length(0);
    });
  });

  describe("Stacked query attempts", () => {
    it("should prevent semicolon-separated queries", () => {
      const maliciousName =
        "admin'; INSERT INTO users (name, email) VALUES ('hacker', 'hack@test.com'); --";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const userCountBefore = executeSelectSimple(db, () => from(dbContext, "users"));

      executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @maliciousName');
      expect(capturedSql!.params).to.deep.equal({ maliciousName });

      const userCountAfter = executeSelectSimple(db, () => from(dbContext, "users"));
      expect(userCountAfter.length).to.equal(userCountBefore.length);
    });

    it("should handle multiple semicolons", () => {
      const maliciousName = "test;;;DROP TABLE products;;;--";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @maliciousName');
      expect(capturedSql!.params).to.deep.equal({ maliciousName });
      expect(results).to.have.length(0);

      // Verify products table still exists
      let productsSql: { sql: string; params: Record<string, unknown> } | undefined;
      const products = executeSelectSimple(db, () => from(dbContext, "products").take(1), {
        onSql: (result) => {
          productsSql = result;
        },
      });
      expect(productsSql).to.exist;
      expect(productsSql!.sql).to.equal('SELECT * FROM "products" LIMIT @__p1');
      expect(productsSql!.params).to.deep.equal({ __p1: 1 });
      expect(products).to.have.length(1);
    });
  });

  describe("Complex injection in different contexts", () => {
    it("should handle injection attempts in ORDER BY context", () => {
      // Even though we can't directly inject into orderBy, verify parameterization in WHERE
      const maliciousCategory = "Electronics; DROP TABLE users--";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.category == params.maliciousCategory)
            .orderBy((p) => p.name),
        { maliciousCategory },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "products" WHERE "category" = @maliciousCategory ORDER BY "name" ASC',
      );
      expect(capturedSql!.params).to.deep.equal({ maliciousCategory });
      expect(results).to.have.length(0);

      // Verify users table still exists
      let usersSql: { sql: string; params: Record<string, unknown> } | undefined;
      const users = executeSelectSimple(db, () => from(dbContext, "users").take(1), {
        onSql: (result) => {
          usersSql = result;
        },
      });
      expect(usersSql).to.exist;
      expect(usersSql!.sql).to.equal('SELECT * FROM "users" LIMIT @__p1');
      expect(usersSql!.params).to.deep.equal({ __p1: 1 });
      expect(users).to.have.length(1);
    });

    it("should handle injection attempts in SELECT projections", () => {
      const testName = "John Doe";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) =>
          from(dbContext, "users")
            .where((u) => u.name == params.testName)
            .select((u) => ({
              userName: u.name,
              userEmail: u.email,
            })),
        { testName },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "name" AS "userName", "email" AS "userEmail" FROM "users" WHERE "name" = @testName',
      );
      expect(capturedSql!.params).to.deep.equal({ testName });
      expect(results).to.have.length(1);
      if (results[0]) {
        expect(results[0].userName).to.equal(testName);
      }
    });

    it("should handle injection attempts in GROUP BY context", () => {
      const maliciousCategory = "admin' OR '1'='1";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.category == params.maliciousCategory)
            .groupBy((p) => p.category)
            .select((g) => ({
              category: g.key,
              count: g.count(),
            })),
        { maliciousCategory },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "category" AS "category", COUNT(*) AS "count" FROM "products" WHERE "category" = @maliciousCategory GROUP BY "category"',
      );
      expect(capturedSql!.params).to.deep.equal({ maliciousCategory });
      expect(results).to.have.length(0);
    });
  });

  describe("Parameterized queries with special values", () => {
    it("should handle extremely long strings", () => {
      const longString = "a".repeat(10000);
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.longString),
        { longString },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @longString');
      expect(capturedSql!.params).to.deep.equal({ longString });
      expect(results).to.have.length(0);
    });

    it("should handle Unicode and emoji characters", () => {
      const unicodeString = "用户名😀'; DROP TABLE users; --😈";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.unicodeString),
        { unicodeString },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @unicodeString');
      expect(capturedSql!.params).to.deep.equal({ unicodeString });
      expect(results).to.have.length(0);

      // Table should still exist
      let usersSql: { sql: string; params: Record<string, unknown> } | undefined;
      const users = executeSelectSimple(db, () => from(dbContext, "users").take(1), {
        onSql: (result) => {
          usersSql = result;
        },
      });
      expect(usersSql).to.exist;
      expect(usersSql!.sql).to.equal('SELECT * FROM "users" LIMIT @__p1');
      expect(usersSql!.params).to.deep.equal({ __p1: 1 });
      expect(users).to.have.length(1);
    });

    it("should handle hexadecimal encoded strings", () => {
      const hexString = "0x44524f502054414245204755657273";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.hexString),
        { hexString },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @hexString');
      expect(capturedSql!.params).to.deep.equal({ hexString });
      expect(results).to.have.length(0);
    });
  });

  describe("Complex nested injection attempts", () => {
    it("should handle nested conditions with injection attempts", () => {
      const name1 = "admin' OR '1'='1";
      const name2 = "'; DROP TABLE users; --";
      const age = 30;
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) =>
          from(dbContext, "users").where(
            (u) =>
              (u.name == params.name1 || u.name == params.name2) &&
              u.age != null &&
              u.age > params.age,
          ),
        { name1, name2, age },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ((("name" = @name1 OR "name" = @name2) AND "age" IS NOT NULL) AND "age" > @age)',
      );
      expect(capturedSql!.params).to.deep.equal({ name1, name2, age });
      expect(results).to.have.length(0);

      // Verify table integrity
      const users = executeSelectSimple(db, () => from(dbContext, "users"));
      expect(users.length).to.be.greaterThan(0);
    });

    it("should handle complex boolean expressions with injection", () => {
      const email1 = "test@test.com' OR '1'='1";
      const email2 = "admin@test.com' --";
      const isActive = 1; // SQLite uses INTEGER (0 or 1) for boolean values
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) =>
          from(dbContext, "users").where(
            (u) =>
              u.is_active === params.isActive &&
              (u.email === params.email1 || u.email === params.email2),
          ),
        { email1, email2, isActive },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "users" WHERE ("is_active" = @isActive AND ("email" = @email1 OR "email" = @email2))',
      );
      expect(capturedSql!.params).to.deep.equal({ email1, email2, isActive });
      expect(results).to.have.length(0);
    });
  });

  describe("Binary payload injection attempts", () => {
    it("should handle NULL byte in string parameters", () => {
      const nullBytePayload = "malicious\0payload";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.nullBytePayload),
        { nullBytePayload },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @nullBytePayload');
      expect(capturedSql!.params).to.deep.equal({ nullBytePayload });
      expect(results).to.be.an("array");
      expect(results).to.have.length(0);
    });

    it("should handle UTF-16 surrogate pairs", () => {
      const surrogatePayload = "test\uD800\uDC00value"; // Valid surrogate pair
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.email == params.surrogatePayload),
        { surrogatePayload },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" = @surrogatePayload');
      expect(capturedSql!.params).to.deep.equal({ surrogatePayload });
      expect(results).to.be.an("array");
    });

    it("should handle binary-looking encoded strings", () => {
      const binaryEncoded = "\x00\x01\x02DROP TABLE users;\x03";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.binaryEncoded),
        { binaryEncoded },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "name" = @binaryEncoded');
      expect(capturedSql!.params).to.deep.equal({ binaryEncoded });
      expect(results).to.be.an("array");
      expect(results).to.have.length(0);

      // Verify table still exists
      const users = executeSelectSimple(db, () => from(dbContext, "users").take(1));
      expect(users).to.have.length(1);
    });

    it("should handle mixed binary and SQL injection attempts", () => {
      const mixedPayload = "'; DROP TABLE users;\0--";
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = executeSelect(
        db,
        (params) => from(dbContext, "users").where((u) => u.email == params.mixedPayload),
        { mixedPayload },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "email" = @mixedPayload');
      expect(capturedSql!.params).to.deep.equal({ mixedPayload });
      expect(results).to.have.length(0);

      // Verify database integrity
      const users = executeSelectSimple(db, () => from(dbContext, "users"));
      expect(users.length).to.be.greaterThan(0);
    });
  });
});
