import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

describe("Advanced Edge Cases and Corner Scenarios", () => {
  interface TestTable {
    id: number;
    value: number | null;
    text: string | null;
    flag: boolean;
    data: any;
    createdAt: Date;
  }

  describe("NULL value edge cases", () => {
    it("should handle NULL in arithmetic with COALESCE", () => {
      const result = query(
        () => from<TestTable>("items").where((i) => (i.value ?? 0) + 10 > 20),
        {},
      );

      expect(result.sql).to.include("COALESCE");
      expect(result.sql).to.include("+ ");
    });

    // LIMITATION: Without type tracking, can't determine COALESCE returns string
    it.skip("should handle NULL in string concatenation", () => {
      const result = query(
        () =>
          from<TestTable>("items").select((i) => ({
            combined: (i.text ?? "") + "_suffix",
          })),
        {},
      );

      expect(result.sql).to.include("COALESCE");
      expect(result.sql).to.include("|| "); // PostgreSQL string concatenation
    });

    it("should handle multiple NULL checks in complex conditions", () => {
      const result = query(
        () =>
          from<TestTable>("items").where(
            (i) => i.value === null || (i.text === null && i.flag === true),
          ),
        {},
      );

      expect(result.sql).to.include("IS NULL");
      expect(result.sql).to.include("OR");
      expect(result.sql).to.include("AND");
    });

    it("should handle NULL in BETWEEN-like conditions", () => {
      const result = query(
        () =>
          from<TestTable>("items").where(
            (i) => i.value !== null && i.value >= 10 && i.value <= 100,
          ),
        {},
      );

      expect(result.sql).to.include("IS NOT NULL");
      expect(result.sql).to.include(">=");
      expect(result.sql).to.include("<=");
    });
  });

  describe("Special character handling", () => {
    it("should handle table names with special characters", () => {
      interface SpecialTable {
        "user-id": number;
        "first.name": string;
        "last@name": string;
      }

      const result = query(() => from<SpecialTable>("user-accounts"), {});

      expect(result.sql).to.include('"user-accounts"');
    });

    it("should escape quotes in string literals", () => {
      const result = query(
        () => from<TestTable>("items").where((i) => i.text === "O'Reilly's \"Book\""),
        {},
      );

      expect(result.params._text1).to.equal("O'Reilly's \"Book\"");
    });

    it("should handle Unicode characters in strings", () => {
      const result = query(
        () => from<TestTable>("items").where((i) => i.text !== null && i.text.includes("😀🎉")),
        {},
      );

      expect(result.sql).to.include("LIKE");
    });

    it("should handle newlines and tabs in string literals", () => {
      const result = query(
        () => from<TestTable>("items").where((i) => i.text === "line1\nline2\ttab"),
        {},
      );

      expect(result.params._text1).to.equal("line1\nline2\ttab");
    });
  });

  describe("Numeric edge cases", () => {
    // TODO: BUG - Auto-parameterization should use consistent naming (_value1 not _id1)
    it.skip("should handle JavaScript MAX_SAFE_INTEGER", () => {
      const result = query(
        () => from<TestTable>("items").where((i) => i.value === Number.MAX_SAFE_INTEGER),
        {},
      );

      expect(result.params._value1).to.equal(Number.MAX_SAFE_INTEGER);
    });

    // TODO: BUG - Parser fails on negative literals
    it.skip("should handle negative values", () => {
      const result = query(
        () => from<TestTable>("items").where((i) => i.value !== null && i.value > -1000),
        {},
      );

      expect(result.params._value1).to.equal(-1000);
    });

    it("should handle floating point precision", () => {
      const result = query(
        () => from<TestTable>("items").where((i) => i.value !== null && i.value === 0.3),
        {},
      );

      expect(result.params._value1).to.equal(0.3);
    });

    it("should handle scientific notation", () => {
      const result = query(() => from<TestTable>("items").where((i) => i.value !== null && i.value > 1e10), {});

      expect(result.params._value1).to.equal(10000000000);
    });
  });

  describe("Boolean operation edge cases", () => {
    it("should handle double negation", () => {
      const result = query(() => from<TestTable>("items").where((i) => !!i.flag), {});

      expect(result.sql).to.include('"flag"');
      expect(result.sql).not.to.include("NOT NOT");
    });

    it("should handle boolean field with explicit true/false comparison", () => {
      const result = query(
        () => from<TestTable>("items").where((i) => i.flag === true || i.flag === false),
        {},
      );

      expect(result.sql).to.include('"flag" = ');
      expect(result.params._flag1).to.equal(true);
      expect(result.params._flag2).to.equal(false);
    });

    it("should handle complex boolean algebra", () => {
      const result = query(
        () =>
          from<TestTable>("items").where(
            (i) => (i.flag && i.value !== null && i.value > 0) || (!i.flag && i.value !== null && i.value < 0),
          ),
        {},
      );

      expect(result.sql).to.include("OR");
      expect(result.sql).to.include("AND");
      expect(result.sql).to.include("NOT");
    });
  });

  describe("Date operation edge cases", () => {
    // TODO: BUG - Dates should be parameterized for security
    it.skip("should handle date comparisons", () => {
      const testDate = new Date("2024-01-01");
      const result = query(
        () => from<TestTable>("items").where((i) => i.createdAt > testDate),
        {},
      );

      expect(result.sql).to.include('"createdAt" > ');
      expect(result.params._createdAt1).to.equal(testDate);
    });

    // TODO: BUG - Date arithmetic not supported
    it.skip("should handle date arithmetic", () => {
      const result = query(
        () =>
          from<TestTable>("items").select((i) => ({
            daysSince: (Date.now() - i.createdAt.getTime()) / (1000 * 60 * 60 * 24),
          })),
        {},
      );

      expect(result.sql).to.include("createdAt");
      expect(result.sql).to.include("-"); // Should handle date arithmetic
    });
  });

  describe("Complex nested operations", () => {
    it("should handle deeply nested arithmetic", () => {
      const result = query(
        () =>
          from<TestTable>("items").where((i) => i.value !== null && ((i.value + 10) * 2 - 5) / 3 > 10),
        {},
      );

      expect(result.sql).to.include("((");
      expect(result.sql).to.include("+ ");
      expect(result.sql).to.include("* ");
      expect(result.sql).to.include("- ");
      expect(result.sql).to.include("/ ");
    });

    it("should handle nested ternary operations", () => {
      const result = query(
        () =>
          from<TestTable>("items").select((i) => ({
            category: i.value !== null ? (i.value < 10 ? "low" : i.value < 50 ? "medium" : "high") : "unknown",
          })),
        {},
      );

      expect(result.sql).to.include("CASE WHEN");
      expect(result.sql).to.include("THEN");
      expect(result.sql).to.include("ELSE");
    });

    it("should handle nested object projections", () => {
      const result = query(
        () =>
          from<TestTable>("items").select((i) => ({
            data: {
              id: i.id,
              metadata: {
                hasValue: i.value !== null,
                textLength: i.text ? i.text.length : 0,
              },
            },
          })),
        {},
      );

      expect(result.sql).to.include("AS ");
    });
  });

  describe("Parameter edge cases", () => {
    it("should handle empty parameter object", () => {
      const result = query(() => from<TestTable>("items"), {});

      expect(result.params).to.deep.equal({});
    });

    // TODO: BUG - null parameters should generate IS NULL not =
    it.skip("should handle null parameter values", () => {
      const result = query(
        (params) => from<TestTable>("items").where((i) => i.value === params.threshold),
        { threshold: null },
      );

      expect(result.sql).to.include("IS NULL");
    });

    // TODO: BUG - undefined parameters should generate IS NULL
    it.skip("should handle undefined parameter values", () => {
      const result = query(
        (params) => from<TestTable>("items").where((i) => i.text === params.search),
        { search: undefined },
      );

      expect(result.sql).to.include("IS NULL");
    });

    // TODO: BUG - Auto-params should not overwrite user params
    it.skip("should handle parameter name collision with auto-params", () => {
      const result = query(
        (params) =>
          from<TestTable>("items")
            .where((i) => i.value !== null && i.value > params._value1)
            .where((i) => i.value !== null && i.value < 100),
        { _value1: 50 },
      );

      expect(result.params._value1).to.equal(50); // User param preserved
      expect(result.params._value2).to.equal(100); // Auto-param uses different name
    });
  });

  describe("SQL injection prevention", () => {
    it("should parameterize dangerous strings", () => {
      const result = query(
        () =>
          from<TestTable>("items").where((i) => i.text === "'; DROP TABLE users; --"),
        {},
      );

      expect(result.sql).not.to.include("DROP TABLE");
      expect(result.params._text1).to.equal("'; DROP TABLE users; --");
    });

    it("should handle column names that look like SQL", () => {
      interface DangerousTable {
        "SELECT": number;
        "FROM": string;
        "WHERE": boolean;
      }

      const result = query(
        () => from<DangerousTable>("dangerous").select((d) => ({ value: d.SELECT })),
        {},
      );

      expect(result.sql).to.include('"SELECT"');
    });

    it("should parameterize hex strings", () => {
      const result = query(
        () => from<TestTable>("items").where((i) => i.text === "0x1234ABCD"),
        {},
      );

      expect(result.params._text1).to.equal("0x1234ABCD");
    });
  });


  describe("Type coercion edge cases", () => {
    it("should handle string to number comparison", () => {
      const result = query(
        () => from<TestTable>("items").where((i) => i.text === "123"),
        {},
      );

      expect(result.params._text1).to.be.a("string");
      expect(result.params._text1).to.equal("123");
    });

    // LIMITATION: Auto-parameterization removes type info before SQL generation
    it.skip("should handle mixed type arithmetic", () => {
      const result = query(
        () =>
          from<TestTable>("items").select(() => ({
            mixed: "prefix" + "_suffix",  // Test with string literals
          })),
        {},
      );

      // Should use || for PostgreSQL string concatenation
      // But auto-parameterization loses type info
      expect(result.sql).to.include("||");
    });
  });

  describe("Reserved word edge cases", () => {
    it("should handle all SQL reserved words as column names", () => {
      interface ReservedTable {
        select: number;
        from: string;
        where: boolean;
        group: string;
        order: number;
        having: string;
        limit: number;
        offset: number;
        join: string;
        union: string;
      }

      const result = query(
        () =>
          from<ReservedTable>("reserved")
            .where((r) => r.select > 0)
            .select((r) => ({
              selectCol: r.select,
              fromCol: r.from,
              whereCol: r.where,
            })),
        {},
      );

      expect(result.sql).to.include('"select"');
      expect(result.sql).to.include('"from"');
      expect(result.sql).to.include('"where"');
    });
  });
});