/**
 * Tests for SELECT operation and projections
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import { asSelectOperation, asWhereOperation } from "./test-utils/operation-helpers.js";
import type {
  ObjectExpression,
  ColumnExpression,
  ConcatExpression,
  ArithmeticExpression,
  ComparisonExpression,
} from "../src/expressions/expression.js";
import type { ParamRef } from "../src/query-tree/operations.js";

describe("SELECT Operation", () => {
  describe("Simple Projections", () => {
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
  });

  describe("Nested Projections", () => {
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
  });

  describe("Computed Properties", () => {
    it("should parse select with computed string properties", () => {
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
  });

  describe("Chained SELECT Operations", () => {
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
  });

  describe("External Parameters", () => {
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
});
