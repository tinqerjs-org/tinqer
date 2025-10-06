/**
 * Basic Terminal Operations SQL Generation Tests
 * Verifies that terminal operations generate correct SQL
 */

import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("Basic Terminal Operations", () => {
  describe("COUNT operations", () => {
    it("should generate SQL for count()", () => {
      const result = selectStatement(schema, (q) => q.from("users").count(), {});
      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users"');
      expect(result.params).to.deep.equal({});
    });

    it("should generate SQL for count() with WHERE", () => {
      const result = selectStatement(
        schema,
        (q) =>
          q
            .from("users")
            .where((u) => u.isActive)
            .count(),
        {},
      );
      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users" WHERE "isActive"');
      expect(result.params).to.deep.equal({});
    });
  });
});
