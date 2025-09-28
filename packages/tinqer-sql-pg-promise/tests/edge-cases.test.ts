/**
 * Edge cases and error handling tests
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

describe("Edge Cases and Error Handling", () => {
  interface TestTable {
    id: number;
    name: string;
    value?: number;
    data?: any;
    flag: boolean;
    "special-column"?: string;
    column_with_underscore?: string;
    UPPERCASE_COLUMN?: string;
  }

  describe("Empty queries", () => {
    it("should handle simple FROM without any operations", () => {
      const result = query(() => from<TestTable>("test_table"), {});

      expect(result.sql).to.equal('SELECT * FROM "test_table"');
      expect(result.params).to.deep.equal({});
    });

    // Removed: direct boolean literal tests - need parser support for () => true/false
  });

  describe("Special characters and identifiers", () => {
    it("should handle table names with underscores", () => {
      const result = query(() => from<TestTable>("user_accounts_table"), {});

      expect(result.sql).to.equal('SELECT * FROM "user_accounts_table"');
    });

    it("should handle table names with numbers", () => {
      const result = query(() => from<TestTable>("table123"), {});

      expect(result.sql).to.equal('SELECT * FROM "table123"');
    });

    it("should handle column names with underscores", () => {
      const result = query(
        () => from<TestTable>("test").where((t) => t.column_with_underscore == "test"),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "column_with_underscore" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: "test" });
    });

    it("should handle uppercase column names", () => {
      const result = query(
        () => from<TestTable>("test").where((t) => t.UPPERCASE_COLUMN == "TEST"),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "UPPERCASE_COLUMN" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: "TEST" });
    });
  });

  describe("Extreme values", () => {
    it("should handle very large integers", () => {
      const result = query(
        () => from<TestTable>("test").where((t) => t.id == Number.MAX_SAFE_INTEGER),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "id" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: Number.MAX_SAFE_INTEGER });
    });

    // Removed: || operator for defaults

    it("should handle zero values", () => {
      const result = query(() => from<TestTable>("test").where((t) => t.value == 0), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "value" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: 0 });
    });

    // Removed: || operator for defaults
  });

  describe("String edge cases", () => {
    it("should handle empty strings", () => {
      const result = query(() => from<TestTable>("test").where((t) => t.name == ""), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "name" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: "" });
    });

    it("should handle strings with quotes", () => {
      const result = query(() => from<TestTable>("test").where((t) => t.name == "O'Brien"), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "name" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: "O'Brien" });
    });

    it("should handle strings with double quotes", () => {
      const result = query(
        () => from<TestTable>("test").where((t) => t.name == 'He said "Hello"'),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "name" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: 'He said "Hello"' });
    });

    it("should handle strings with special characters", () => {
      const result = query(
        () => from<TestTable>("test").where((t) => t.name == "test@#$%^&*()"),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "name" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: "test@#$%^&*()" });
    });

    it("should handle strings with newlines and tabs", () => {
      const result = query(
        () => from<TestTable>("test").where((t) => t.name == "line1\nline2\ttab"),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "name" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: "line1\nline2\ttab" });
    });

    it("should handle Unicode strings", () => {
      const result = query(
        () => from<TestTable>("test").where((t) => t.name == "Hello 世界 🌍"),
        {},
      );

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "name" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: "Hello 世界 🌍" });
    });
  });

  describe("NULL handling edge cases", () => {
    it("should handle explicit null comparisons", () => {
      const result = query(() => from<TestTable>("test").where((t) => t.value == null), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "value" IS NULL');
      expect(result.params).to.deep.equal({});
    });

    it("should handle null inequality", () => {
      const result = query(() => from<TestTable>("test").where((t) => t.value != null), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "value" IS NOT NULL');
      expect(result.params).to.deep.equal({});
    });

    // Removed: || operator and ternary operator
  });

  describe("Boolean edge cases", () => {
    it("should handle true literal", () => {
      const result = query(() => from<TestTable>("test").where((t) => t.flag == true), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "flag" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: true });
    });

    it("should handle false literal", () => {
      const result = query(() => from<TestTable>("test").where((t) => t.flag == false), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "flag" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: false });
    });

    it("should handle boolean field directly", () => {
      const result = query(() => from<TestTable>("test").where((t) => t.flag), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "flag"');
      expect(result.params).to.deep.equal({});
    });

    it("should handle negated boolean", () => {
      const result = query(() => from<TestTable>("test").where((t) => !t.flag), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE NOT "flag"');
      expect(result.params).to.deep.equal({});
    });
  });

  describe("Complex nested structures", () => {
    it("should handle deeply nested logical conditions", () => {
      const result = query(
        () =>
          from<TestTable>("test").where(
            (t) =>
              ((t.id > 0 && t.id < 100) || (t.id > 1000 && t.id < 2000)) &&
              (t.flag == true || (t.name != "" && t.value != null)),
          ),
        {},
      );

      expect(result.sql).to.contain('"id" > $(__p1)');
      expect(result.sql).to.contain('"id" < $(__p2)');
      expect(result.sql).to.contain('"id" > $(__p3)');
      expect(result.sql).to.contain('"id" < $(__p4)');
      expect(result.sql).to.contain('"flag" = $(__p5)');
      expect(result.sql).to.contain('"name" != $(__p6)');
      expect(result.sql).to.contain('"value" IS NOT NULL');
    });

    it("should handle many chained operations", () => {
      const result = query(
        () =>
          from<TestTable>("test")
            .where((t) => t.id > 0)
            .where((t) => t.id < 1000)
            .where((t) => t.name != "")
            .where((t) => t.flag == true)
            .where((t) => t.value != null)
            .select((t) => ({ id: t.id, name: t.name }))
            .orderBy((t) => t.id)
            .take(10),
        {},
      );

      expect(result.sql).to.contain("WHERE");
      expect(result.sql).to.contain("AND");
      expect(result.sql).to.contain("SELECT");
      expect(result.sql).to.contain("ORDER BY");
      expect(result.sql).to.contain("LIMIT");
      // One less param now that null is not parameterized
      expect(Object.keys(result.params).length).to.equal(5);
    });
  });

  describe("Pagination edge cases", () => {
    it("should handle SKIP 0", () => {
      const result = query(() => from<TestTable>("test").skip(0), {});

      expect(result.sql).to.equal('SELECT * FROM "test" OFFSET $(__p1)');
      expect(result.params).to.deep.equal({ __p1: 0 });
    });

    it("should handle TAKE 0", () => {
      const result = query(() => from<TestTable>("test").take(0), {});

      expect(result.sql).to.equal('SELECT * FROM "test" LIMIT $(__p1)');
      expect(result.params).to.deep.equal({ __p1: 0 });
    });

    it("should handle very large SKIP", () => {
      const result = query(() => from<TestTable>("test").skip(1000000), {});

      expect(result.sql).to.equal('SELECT * FROM "test" OFFSET $(__p1)');
      expect(result.params).to.deep.equal({ __p1: 1000000 });
    });

    it("should handle very large TAKE", () => {
      const result = query(() => from<TestTable>("test").take(999999), {});

      expect(result.sql).to.equal('SELECT * FROM "test" LIMIT $(__p1)');
      expect(result.params).to.deep.equal({ __p1: 999999 });
    });
  });

  describe("Parameter edge cases", () => {
    it("should handle empty parameter object", () => {
      const result = query((_params: {}) => from<TestTable>("test"), {});

      expect(result.sql).to.equal('SELECT * FROM "test"');
      expect(result.params).to.deep.equal({});
    });

    // Removed: || operator for defaults

    it("should handle null parameter values", () => {
      const result = query(
        (params: { name: string | null }) =>
          from<TestTable>("test").where((t) => t.name == params.name),
        { name: null },
      );

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "name" = $(name)');
      expect(result.params).to.deep.equal({ name: null });
    });

    // Removed: array indexing - needs special handling
  });

  describe("Reserved SQL keywords", () => {
    interface ReservedTable {
      select: string;
      from: string;
      where: number;
      order: string;
      group: string;
      join: string;
      limit: number;
    }

    it("should handle reserved keywords as column names", () => {
      const result = query(
        () => from<ReservedTable>("reserved").where((t) => t.select == "value" && t.from == "test"),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "reserved" WHERE ("select" = $(__p1) AND "from" = $(__p2))',
      );
      expect(result.params).to.deep.equal({ __p1: "value", __p2: "test" });
    });

    it("should handle reserved keywords in SELECT", () => {
      const result = query(
        () =>
          from<ReservedTable>("reserved").select((t) => ({
            selectCol: t.select,
            whereCol: t.where,
            orderCol: t.order,
          })),
        {},
      );

      expect(result.sql).to.contain('"select" AS "selectCol"');
      expect(result.sql).to.contain('"where" AS "whereCol"');
      expect(result.sql).to.contain('"order" AS "orderCol"');
    });
  });

  describe("Whitespace handling", () => {
    it("should handle strings with only whitespace", () => {
      const result = query(() => from<TestTable>("test").where((t) => t.name == "   "), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "name" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: "   " });
    });

    it("should handle strings with leading/trailing whitespace", () => {
      const result = query(() => from<TestTable>("test").where((t) => t.name == "  test  "), {});

      expect(result.sql).to.equal('SELECT * FROM "test" WHERE "name" = $(__p1)');
      expect(result.params).to.deep.equal({ __p1: "  test  " });
    });
  });

  describe("Type coercion edge cases", () => {
    // Test removed: string concatenation with numbers is not allowed in SELECT
    // Expressions must be computed in application code
  });
});
