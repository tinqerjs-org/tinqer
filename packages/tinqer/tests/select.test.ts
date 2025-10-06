/**
 * Tests for SELECT operation and projections
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery } from "../dist/index.js";
import type { QueryBuilder } from "../dist/index.js";
import { type TestSchema } from "./test-schema.js";
import { asSelectOperation, getOperation } from "./test-utils/operation-helpers.js";
import type { ObjectExpression, ColumnExpression } from "../dist/expressions/expression.js";

describe("SELECT Operation", () => {
  describe("Simple Projections", () => {
    it("should parse simple property selection", () => {
      const query = (ctx: QueryBuilder<TestSchema>) => ctx.from("users").select((x) => x.name);
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("select");
      const selectOp = asSelectOperation(getOperation(result));
      const columnSelector = selectOp.selector as ColumnExpression;
      expect(columnSelector.type).to.equal("column");
      expect(columnSelector.name).to.equal("name");
    });

    it("should parse object projection", () => {
      const query = (ctx: QueryBuilder<TestSchema>) =>
        ctx.from("users").select((x) => ({
          userId: x.id,
          userName: x.name,
        }));
      const result = parseQuery(query);

      const selectOp = asSelectOperation(getOperation(result));
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
      const query = (ctx: QueryBuilder<TestSchema>) =>
        ctx.from("users").select((x) => ({
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

      const selectOp = asSelectOperation(getOperation(result));
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
    // Tests removed: Expressions in SELECT are not supported
    // SELECT projections must be simple column/field selection
    // All computations must be done in application code
  });

  describe("Chained SELECT Operations", () => {
    it("should parse select after where", () => {
      const query = (ctx: QueryBuilder<TestSchema>) =>
        ctx
          .from("users")
          .where((x) => x.age >= 18)
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("select");
      const selectOp = asSelectOperation(getOperation(result));
      expect(selectOp.source.operationType).to.equal("where");
    });

    it("should parse multiple select operations", () => {
      const query = (ctx: QueryBuilder<TestSchema>) =>
        ctx
          .from("users")
          .select((x) => ({ userId: x.id, userName: x.name, userAge: x.age }))
          .select((x) => ({ id: x.userId, displayName: x.userName }));
      const result = parseQuery(query);

      expect(getOperation(result)?.operationType).to.equal("select");
      const outerSelect = asSelectOperation(getOperation(result));
      const innerSelect = asSelectOperation(outerSelect.source);
      expect(innerSelect.operationType).to.equal("select");
    });
  });

  describe("External Parameters", () => {
    // Test removed: String concatenation with external parameters in SELECT is not supported
    // SELECT projections must be simple column/field selection
  });
});
