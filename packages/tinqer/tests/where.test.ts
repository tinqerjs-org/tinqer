/**
 * Tests for WHERE operation and all comparison types
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import { expr } from "./test-utils/expr-helpers.js";
import { asWhereOperation, getOperation } from "./test-utils/operation-helpers.js";
import type {
  ComparisonExpression,
  LogicalExpression,
  ColumnExpression,
  ConstantExpression,
  ParameterExpression,
} from "../src/expressions/expression.js";
import type { ParamRef } from "../src/query-tree/operations.js";

describe("WHERE Operation", () => {
  describe("Comparison Operators", () => {
    it("should parse equality comparison (==)", () => {
      const query = () => from<{ id: number; name: string }>("users").where((x) => x.id == 1);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("where");
      const whereOp = asWhereOperation(getOperation(result));
      expect(whereOp.predicate).to.deep.equal(expr.eq(expr.column("id"), expr.parameter("_id1")));
      expect(result?.autoParams).to.deep.equal({ _id1: 1 });
    });

    it("should parse inequality comparison (!=)", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age != 30);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      expect(whereOp.predicate).to.deep.equal(expr.ne(expr.column("age"), expr.parameter("_age1")));
      expect(result?.autoParams).to.deep.equal({ _age1: 30 });
    });

    it("should parse greater than comparison (>)", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age > 18);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      expect(whereOp.predicate).to.deep.equal(expr.gt(expr.column("age"), expr.parameter("_age1")));
      expect(result?.autoParams).to.deep.equal({ _age1: 18 });
    });

    it("should parse greater than or equal comparison (>=)", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age >= 21);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      expect(whereOp.predicate).to.deep.equal(
        expr.gte(expr.column("age"), expr.parameter("_age1")),
      );
      expect(result?.autoParams).to.deep.equal({ _age1: 21 });
    });

    it("should parse less than comparison (<)", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age < 65);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      expect(whereOp.predicate).to.deep.equal(expr.lt(expr.column("age"), expr.parameter("_age1")));
      expect(result?.autoParams).to.deep.equal({ _age1: 65 });
    });

    it("should parse less than or equal comparison (<=)", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age <= 100);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      expect(whereOp.predicate).to.deep.equal(
        expr.lte(expr.column("age"), expr.parameter("_age1")),
      );
      expect(result?.autoParams).to.deep.equal({ _age1: 100 });
    });
  });

  describe("Logical Operators", () => {
    it("should parse AND logical expression (&&)", () => {
      const query = () =>
        from<{ age: number; isActive: boolean }>("users").where((x) => x.age >= 18 && x.isActive);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      expect(whereOp.predicate).to.deep.equal(
        expr.and(
          expr.gte(expr.column("age"), expr.parameter("_age1")),
          expr.booleanColumn("isActive"),
        ),
      );
      expect(result?.autoParams).to.deep.equal({ _age1: 18 });
    });

    it("should parse OR logical expression (||)", () => {
      const query = () =>
        from<{ role: string; isAdmin: boolean }>("users").where(
          (x) => x.role == "admin" || x.isAdmin,
        );
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      expect(whereOp.predicate).to.deep.equal(
        expr.or(
          expr.eq(expr.column("role"), expr.parameter("_role1")),
          expr.booleanColumn("isAdmin"),
        ),
      );
      expect(result?.autoParams).to.deep.equal({ _role1: "admin" });
    });

    it("should parse NOT expression (!)", () => {
      const query = () => from<{ isActive: boolean }>("users").where((x) => !x.isActive);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      expect(whereOp.predicate).to.deep.equal(expr.not(expr.booleanColumn("isActive")));
    });

    it("should parse complex nested logical expressions", () => {
      const query = () =>
        from<{ age: number; isActive: boolean; role: string }>("users").where(
          (x) => (x.age >= 18 && x.isActive) || x.role == "admin",
        );
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      expect(whereOp.predicate).to.deep.equal(
        expr.or(
          expr.and(
            expr.gte(expr.column("age"), expr.parameter("_age1")),
            expr.booleanColumn("isActive"),
          ),
          expr.eq(expr.column("role"), expr.parameter("_role1")),
        ),
      );
      expect(result?.autoParams).to.deep.equal({ _age1: 18, _role1: "admin" });
    });
  });

  describe("Data Type Comparisons", () => {
    it("should parse string comparison", () => {
      const query = () => from<{ name: string }>("users").where((x) => x.name == "John");
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as ComparisonExpression;
      const leftColumn = predicate.left as ColumnExpression;
      expect(leftColumn.name).to.equal("name");
      const rightParam = predicate.right as ParameterExpression;
      expect(rightParam.type).to.equal("param");
      expect(rightParam.param).to.equal("_name1");
      expect(result?.autoParams).to.deep.equal({ _name1: "John" });
    });

    it("should parse boolean literal comparison", () => {
      const query = () => from<{ isActive: boolean }>("users").where((x) => x.isActive == true);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as ComparisonExpression;
      expect(predicate.type).to.equal("comparison");
      const rightParam = predicate.right as ParameterExpression;
      expect(rightParam.type).to.equal("param");
      expect(rightParam.param).to.equal("_isActive1");
      expect(result?.autoParams).to.deep.equal({ _isActive1: true });
    });

    it("should parse null comparison", () => {
      const query = () => from<{ email: string | null }>("users").where((x) => x.email == null);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as ComparisonExpression;
      expect(predicate.type).to.equal("comparison");
      const rightParam = predicate.right as ParameterExpression;
      expect(rightParam.type).to.equal("param");
      expect(rightParam.param).to.equal("_email1");
      expect(result?.autoParams).to.deep.equal({ _email1: null });
    });
  });

  describe("Multiple WHERE Clauses", () => {
    it("should parse multiple where clauses", () => {
      const query = () =>
        from<{ age: number; isActive: boolean }>("users")
          .where((x) => x.age >= 18)
          .where((x) => x.isActive);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("where");
      const outerWhere = asWhereOperation(getOperation(result));
      expect(outerWhere.predicate.type).to.equal("booleanColumn");

      const innerWhere = asWhereOperation(outerWhere.source);
      expect(innerWhere.operationType).to.equal("where");
      expect(innerWhere.predicate.type).to.equal("comparison");

      // Check auto-parameterization for the constant
      expect(result?.autoParams).to.deep.equal({ _age1: 18 });
    });
  });

  describe("External Parameters", () => {
    it("should parse where with external parameters", () => {
      const query = (p: { minAge: number }) =>
        from<{ age: number }>("users").where((x) => x.age >= p.minAge);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as ComparisonExpression;
      const paramRef = predicate.right as ParamRef;
      expect(paramRef.type).to.equal("param");
      expect(paramRef.param).to.equal("p");
      expect(paramRef.property).to.equal("minAge");
    });

    it("should parse where with multiple external parameters", () => {
      const query = (p: { minAge: number; maxAge: number }) =>
        from<{ age: number }>("users").where((x) => x.age >= p.minAge && x.age <= p.maxAge);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(getOperation(result));
      const predicate = whereOp.predicate as LogicalExpression;
      expect(predicate.type).to.equal("logical");
      const leftParamRef = (predicate.left as ComparisonExpression).right as ParamRef;
      expect(leftParamRef.param).to.equal("p");
      expect(leftParamRef.property).to.equal("minAge");
      const rightParamRef = (predicate.right as ComparisonExpression).right as ParamRef;
      expect(rightParamRef.param).to.equal("p");
      expect(rightParamRef.property).to.equal("maxAge");
    });
  });
});
