/**
 * Tests for chaining multiple query operations
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import {
  asFromOperation,
  asWhereOperation,
  asSelectOperation,
  asOrderByOperation,
  asSkipOperation,
  asTakeOperation,
} from "./test-utils/operation-helpers.js";
import type { ComparisonExpression, ColumnExpression } from "../src/expressions/expression.js";

describe("Operation Chaining", () => {
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

  it("should parse complex chain with multiple where operations", () => {
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

  it("should parse chain with select-where-select", () => {
    const query = () =>
      from<{ id: number; firstName: string; lastName: string; age: number }>("users")
        .select((x) => ({ id: x.id, fullName: x.firstName + " " + x.lastName, age: x.age }))
        .where((x) => x.age >= 18)
        .select((x) => ({ userId: x.id, displayName: x.fullName }));
    const result = parseQuery(query);

    expect(result?.operationType).to.equal("select");
    const outerSelect = asSelectOperation(result);
    const whereOp = asWhereOperation(outerSelect.source);
    expect(whereOp.operationType).to.equal("where");
    const innerSelect = asSelectOperation(whereOp.source);
    expect(innerSelect.operationType).to.equal("select");
    const fromOp = asFromOperation(innerSelect.source);
    expect(fromOp.operationType).to.equal("from");
    expect(fromOp.table).to.equal("users");
  });

  it("should parse pagination with filtering and ordering", () => {
    const query = () =>
      from<{ id: number; category: string; price: number; inStock: boolean }>("products")
        .where((x) => x.inStock)
        .orderByDescending((x) => x.price)
        .skip(10)
        .take(20)
        .select((x) => ({ id: x.id, price: x.price }));
    const result = parseQuery(query);

    expect(result?.operationType).to.equal("select");
    const selectOp = asSelectOperation(result);
    const takeOp = asTakeOperation(selectOp.source);
    expect(takeOp.operationType).to.equal("take");
    expect(takeOp.count).to.equal(20);
    const skipOp = asSkipOperation(takeOp.source);
    expect(skipOp.operationType).to.equal("skip");
    expect(skipOp.count).to.equal(10);
    const orderByOp = asOrderByOperation(skipOp.source);
    expect(orderByOp.operationType).to.equal("orderBy");
    expect(orderByOp.descending).to.equal(true);
    expect(orderByOp.source.operationType).to.equal("where");
  });
});
