/**
 * NULL Handling SQL Generation Tests
 * Verifies that NULL comparisons generate correct IS NULL / IS NOT NULL
 */

import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("NULL Handling", () => {
  describe("IS NULL generation", () => {
    it("should generate IS NULL for == null comparison", () => {
      const result = selectStatement(
        schema,
        (q) => q.from("users").where((u) => u.email == null),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" IS NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NULL for === null comparison", () => {
      const result = selectStatement(
        schema,
        (q) => q.from("users").where((u) => u.email === null),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" IS NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NULL with null on left side", () => {
      const result = selectStatement(
        schema,
        (q) => q.from("users").where((u) => null == u.name),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "name" IS NULL');
      expect(result.params).to.deep.equal({});
    });
  });

  describe("IS NOT NULL generation", () => {
    it("should generate IS NOT NULL for != null comparison", () => {
      const result = selectStatement(
        schema,
        (q) => q.from("users").where((u) => u.email != null),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" IS NOT NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NOT NULL for !== null comparison", () => {
      const result = selectStatement(
        schema,
        (q) => q.from("users").where((u) => u.email !== null),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" IS NOT NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NOT NULL with null on left side", () => {
      const result = selectStatement(
        schema,
        (q) => q.from("users").where((u) => null != u.name),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "name" IS NOT NULL');
      expect(result.params).to.deep.equal({});
    });
  });

  describe("Complex NULL conditions", () => {
    it("should handle NULL checks with AND", () => {
      const result = selectStatement(
        schema,
        (q) => q.from("users").where((u) => u.name != null && u.email == null),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("name" IS NOT NULL AND "email" IS NULL)',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should handle NULL checks with OR", () => {
      const result = selectStatement(
        schema,
        (q) => q.from("users").where((u) => u.email == null || u.phone == null),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("email" IS NULL OR "phone" IS NULL)',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should handle NULL checks in complex conditions", () => {
      const result = selectStatement(
        schema,
        (q) => q.from("users").where((u) => u.id > 10 && u.email != null),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("id" > @__p1 AND "email" IS NOT NULL)',
      );
      expect(result.params).to.deep.equal({ __p1: 10 });
    });
  });
});
