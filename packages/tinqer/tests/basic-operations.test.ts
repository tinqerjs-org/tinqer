/**
 * Tests for basic query operations: from, where, select
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import { expr } from "./test-utils/expr-helpers.js";
import {
  asFromOperation,
  asWhereOperation,
  asSelectOperation,
} from "./test-utils/operation-helpers.js";
import type {
  ComparisonExpression,
  LogicalExpression,
  ObjectExpression,
  ColumnExpression,
  ConcatExpression,
  ArithmeticExpression,
  ConstantExpression,
} from "../src/expressions/expression.js";
import type { ParamRef } from "../src/query-tree/operations.js";

describe("Basic Query Operations", () => {
  describe("from()", () => {
    it("should parse from() with simple table name", () => {
      const query = () => from<{ id: number; name: string }>("users");
      const result = parseQuery(query);

      expect(result).to.not.be.null;
      expect(result?.operationType).to.equal("from");
      const fromOp = asFromOperation(result);
      expect(fromOp.table).to.equal("users");
    });

    it("should handle different table names", () => {
      const query1 = () => from<{ id: number }>("products");
      const result1 = parseQuery(query1);
      const fromOp1 = asFromOperation(result1);
      expect(fromOp1.table).to.equal("products");

      const query2 = () => from<{ id: number }>("orders");
      const result2 = parseQuery(query2);
      const fromOp2 = asFromOperation(result2);
      expect(fromOp2.table).to.equal("orders");

      const query3 = () => from<{ id: number }>("customer_details");
      const result3 = parseQuery(query3);
      const fromOp3 = asFromOperation(result3);
      expect(fromOp3.table).to.equal("customer_details");
    });
  });

  describe("where()", () => {
    it("should parse simple equality comparison", () => {
      const query = () => from<{ id: number; name: string }>("users").where((x) => x.id == 1);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("where");
      const whereOp = asWhereOperation(result);
      expect(whereOp.predicate).to.deep.equal(expr.eq(expr.column("id"), expr.constant(1)));
    });

    it("should parse inequality comparison", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age != 30);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      expect(whereOp.predicate).to.deep.equal(expr.ne(expr.column("age"), expr.constant(30)));
    });

    it("should parse greater than comparison", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age > 18);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      expect(whereOp.predicate).to.deep.equal(expr.gt(expr.column("age"), expr.constant(18)));
    });

    it("should parse greater than or equal comparison", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age >= 21);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      expect(whereOp.predicate).to.deep.equal(expr.gte(expr.column("age"), expr.constant(21)));
    });

    it("should parse less than comparison", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age < 65);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      expect(whereOp.predicate).to.deep.equal(expr.lt(expr.column("age"), expr.constant(65)));
    });

    it("should parse less than or equal comparison", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age <= 100);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      expect(whereOp.predicate).to.deep.equal(expr.lte(expr.column("age"), expr.constant(100)));
    });

    it("should parse AND logical expression", () => {
      const query = () =>
        from<{ age: number; isActive: boolean }>("users").where((x) => x.age >= 18 && x.isActive);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      expect(whereOp.predicate).to.deep.equal(
        expr.and(expr.gte(expr.column("age"), expr.constant(18)), expr.booleanColumn("isActive")),
      );
    });

    it("should parse OR logical expression", () => {
      const query = () =>
        from<{ role: string; isAdmin: boolean }>("users").where(
          (x) => x.role == "admin" || x.isAdmin,
        );
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      expect(whereOp.predicate).to.deep.equal(
        expr.or(
          expr.eq(expr.column("role"), expr.constant("admin")),
          expr.booleanColumn("isAdmin"),
        ),
      );
    });

    it("should parse NOT expression", () => {
      const query = () => from<{ isActive: boolean }>("users").where((x) => !x.isActive);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      expect(whereOp.predicate).to.deep.equal(expr.not(expr.booleanColumn("isActive")));
    });

    it("should parse complex nested logical expressions", () => {
      const query = () =>
        from<{ age: number; isActive: boolean; role: string }>("users").where(
          (x) => (x.age >= 18 && x.isActive) || x.role == "admin",
        );
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      expect(whereOp.predicate).to.deep.equal(
        expr.or(
          expr.and(expr.gte(expr.column("age"), expr.constant(18)), expr.booleanColumn("isActive")),
          expr.eq(expr.column("role"), expr.constant("admin")),
        ),
      );
    });

    it("should parse string comparison", () => {
      const query = () => from<{ name: string }>("users").where((x) => x.name == "John");
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      const predicate = whereOp.predicate as ComparisonExpression;
      const leftColumn = predicate.left as ColumnExpression;
      expect(leftColumn.name).to.equal("name");
      const rightConstant = predicate.right as ConstantExpression;
      expect(rightConstant.value).to.equal("John");
    });

    it("should parse boolean literal comparison", () => {
      const query = () => from<{ isActive: boolean }>("users").where((x) => x.isActive == true);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      const predicate = whereOp.predicate as ComparisonExpression;
      expect(predicate.type).to.equal("comparison");
      const rightConstant = predicate.right as ConstantExpression;
      expect(rightConstant.type).to.equal("constant");
      expect(rightConstant.value).to.equal(true);
    });

    it("should parse null comparison", () => {
      const query = () => from<{ email: string | null }>("users").where((x) => x.email == null);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
      const predicate = whereOp.predicate as ComparisonExpression;
      expect(predicate.type).to.equal("comparison");
      const rightConstant = predicate.right as ConstantExpression;
      expect(rightConstant.type).to.equal("constant");
      expect(rightConstant.value).to.equal(null);
    });

    it("should parse multiple where clauses", () => {
      const query = () =>
        from<{ age: number; isActive: boolean }>("users")
          .where((x) => x.age >= 18)
          .where((x) => x.isActive);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("where");
      const outerWhere = asWhereOperation(result);
      expect(outerWhere.predicate.type).to.equal("booleanColumn");

      const innerWhere = asWhereOperation(outerWhere.source);
      expect(innerWhere.operationType).to.equal("where");
      expect(innerWhere.predicate.type).to.equal("comparison");
    });

    it("should parse where with external parameters", () => {
      const query = (p: { minAge: number }) =>
        from<{ age: number }>("users").where((x) => x.age >= p.minAge);
      const result = parseQuery(query);

      const whereOp = asWhereOperation(result);
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

      const whereOp = asWhereOperation(result);
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

  describe("select()", () => {
    it("should parse simple property selection", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users").select((x) => x.name);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const selectOp = asSelectOperation(result);
      const columnSelector = selectOp.selector as ColumnExpression;
      expect(columnSelector.type).to.equal("column");
      expect(columnSelector.name).to.equal("name");
    });

    it("should parse object projection", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users").select((x) => ({
          userId: x.id,
          userName: x.name,
        }));
      const result = parseQuery(query);

      const selectOp = asSelectOperation(result);
      const objectSelector = selectOp.selector as ObjectExpression;
      expect(objectSelector.type).to.equal("object");
      const userIdProp = objectSelector.properties.userId as ColumnExpression;
      expect(userIdProp.type).to.equal("column");
      expect(userIdProp.name).to.equal("id");
      const userNameProp = objectSelector.properties.userName as ColumnExpression;
      expect(userNameProp.type).to.equal("column");
      expect(userNameProp.name).to.equal("name");
    });

    it("should parse nested object projection", () => {
      const query = () =>
        from<{ id: number; name: string; city: string; country: string }>("users").select((x) => ({
          id: x.id,
          details: {
            name: x.name,
            location: {
              city: x.city,
              country: x.country,
            },
          },
        }));
      const result = parseQuery(query);

      const selectOp = asSelectOperation(result);
      const selector = selectOp.selector as ObjectExpression;
      expect(selector.type).to.equal("object");
      const detailsProp = selector.properties.details as ObjectExpression;
      expect(detailsProp.type).to.equal("object");
      const locationProp = detailsProp.properties.location as ObjectExpression;
      expect(locationProp.type).to.equal("object");
      const cityProp = locationProp.properties.city as ColumnExpression;
      expect(cityProp.name).to.equal("city");
    });

    it("should parse select with computed properties", () => {
      const query = () =>
        from<{ firstName: string; lastName: string; age: number }>("users").select((x) => ({
          fullName: x.firstName + " " + x.lastName,
          isAdult: x.age >= 18,
        }));
      const result = parseQuery(query);

      const selectOp = asSelectOperation(result);
      const selector = selectOp.selector as ObjectExpression;
      const fullNameProp = selector.properties.fullName as ConcatExpression;
      expect(fullNameProp.type).to.equal("concat");
      const isAdultProp = selector.properties.isAdult as ComparisonExpression;
      expect(isAdultProp.type).to.equal("comparison");
    });

    it("should parse select with arithmetic expressions", () => {
      const query = () =>
        from<{ salary: number; bonus: number }>("employees").select((x) => ({
          totalCompensation: x.salary + x.bonus,
          monthlySalary: x.salary / 12,
        }));
      const result = parseQuery(query);

      const selectOp = asSelectOperation(result);
      const selector = selectOp.selector as ObjectExpression;
      const totalCompProp = selector.properties.totalCompensation as ArithmeticExpression;
      expect(totalCompProp.type).to.equal("arithmetic");
      expect(totalCompProp.operator).to.equal("+");
      const monthlySalaryProp = selector.properties.monthlySalary as ArithmeticExpression;
      expect(monthlySalaryProp.type).to.equal("arithmetic");
      expect(monthlySalaryProp.operator).to.equal("/");
    });

    it("should parse select after where", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users")
          .where((x) => x.age >= 18)
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const selectOp = asSelectOperation(result);
      expect(selectOp.source.operationType).to.equal("where");
    });

    it("should parse multiple select operations", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users")
          .select((x) => ({ userId: x.id, userName: x.name, userAge: x.age }))
          .select((x) => ({ id: x.userId, displayName: x.userName }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const outerSelect = asSelectOperation(result);
      const innerSelect = asSelectOperation(outerSelect.source);
      expect(innerSelect.operationType).to.equal("select");
    });

    it("should parse select with external parameters", () => {
      const query = (p: { prefix: string }) =>
        from<{ id: number; name: string }>("users").select((x) => ({
          id: x.id,
          displayName: p.prefix + x.name,
        }));
      const result = parseQuery(query);

      const selectOp = asSelectOperation(result);
      const selector = selectOp.selector as ObjectExpression;
      const displayNameProp = selector.properties.displayName as ConcatExpression;
      expect(displayNameProp.type).to.equal("concat");
      const leftParam = displayNameProp.left as ParamRef;
      expect(leftParam.type).to.equal("param");
      expect(leftParam.param).to.equal("p");
      expect(leftParam.property).to.equal("prefix");
    });
  });

  describe("Chaining operations", () => {
    it("should parse from().where().select() chain", () => {
      const query = () =>
        from<{ id: number; name: string; age: number; isActive: boolean }>("users")
          .where((x) => x.age >= 18 && x.isActive)
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const selectOp = asSelectOperation(result);
      const whereOp = asWhereOperation(selectOp.source);
      expect(whereOp.operationType).to.equal("where");
      const fromOp = asFromOperation(whereOp.source);
      expect(fromOp.operationType).to.equal("from");
      expect(fromOp.table).to.equal("users");
    });

    it("should parse complex chain with multiple operations", () => {
      const query = () =>
        from<{ id: number; name: string; age: number; role: string }>("users")
          .where((x) => x.age >= 18)
          .where((x) => x.role == "admin")
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const selectOp = asSelectOperation(result);
      const where2 = asWhereOperation(selectOp.source);
      expect(where2.operationType).to.equal("where");
      const where2Predicate = where2.predicate as ComparisonExpression;
      const where2LeftColumn = where2Predicate.left as ColumnExpression;
      expect(where2LeftColumn.name).to.equal("role");
      const where1 = asWhereOperation(where2.source);
      expect(where1.operationType).to.equal("where");
      const where1Predicate = where1.predicate as ComparisonExpression;
      const where1LeftColumn = where1Predicate.left as ColumnExpression;
      expect(where1LeftColumn.name).to.equal("age");
    });
  });
});
