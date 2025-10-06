/**
 * Tests for case-insensitive functions parsing
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery } from "../dist/parser/parse-query.js";
import type { QueryBuilder } from "../dist/index.js";
import { createQueryHelpers } from "../dist/linq/functions.js";
import type { WhereOperation, SelectOperation } from "../dist/query-tree/operations.js";
import type {
  CaseInsensitiveFunctionExpression,
  LogicalExpression,
  ColumnExpression,
  ParameterExpression,
} from "../dist/expressions/expression.js";

type User = {
  id: number;
  name: string;
  email: string;
  age: number;
  bio?: string;
};

interface TestSchema {
  users: User;
}

describe("Case-Insensitive Functions - Parser", () => {
  describe("iequals function", () => {
    it("should parse _.functions.iequals correctly", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _p: Record<string, never>,
          _: ReturnType<typeof createQueryHelpers>,
        ) => q.from("users").where((u) => _.functions.iequals(u.name, "John")),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate).to.exist;
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
      const predicate = whereOp.predicate as CaseInsensitiveFunctionExpression;
      expect(predicate.function).to.equal("iequals");
      expect(predicate.arguments).to.have.length(2);
      expect(predicate.arguments[0].type).to.equal("column");
      expect((predicate.arguments[0] as ColumnExpression).name).to.equal("name");
      expect(predicate.arguments[1].type).to.equal("param");
    });

    it("should handle alternative parameter naming", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _params: Record<string, never>,
          helpers: ReturnType<typeof createQueryHelpers>,
        ) => q.from("users").where((u) => helpers.functions.iequals(u.email, "admin@test.com")),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate).to.exist;
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
      const predicate = whereOp.predicate as CaseInsensitiveFunctionExpression;
      expect(predicate.function).to.equal("iequals");
      expect((predicate.arguments[0] as ColumnExpression).name).to.equal("email");
    });

    it("should auto-parameterize string literals", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _params: Record<string, never>,
          _: ReturnType<typeof createQueryHelpers>,
        ) => q.from("users").where((u) => _.functions.iequals(u.name, "TestUser")),
      );

      expect(result).to.not.be.null;
      expect(result?.autoParams).to.exist;
      const paramKeys = Object.keys(result!.autoParams);
      expect(paramKeys).to.have.length(1);
      expect(result!.autoParams[paramKeys[0]!]).to.equal("TestUser");
    });
  });

  describe("istartsWith function", () => {
    it("should parse _.functions.istartsWith correctly", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _params: Record<string, never>,
          _: ReturnType<typeof createQueryHelpers>,
        ) => q.from("users").where((u) => _.functions.istartsWith(u.name, "J")),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate).to.exist;
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
      const predicate = whereOp.predicate as CaseInsensitiveFunctionExpression;
      expect(predicate.function).to.equal("istartsWith");
      expect(predicate.arguments).to.have.length(2);
    });

    it("should handle column comparison", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _params: Record<string, never>,
          _: ReturnType<typeof createQueryHelpers>,
        ) => q.from("users").where((u) => _.functions.istartsWith(u.email, u.name)),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      const predicate = whereOp.predicate as CaseInsensitiveFunctionExpression;
      expect(predicate.arguments[0].type).to.equal("column");
      expect((predicate.arguments[0] as ColumnExpression).name).to.equal("email");
      expect(predicate.arguments[1].type).to.equal("column");
      expect((predicate.arguments[1] as ColumnExpression).name).to.equal("name");
    });
  });

  describe("iendsWith function", () => {
    it("should parse _.functions.iendsWith correctly", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _params: Record<string, never>,
          _: ReturnType<typeof createQueryHelpers>,
        ) => q.from("users").where((u) => _.functions.iendsWith(u.email, ".com")),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate).to.exist;
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
      const predicate = whereOp.predicate as CaseInsensitiveFunctionExpression;
      expect(predicate.function).to.equal("iendsWith");
    });
  });

  describe("icontains function", () => {
    it("should parse _.functions.icontains correctly", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _p: Record<string, never>,
          _: ReturnType<typeof createQueryHelpers>,
        ) => q.from("users").where((u) => _.functions.icontains(u.bio!, "developer")),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate).to.exist;
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
      const predicate = whereOp.predicate as CaseInsensitiveFunctionExpression;
      expect(predicate.function).to.equal("icontains");
    });

    it("should handle query parameters", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          p: { searchTerm: string },
          _: ReturnType<typeof createQueryHelpers>,
        ) => q.from("users").where((u) => _.functions.icontains(u.bio!, p.searchTerm)),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      const predicate = whereOp.predicate as CaseInsensitiveFunctionExpression;
      expect(predicate.arguments[1].type).to.equal("param");
      const paramArg = predicate.arguments[1] as ParameterExpression;
      expect(paramArg.param).to.equal("p");
      expect(paramArg.property).to.equal("searchTerm");
    });
  });

  describe("Complex queries with case-insensitive functions", () => {
    it("should handle multiple conditions with AND", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _p: Record<string, never>,
          _: ReturnType<typeof createQueryHelpers>,
        ) => q.from("users").where((u) => _.functions.iequals(u.name, "John") && u.age > 18),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      expect(whereOp.predicate.type).to.equal("logical");
      const predicate = whereOp.predicate as LogicalExpression;
      expect(predicate.operator).to.equal("and");
      expect(predicate.left.type).to.equal("caseInsensitiveFunction");
      expect(predicate.right.type).to.equal("comparison");
    });

    it("should handle multiple conditions with OR", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _p: Record<string, never>,
          _: ReturnType<typeof createQueryHelpers>,
        ) =>
          q
            .from("users")
            .where(
              (u) => _.functions.istartsWith(u.name, "A") || _.functions.istartsWith(u.name, "B"),
            ),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      expect(whereOp.predicate.type).to.equal("logical");
      const predicate = whereOp.predicate as LogicalExpression;
      expect(predicate.operator).to.equal("or");
      expect(predicate.left.type).to.equal("caseInsensitiveFunction");
      expect(predicate.right.type).to.equal("caseInsensitiveFunction");
    });

    it("should work with select projection", () => {
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _p: Record<string, never>,
          _: ReturnType<typeof createQueryHelpers>,
        ) =>
          q
            .from("users")
            .where((u) => _.functions.icontains(u.email, "admin"))
            .select((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            })),
      );

      expect(result).to.not.be.null;
      const selectOp = result?.operation as SelectOperation;
      expect(selectOp.operationType).to.equal("select");
      expect(selectOp.source).to.exist;
      const whereOp = selectOp.source as WhereOperation;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
    });
  });

  describe("Error cases", () => {
    it("should parse but not recognize without second parameter", () => {
      const result = parseQuery((q: QueryBuilder<TestSchema>) =>
        q.from("users").where((u) => u.name === "John"),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      expect(whereOp.predicate.type).to.equal("comparison"); // Not a case-insensitive function
    });

    it("should not recognize invalid function names as case-insensitive", () => {
      // This will parse as a coalesce expression due to the ?? operator
      const result = parseQuery(
        (
          q: QueryBuilder<TestSchema>,
          _p: Record<string, never>,
          _: ReturnType<typeof createQueryHelpers>,
        ) => q.from("users").where((u) => u.name === "test" || false),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as WhereOperation;
      // It should be a logical expression, not a case-insensitive function
      expect(whereOp.predicate.type).to.equal("logical");
    });
  });
});
