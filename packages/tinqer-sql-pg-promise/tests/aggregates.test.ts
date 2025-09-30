/**
 * Tests for aggregate function generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { db, from } from "./test-schema.js";

describe("Aggregate SQL Generation", () => {
  describe("COUNT", () => {
    it("should generate COUNT(*)", () => {
      const result = query(() => from(db, "users").count(), {});

      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users"');
    });

    it("should generate COUNT with WHERE", () => {
      const result = query(
        () =>
          from(db, "users")
            .where((x) => x.isActive)
            .count(),
        {},
      );

      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users" WHERE "isActive"');
    });
  });

  describe("SUM", () => {
    it("should generate SUM", () => {
      const result = query(() => from(db, "orders").sum((x) => x.total), {});

      expect(result.sql).to.equal('SELECT SUM("total") FROM "orders"');
    });
  });

  describe("AVG", () => {
    it("should generate AVG", () => {
      const result = query(() => from(db, "products").average((x) => x.price), {});

      expect(result.sql).to.equal('SELECT AVG("price") FROM "products"');
    });
  });

  describe("MIN", () => {
    it("should generate MIN", () => {
      const result = query(() => from(db, "users").min((x) => x.age), {});

      expect(result.sql).to.equal('SELECT MIN("age") FROM "users"');
    });
  });

  describe("MAX", () => {
    it("should generate MAX", () => {
      const result = query(() => from(db, "employees").max((x) => x.salary), {});

      expect(result.sql).to.equal('SELECT MAX("salary") FROM "employees"');
    });
  });
});
