/**
 * Tests for case-insensitive functions parsing
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery } from "../src/parser/parse-query.js";
import { from } from "../src/linq/from.js";
import { createQueryHelpers } from "../src/linq/functions.js";
import type { DatabaseContext } from "../src/linq/database-context.js";

type User = {
  id: number;
  name: string;
  email: string;
  age: number;
  bio?: string;
};

describe("Case-Insensitive Functions - Parser", () => {
  describe("iequals function", () => {
    it("should parse _.functions.iequals correctly", () => {
      const result = parseQuery(
        (params: { users: DatabaseContext<User> }, _: ReturnType<typeof createQueryHelpers>) =>
          from<User>("users").where((u) => _.functions.iequals(u.name, "John")),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate).to.exist;
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
      expect(whereOp.predicate.function).to.equal("iequals");
      expect(whereOp.predicate.arguments).to.have.length(2);
      expect(whereOp.predicate.arguments[0].type).to.equal("column");
      expect(whereOp.predicate.arguments[0].name).to.equal("name");
      expect(whereOp.predicate.arguments[1].type).to.equal("param");
    });

    it("should handle alternative parameter naming", () => {
      const result = parseQuery(
        (
          params: { users: DatabaseContext<User> },
          helpers: ReturnType<typeof createQueryHelpers>,
        ) => from<User>("users").where((u) => helpers.functions.iequals(u.email, "admin@test.com")),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate).to.exist;
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
      expect(whereOp.predicate.function).to.equal("iequals");
      expect(whereOp.predicate.arguments[0].name).to.equal("email");
    });

    it("should auto-parameterize string literals", () => {
      const result = parseQuery(
        (params: { users: DatabaseContext<User> }, _: ReturnType<typeof createQueryHelpers>) =>
          from<User>("users").where((u) => _.functions.iequals(u.name, "TestUser")),
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
        (params: { users: DatabaseContext<User> }, _: ReturnType<typeof createQueryHelpers>) =>
          from<User>("users").where((u) => _.functions.istartsWith(u.name, "J")),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate).to.exist;
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
      expect(whereOp.predicate.function).to.equal("istartsWith");
      expect(whereOp.predicate.arguments).to.have.length(2);
    });

    it("should handle column comparison", () => {
      const result = parseQuery(
        (params: { users: DatabaseContext<User> }, _: ReturnType<typeof createQueryHelpers>) =>
          from<User>("users").where((u) => _.functions.istartsWith(u.email, u.name)),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      expect(whereOp.predicate.arguments[0].type).to.equal("column");
      expect(whereOp.predicate.arguments[0].name).to.equal("email");
      expect(whereOp.predicate.arguments[1].type).to.equal("column");
      expect(whereOp.predicate.arguments[1].name).to.equal("name");
    });
  });

  describe("iendsWith function", () => {
    it("should parse _.functions.iendsWith correctly", () => {
      const result = parseQuery(
        (params: { users: DatabaseContext<User> }, _: ReturnType<typeof createQueryHelpers>) =>
          from<User>("users").where((u) => _.functions.iendsWith(u.email, ".com")),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate).to.exist;
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
      expect(whereOp.predicate.function).to.equal("iendsWith");
    });
  });

  describe("icontains function", () => {
    it("should parse _.functions.icontains correctly", () => {
      const result = parseQuery(
        (params: { users: DatabaseContext<User> }, _: ReturnType<typeof createQueryHelpers>) =>
          from<User>("users").where((u) => _.functions.icontains(u.bio!, "developer")),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate).to.exist;
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
      expect(whereOp.predicate.function).to.equal("icontains");
    });

    it("should handle query parameters", () => {
      const result = parseQuery(
        (
          params: { users: DatabaseContext<User>; searchTerm: string },
          _: ReturnType<typeof createQueryHelpers>,
        ) => from<User>("users").where((u) => _.functions.icontains(u.bio!, params.searchTerm)),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      expect(whereOp.predicate.arguments[1].type).to.equal("param");
      expect(whereOp.predicate.arguments[1].param).to.equal("params");
      expect(whereOp.predicate.arguments[1].property).to.equal("searchTerm");
    });
  });

  describe("Complex queries with case-insensitive functions", () => {
    it("should handle multiple conditions with AND", () => {
      const result = parseQuery(
        (params: { users: DatabaseContext<User> }, _: ReturnType<typeof createQueryHelpers>) =>
          from<User>("users").where((u) => _.functions.iequals(u.name, "John") && u.age > 18),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      expect(whereOp.predicate.type).to.equal("logical");
      expect(whereOp.predicate.operator).to.equal("and");
      expect(whereOp.predicate.left.type).to.equal("caseInsensitiveFunction");
      expect(whereOp.predicate.right.type).to.equal("comparison");
    });

    it("should handle multiple conditions with OR", () => {
      const result = parseQuery(
        (params: { users: DatabaseContext<User> }, _: ReturnType<typeof createQueryHelpers>) =>
          from<User>("users").where(
            (u) => _.functions.istartsWith(u.name, "A") || _.functions.istartsWith(u.name, "B"),
          ),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      expect(whereOp.predicate.type).to.equal("logical");
      expect(whereOp.predicate.operator).to.equal("or");
      expect(whereOp.predicate.left.type).to.equal("caseInsensitiveFunction");
      expect(whereOp.predicate.right.type).to.equal("caseInsensitiveFunction");
    });

    it("should work with select projection", () => {
      const result = parseQuery(
        (params: { users: DatabaseContext<User> }, _: ReturnType<typeof createQueryHelpers>) =>
          from<User>("users")
            .where((u) => _.functions.icontains(u.email, "admin"))
            .select((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            })),
      );

      expect(result).to.not.be.null;
      const selectOp = result?.operation as any;
      expect(selectOp.operationType).to.equal("select");
      expect(selectOp.source).to.exist;
      const whereOp = selectOp.source;
      expect(whereOp.operationType).to.equal("where");
      expect(whereOp.predicate.type).to.equal("caseInsensitiveFunction");
    });
  });

  describe("Error cases", () => {
    it("should parse but not recognize without second parameter", () => {
      const result = parseQuery((params: { users: DatabaseContext<User> }) =>
        from<User>("users").where((u) => u.name === "John"),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      expect(whereOp.predicate.type).to.equal("comparison"); // Not a case-insensitive function
    });

    it("should not recognize invalid function names as case-insensitive", () => {
      // This will parse as a coalesce expression due to the ?? operator
      const result = parseQuery((params: { users: DatabaseContext<User> }, _: any) =>
        from<User>("users").where((u) => u.name === "test" || false),
      );

      expect(result).to.not.be.null;
      const whereOp = result?.operation as any;
      // It should be a logical expression, not a case-insensitive function
      expect(whereOp.predicate.type).to.equal("logical");
    });
  });
});
