/**
 * NULL Handling SQL Generation Tests
 * Verifies that NULL comparisons generate correct IS NULL / IS NOT NULL
 */

import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

interface User {
  id: number;
  name: string | null;
  middleName: string | null;
  age: number | null;
}

describe("NULL Handling", () => {
  describe("IS NULL generation", () => {
    it("should generate IS NULL for == null comparison", () => {
      const result = query(() => from<User>("users").where((u) => u.middleName == null), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "middleName" IS NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NULL for === null comparison", () => {
      const result = query(() => from<User>("users").where((u) => u.age === null), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" IS NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NULL with null on left side", () => {
      const result = query(() => from<User>("users").where((u) => null == u.name), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "name" IS NULL');
      expect(result.params).to.deep.equal({});
    });
  });

  describe("IS NOT NULL generation", () => {
    it("should generate IS NOT NULL for != null comparison", () => {
      const result = query(() => from<User>("users").where((u) => u.middleName != null), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "middleName" IS NOT NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NOT NULL for !== null comparison", () => {
      const result = query(() => from<User>("users").where((u) => u.age !== null), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" IS NOT NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should generate IS NOT NULL with null on left side", () => {
      const result = query(() => from<User>("users").where((u) => null != u.name), {});
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "name" IS NOT NULL');
      expect(result.params).to.deep.equal({});
    });
  });

  describe("Complex NULL conditions", () => {
    it("should handle NULL checks with AND", () => {
      const result = query(
        () => from<User>("users").where((u) => u.name != null && u.age == null),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("name" IS NOT NULL AND "age" IS NULL)',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should handle NULL checks with OR", () => {
      const result = query(
        () => from<User>("users").where((u) => u.middleName == null || u.age == null),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("middleName" IS NULL OR "age" IS NULL)',
      );
      expect(result.params).to.deep.equal({});
    });

    it("should handle NULL checks in complex conditions", () => {
      const result = query(
        () => from<User>("users").where((u) => u.id > 10 && u.middleName != null),
        {},
      );
      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE ("id" > @__p1 AND "middleName" IS NOT NULL)',
      );
      expect(result.params).to.deep.equal({ __p1: 10 });
    });
  });
});
