/**
 * Tests for basic query operations: from, where, select
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import { expr } from "./test-utils/expr-helpers.js";

describe("Basic Query Operations", () => {
  describe("from()", () => {
    it("should parse from() with simple table name", () => {
      const query = () => from<{ id: number; name: string }>("users");
      const result = parseQuery(query);

      expect(result).to.not.be.null;
      expect(result?.operationType).to.equal("from");
      expect((result as any).table).to.equal("users");
    });

    it("should handle different table names", () => {
      const query1 = () => from<{ id: number }>("products");
      const result1 = parseQuery(query1);
      expect((result1 as any).table).to.equal("products");

      const query2 = () => from<{ id: number }>("orders");
      const result2 = parseQuery(query2);
      expect((result2 as any).table).to.equal("orders");

      const query3 = () => from<{ id: number }>("customer_details");
      const result3 = parseQuery(query3);
      expect((result3 as any).table).to.equal("customer_details");
    });
  });

  describe("where()", () => {
    it("should parse simple equality comparison", () => {
      const query = () => from<{ id: number; name: string }>("users").where((x) => x.id == 1);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("where");
      const predicate = (result as any).predicate;
      expect(predicate).to.deep.equal(expr.eq(expr.column("id"), expr.constant(1)));
    });

    it("should parse inequality comparison", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age != 30);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate).to.deep.equal(expr.ne(expr.column("age"), expr.constant(30)));
    });

    it("should parse greater than comparison", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age > 18);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate).to.deep.equal(expr.gt(expr.column("age"), expr.constant(18)));
    });

    it("should parse greater than or equal comparison", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age >= 21);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate).to.deep.equal(expr.gte(expr.column("age"), expr.constant(21)));
    });

    it("should parse less than comparison", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age < 65);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate).to.deep.equal(expr.lt(expr.column("age"), expr.constant(65)));
    });

    it("should parse less than or equal comparison", () => {
      const query = () => from<{ age: number }>("users").where((x) => x.age <= 100);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate).to.deep.equal(expr.lte(expr.column("age"), expr.constant(100)));
    });

    it("should parse AND logical expression", () => {
      const query = () =>
        from<{ age: number; isActive: boolean }>("users").where((x) => x.age >= 18 && x.isActive);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate).to.deep.equal(
        expr.and(expr.gte(expr.column("age"), expr.constant(18)), expr.booleanColumn("isActive")),
      );
    });

    it("should parse OR logical expression", () => {
      const query = () =>
        from<{ role: string; isAdmin: boolean }>("users").where(
          (x) => x.role == "admin" || x.isAdmin,
        );
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate).to.deep.equal(
        expr.or(
          expr.eq(expr.column("role"), expr.constant("admin")),
          expr.booleanColumn("isAdmin"),
        ),
      );
    });

    it("should parse NOT expression", () => {
      const query = () => from<{ isActive: boolean }>("users").where((x) => !x.isActive);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate).to.deep.equal(expr.not(expr.booleanColumn("isActive")));
    });

    it("should parse complex nested logical expressions", () => {
      const query = () =>
        from<{ age: number; isActive: boolean; role: string }>("users").where(
          (x) => (x.age >= 18 && x.isActive) || x.role == "admin",
        );
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate).to.deep.equal(
        expr.or(
          expr.and(expr.gte(expr.column("age"), expr.constant(18)), expr.booleanColumn("isActive")),
          expr.eq(expr.column("role"), expr.constant("admin")),
        ),
      );
    });

    it("should parse string comparison", () => {
      const query = () => from<{ name: string }>("users").where((x) => x.name == "John");
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate.left.name).to.equal("name");
      expect(predicate.right.value).to.equal("John");
    });

    it("should parse boolean literal comparison", () => {
      const query = () => from<{ isActive: boolean }>("users").where((x) => x.isActive == true);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate.type).to.equal("comparison");
      expect(predicate.right.type).to.equal("constant");
      expect(predicate.right.value).to.equal(true);
    });

    it("should parse null comparison", () => {
      const query = () => from<{ email: string | null }>("users").where((x) => x.email == null);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate.type).to.equal("comparison");
      expect(predicate.right.type).to.equal("constant");
      expect(predicate.right.value).to.equal(null);
    });

    it("should parse multiple where clauses", () => {
      const query = () =>
        from<{ age: number; isActive: boolean }>("users")
          .where((x) => x.age >= 18)
          .where((x) => x.isActive);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("where");
      const outerWhere = result as any;
      expect(outerWhere.predicate.type).to.equal("booleanColumn");

      const innerWhere = outerWhere.source;
      expect(innerWhere.operationType).to.equal("where");
      expect(innerWhere.predicate.type).to.equal("comparison");
    });

    it("should parse where with external parameters", () => {
      const query = (p: { minAge: number }) =>
        from<{ age: number }>("users").where((x) => x.age >= p.minAge);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate.right.type).to.equal("param");
      expect(predicate.right.param).to.equal("p");
      expect(predicate.right.property).to.equal("minAge");
    });

    it("should parse where with multiple external parameters", () => {
      const query = (p: { minAge: number; maxAge: number }) =>
        from<{ age: number }>("users").where((x) => x.age >= p.minAge && x.age <= p.maxAge);
      const result = parseQuery(query);

      const predicate = (result as any).predicate;
      expect(predicate.type).to.equal("logical");
      expect(predicate.left.right.param).to.equal("p");
      expect(predicate.left.right.property).to.equal("minAge");
      expect(predicate.right.right.param).to.equal("p");
      expect(predicate.right.right.property).to.equal("maxAge");
    });
  });

  describe("select()", () => {
    it("should parse simple property selection", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users").select((x) => x.name);
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const selector = (result as any).selector;
      expect(selector.type).to.equal("column");
      expect(selector.name).to.equal("name");
    });

    it("should parse object projection", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users").select((x) => ({
          userId: x.id,
          userName: x.name,
        }));
      const result = parseQuery(query);

      const selector = (result as any).selector;
      expect(selector.type).to.equal("object");
      expect(selector.properties.userId.type).to.equal("column");
      expect(selector.properties.userId.name).to.equal("id");
      expect(selector.properties.userName.type).to.equal("column");
      expect(selector.properties.userName.name).to.equal("name");
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

      const selector = (result as any).selector;
      expect(selector.type).to.equal("object");
      expect(selector.properties.details.type).to.equal("object");
      expect(selector.properties.details.properties.location.type).to.equal("object");
      expect(selector.properties.details.properties.location.properties.city.name).to.equal("city");
    });

    it("should parse select with computed properties", () => {
      const query = () =>
        from<{ firstName: string; lastName: string; age: number }>("users").select((x) => ({
          fullName: x.firstName + " " + x.lastName,
          isAdult: x.age >= 18,
        }));
      const result = parseQuery(query);

      const selector = (result as any).selector;
      expect(selector.properties.fullName.type).to.equal("concat");
      expect(selector.properties.isAdult.type).to.equal("comparison");
    });

    it("should parse select with arithmetic expressions", () => {
      const query = () =>
        from<{ salary: number; bonus: number }>("employees").select((x) => ({
          totalCompensation: x.salary + x.bonus,
          monthlySalary: x.salary / 12,
        }));
      const result = parseQuery(query);

      const selector = (result as any).selector;
      expect(selector.properties.totalCompensation.type).to.equal("arithmetic");
      expect(selector.properties.totalCompensation.operator).to.equal("+");
      expect(selector.properties.monthlySalary.type).to.equal("arithmetic");
      expect(selector.properties.monthlySalary.operator).to.equal("/");
    });

    it("should parse select after where", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users")
          .where((x) => x.age >= 18)
          .select((x) => ({ id: x.id, name: x.name }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const source = (result as any).source;
      expect(source.operationType).to.equal("where");
    });

    it("should parse multiple select operations", () => {
      const query = () =>
        from<{ id: number; name: string; age: number }>("users")
          .select((x) => ({ userId: x.id, userName: x.name, userAge: x.age }))
          .select((x) => ({ id: x.userId, displayName: x.userName }));
      const result = parseQuery(query);

      expect(result?.operationType).to.equal("select");
      const innerSelect = (result as any).source;
      expect(innerSelect.operationType).to.equal("select");
    });

    it("should parse select with external parameters", () => {
      const query = (p: { prefix: string }) =>
        from<{ id: number; name: string }>("users").select((x) => ({
          id: x.id,
          displayName: p.prefix + x.name,
        }));
      const result = parseQuery(query);

      const selector = (result as any).selector;
      expect(selector.properties.displayName.type).to.equal("concat");
      expect(selector.properties.displayName.left.type).to.equal("param");
      expect(selector.properties.displayName.left.param).to.equal("p");
      expect(selector.properties.displayName.left.property).to.equal("prefix");
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
      const whereOp = (result as any).source;
      expect(whereOp.operationType).to.equal("where");
      const fromOp = whereOp.source;
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
      const where2 = (result as any).source;
      expect(where2.operationType).to.equal("where");
      expect(where2.predicate.left.name).to.equal("role");
      const where1 = where2.source;
      expect(where1.operationType).to.equal("where");
      expect(where1.predicate.left.name).to.equal("age");
    });
  });
});
