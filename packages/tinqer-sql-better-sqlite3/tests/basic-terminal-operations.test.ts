/**
 * Basic Terminal Operations SQL Generation Tests
 * Verifies that terminal operations generate correct SQL
 */

import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
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
      const result = selectStatement(() => from<User>("users").count(), {});
      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users"');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for count() with WHERE", () => {
      const result = selectStatement(
        () =>
          from<User>("users")
            .where((u) => u.isActive)
            .count(),
        {},
      );
      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users" WHERE "isActive"');
      expect(result.params).to.deep.equal({});
    });
  });

  describe("TOARRAY operations", () => {
    it("should generate SQL for toArray()", () => {
      const result = selectStatement(() => from<User>("users").toArray(), {});
      // toArray just executes the query without modifications
      expect(result.sql).to.equal('SELECT * FROM "users"');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for toArray() with WHERE", () => {
      const result = selectStatement(
        () =>
          from<User>("users")
            .where((u) => u.age > 18)
            .toArray(),
        {},
      );
      expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" > @__p1');
      expect(result.params).to.deep.equal({ __p1: 18 });
    });

    it("should generate SQL for toList()", () => {
      const result = selectStatement(() => from<User>("users").toList(), {});
      expect(result.sql).to.equal('SELECT * FROM "users"');
      expect(result.params).to.deep.equal({});
    });
  });
});
