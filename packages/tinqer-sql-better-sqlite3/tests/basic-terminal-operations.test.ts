/**
 * Basic Terminal Operations SQL Generation Tests
 * Verifies that terminal operations generate correct SQL
 */

import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

interface User {
  id: number;
  name: string;
  age: number;
  isActive: boolean;
}

describe("Basic Terminal Operations", () => {
  describe("COUNT operations", () => {
    it("should generate SQL for count()", () => {
      const result = query(() => from<User>("users").count(), {});
      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users" AS t0');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for count() with WHERE", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.isActive)
            .count(),
        {},
      );
      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users" AS t0 WHERE isActive');
      expect(result.params).to.deep.equal({});
    });
  });

  describe("TOARRAY operations", () => {
    it("should generate SQL for toArray()", () => {
      const result = query(() => from<User>("users").toArray(), {});
      // toArray just executes the query without modifications
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for toArray() with WHERE", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.age > 18)
            .toArray(),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0 WHERE age > :_age1');
      expect(result.params).to.deep.equal({ _age1: 18 });
    });

    it("should generate SQL for toList()", () => {
      const result = query(() => from<User>("users").toList(), {});
      expect(result.sql).to.equal('SELECT * FROM "users" AS t0');
      expect(result.params).to.deep.equal({});
    });
  });
});
