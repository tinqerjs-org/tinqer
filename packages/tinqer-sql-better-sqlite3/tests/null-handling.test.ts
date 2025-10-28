/**
 * NULL Handling SQL Generation Tests
 * Verifies that NULL comparisons generate correct IS NULL / IS NOT NULL
 */

import { expect } from "chai";
import { defineSelect } from "@tinqerjs/tinqer";
import { toSql } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("NULL Handling", () => {
  describe("IS NULL generation", () => {
    it("should generate IS NULL for == null comparison", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((u) => u.email == null)),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" IS NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NULL for === null comparison", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((u) => u.email === null)),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" IS NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NULL with null on left side", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((u) => null == u.name)),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "name" IS NULL');
      expect(result.params).to.deep.equal({});
    });
  });

  describe("IS NOT NULL generation", () => {
    it("should generate IS NOT NULL for != null comparison", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((u) => u.email != null)),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" IS NOT NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NOT NULL for !== null comparison", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((u) => u.email !== null)),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "email" IS NOT NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NOT NULL with null on left side", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((u) => null != u.name)),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "name" IS NOT NULL');
      expect(result.params).to.deep.equal({});
    });
  });

  describe("Complex NULL conditions", () => {
    it("should handle NULL checks with AND", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q.from("users").where((u) => u.name != null && u.email == null),
        ),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("name" IS NOT NULL AND "email" IS NULL)',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should handle NULL checks with OR", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q.from("users").where((u) => u.email == null || u.phone == null),
        ),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("email" IS NULL OR "phone" IS NULL)',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should handle NULL checks in complex conditions", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((u) => u.id > 10 && u.email != null)),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("id" > @__p1 AND "email" IS NOT NULL)',
      );
      expect(result.params).to.deep.equal({ __p1: 10 });
    });
  });

  describe("Undefined comparisons", () => {
    it("should treat parameter equality against undefined as IS NULL", () => {
      const result = toSql(
        defineSelect(schema, (q, params: { role?: string }) =>
          q.from("users").where((_u) => params.role === undefined),
        ),
        { role: undefined },
      );

      expect(result.sql).to.equal('SELECT * FROM "users" WHERE @role IS NULL');
      expect(result.params).to.deep.equal({ role: undefined });
    });

    it("should allow optional guards that combine undefined checks with column comparisons", () => {
      const result = toSql(
        defineSelect(schema, (q, params: { role?: string; city?: string }) =>
          q
            .from("users")
            .where(
              (u) =>
                (params.role === undefined || u.role === params.role) &&
                (params.city === undefined || u.city === params.city),
            ),
        ),
        { role: undefined, city: "Portland" },
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ((@role IS NULL OR "role" = @role) AND (@city IS NULL OR "city" = @city))',
      );
      expect(result.params).to.deep.equal({ role: undefined, city: "Portland" });
    });
  });
});
