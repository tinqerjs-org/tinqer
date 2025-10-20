/**
 * Tests for aggregate function generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("Aggregate SQL Generation", () => {
  describe("COUNT", () => {
    it("should generate COUNT(*)", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").count()),
        {},
      );

      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users"');
    });

    it("should generate COUNT with WHERE", () => {
      const result = toSql(
        defineSelect(
          schema,
          (q) =>
            q
              .from("users")
              .where((x) => x.isActive)
              .count(),
        ),
        {},
      );

      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users" WHERE "isActive"');
    });
  });

  describe("SUM", () => {
    it("should generate SUM", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("orders").sum((x) => x.total)),
        {},
      );

      expect(result.sql).to.equal('SELECT SUM("total") FROM "orders"');
    });
  });

  describe("AVG", () => {
    it("should generate AVG", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("products").average((x) => x.price)),
        {},
      );

      expect(result.sql).to.equal('SELECT AVG("price") FROM "products"');
    });
  });

  describe("MIN", () => {
    it("should generate MIN", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").min((x) => x.age)),
        {},
      );

      expect(result.sql).to.equal('SELECT MIN("age") FROM "users"');
    });
  });

  describe("MAX", () => {
    it("should generate MAX", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("employees").max((x) => x.salary)),
        {},
      );

      expect(result.sql).to.equal('SELECT MAX("salary") FROM "employees"');
    });
  });
});
