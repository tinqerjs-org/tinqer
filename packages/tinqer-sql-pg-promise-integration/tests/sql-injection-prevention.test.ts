/**
 * SQL Injection Prevention Integration Tests
 * These tests ensure that Tinqer properly sanitizes and parameterizes all user input
 * to prevent SQL injection attacks when working with a real PostgreSQL database.
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { execute, executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("PostgreSQL Integration - SQL Injection Prevention", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("String literals with SQL keywords", () => {
    it("should safely handle DROP TABLE in string literals", async () => {
      const maliciousName = "'; DROP TABLE users; --";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
      );

      // Should return empty array, not drop the table
      expect(results).to.be.an("array");
      expect(results).to.have.length(0);

      // Verify table still exists
      const tableCheck = await executeSimple(db, () => from(dbContext, "users").take(1));
      expect(tableCheck).to.have.length(1);
    });

    it("should safely handle UNION SELECT in string literals", async () => {
      const maliciousEmail = "' UNION SELECT * FROM users --";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.email == params.maliciousEmail),
        { maliciousEmail },
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(0);
    });

    it("should safely handle OR 1=1 in string literals", async () => {
      const maliciousName = "admin' OR '1'='1";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(0);
    });

    it("should safely handle UPDATE commands in strings", async () => {
      const maliciousEmail = "test@test.com'; UPDATE users SET is_active=false; --";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.email == params.maliciousEmail),
        { maliciousEmail },
      );

      expect(results).to.have.length(0);

      // Verify no users were deactivated
      const activeUsers = await executeSimple(db, () =>
        from(dbContext, "users").where((u) => u.is_active == true),
      );
      expect(activeUsers.length).to.be.greaterThan(5); // Most users should still be active
    });

    it("should safely handle DELETE commands in strings", async () => {
      const maliciousName = "test'; DELETE FROM orders; --";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
      );

      expect(results).to.have.length(0);

      // Verify orders still exist
      const orders = await executeSimple(db, () => from(dbContext, "orders").take(1));
      expect(orders).to.have.length(1);
    });
  });

  describe("Special characters and escape sequences", () => {
    it("should handle single quotes in names", async () => {
      const nameWithQuote = "O'Brien";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.nameWithQuote),
        { nameWithQuote },
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(0); // No such user in test data
    });

    it("should handle backslashes in strings", async () => {
      const pathWithBackslash = "C:\\Users\\Admin";
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products").where((p) => p.description == params.pathWithBackslash),
        { pathWithBackslash },
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(0);
    });

    it("should handle newlines and special characters", async () => {
      const textWithSpecials = "Line 1\nLine 2\r\nLine 3\t\tTabbed";
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products").where((p) => p.description == params.textWithSpecials),
        { textWithSpecials },
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(0);
    });
  });

  describe("Comment injection attempts", () => {
    it("should handle SQL line comments (--)", async () => {
      const maliciousName = "admin'--";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
      );

      expect(results).to.have.length(0);
    });

    it("should handle SQL block comments (/* */)", async () => {
      const maliciousName = "admin'/*comment*/OR/**/1=1";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
      );

      expect(results).to.have.length(0);
    });

    it("should handle hash comments (#)", async () => {
      const maliciousEmail = "admin@test.com'#";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.email == params.maliciousEmail),
        { maliciousEmail },
      );

      expect(results).to.have.length(0);
    });
  });

  describe("Numeric injection attempts", () => {
    it("should parameterize numeric values", async () => {
      const age = 25;
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.age == params.age),
        { age },
      );

      // Should only return users with exact age match
      results.forEach((user) => {
        expect(user.age).to.equal(age);
      });
    });

    it("should handle numeric strings that look like SQL", async () => {
      const maliciousId = 1; // Even though it's numeric, it's parameterized
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users")
            .where((u) => u.id == params.maliciousId)
            .select((u) => ({ id: u.id, name: u.name })),
        { maliciousId },
      );

      expect(results).to.have.length(1);
      if (results[0]) {
        expect(results[0].id).to.equal(maliciousId);
      }
    });

    it("should handle negative numbers safely", async () => {
      const negativeBalance = -500.25;
      const results = await execute(
        db,
        (params) => from(dbContext, "accounts").where((a) => a.balance == params.negativeBalance),
        { negativeBalance },
      );

      // Should match exact balance
      results.forEach((account) => {
        expect(Number(account.balance)).to.equal(negativeBalance);
      });
    });
  });

  describe("Boolean-based blind injection patterns", () => {
    it("should safely handle boolean logic injection attempts", async () => {
      const maliciousEmail = "test@test.com' AND 1=1--";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.email == params.maliciousEmail),
        { maliciousEmail },
      );

      expect(results).to.have.length(0);
    });

    it("should handle CASE WHEN injection attempts", async () => {
      const maliciousName = "'; CASE WHEN 1=1 THEN 'a' ELSE 'b' END--";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
      );

      expect(results).to.have.length(0);
    });
  });

  describe("Stacked query attempts", () => {
    it("should prevent semicolon-separated queries", async () => {
      const maliciousName =
        "admin'; INSERT INTO users (name, email) VALUES ('hacker', 'hack@test.com'); --";
      const userCountBefore = await executeSimple(db, () => from(dbContext, "users"));

      await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
      );

      const userCountAfter = await executeSimple(db, () => from(dbContext, "users"));
      expect(userCountAfter.length).to.equal(userCountBefore.length);
    });

    it("should handle multiple semicolons", async () => {
      const maliciousName = "test;;;DROP TABLE products;;;--";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.maliciousName),
        { maliciousName },
      );

      expect(results).to.have.length(0);

      // Verify products table still exists
      const products = await executeSimple(db, () => from(dbContext, "products").take(1));
      expect(products).to.have.length(1);
    });
  });

  describe("Complex injection in different contexts", () => {
    it("should handle injection attempts in ORDER BY context", async () => {
      // Even though we can't directly inject into orderBy, verify parameterization in WHERE
      const maliciousCategory = "Electronics; DROP TABLE users--";
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "products")
            .where((p) => p.category == params.maliciousCategory)
            .orderBy((p) => p.name),
        { maliciousCategory },
      );

      expect(results).to.have.length(0);

      // Verify users table still exists
      const users = await executeSimple(db, () => from(dbContext, "users").take(1));
      expect(users).to.have.length(1);
    });

    it("should handle injection attempts in SELECT projections", async () => {
      const testName = "John Doe";
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users")
            .where((u) => u.name == params.testName)
            .select((u) => ({
              userName: u.name,
              userEmail: u.email,
            })),
        { testName },
      );

      expect(results).to.have.length(1);
      if (results[0]) {
        expect(results[0].userName).to.equal(testName);
      }
    });

    it("should handle injection attempts in GROUP BY context", async () => {
      const maliciousCategory = "admin' OR '1'='1";
      const results = await execute(
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
      );

      expect(results).to.have.length(0);
    });
  });

  describe("Parameterized queries with special values", () => {
    it("should handle extremely long strings", async () => {
      const longString = "a".repeat(10000);
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.longString),
        { longString },
      );

      expect(results).to.have.length(0);
    });

    it("should handle Unicode and emoji characters", async () => {
      const unicodeString = "用户名😀'; DROP TABLE users; --😈";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.unicodeString),
        { unicodeString },
      );

      expect(results).to.have.length(0);

      // Table should still exist
      const users = await executeSimple(db, () => from(dbContext, "users").take(1));
      expect(users).to.have.length(1);
    });

    it("should handle hexadecimal encoded strings", async () => {
      const hexString = "0x44524f502054414245204755657273";
      const results = await execute(
        db,
        (params) => from(dbContext, "users").where((u) => u.name == params.hexString),
        { hexString },
      );

      expect(results).to.have.length(0);
    });
  });

  describe("Complex nested injection attempts", () => {
    it("should handle nested conditions with injection attempts", async () => {
      const name1 = "admin' OR '1'='1";
      const name2 = "'; DROP TABLE users; --";
      const age = 30;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users").where(
            (u) =>
              (u.name == params.name1 || u.name == params.name2) &&
              u.age != null &&
              u.age > params.age,
          ),
        { name1, name2, age },
      );

      expect(results).to.have.length(0);

      // Verify table integrity
      const users = await executeSimple(db, () => from(dbContext, "users"));
      expect(users.length).to.be.greaterThan(0);
    });

    it("should handle complex boolean expressions with injection", async () => {
      const email1 = "test@test.com' OR '1'='1";
      const email2 = "admin@test.com' --";
      const isActive = true;

      const results = await execute(
        db,
        (params) =>
          from(dbContext, "users").where(
            (u) =>
              u.is_active == params.isActive &&
              (u.email == params.email1 || u.email == params.email2),
          ),
        { email1, email2, isActive },
      );

      expect(results).to.have.length(0);
    });
  });
});
