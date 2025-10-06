/**
 * Tests for FROM operation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery } from "../dist/index.js";
import type { QueryBuilder } from "../dist/index.js";
import { asFromOperation, getOperation } from "./test-utils/operation-helpers.js";
import { type TestSchema } from "./test-schema.js";

describe("FROM Operation", () => {
  it("should parse from() with simple table name", () => {
    const query = (q: QueryBuilder<TestSchema>) => q.from("users");
    const result = parseQuery(query);

    expect(getOperation(result)).to.not.be.null;
    expect(getOperation(result)?.operationType).to.equal("from");
    const fromOp = asFromOperation(getOperation(result));
    expect(fromOp.table).to.equal("users");
  });

  it("should handle different table names", () => {
    const query1 = (q: QueryBuilder<TestSchema>) => q.from("products");
    const result1 = parseQuery(query1);
    const fromOp1 = asFromOperation(getOperation(result1));
    expect(fromOp1.table).to.equal("products");

    const query2 = (q: QueryBuilder<TestSchema>) => q.from("orders");
    const result2 = parseQuery(query2);
    const fromOp2 = asFromOperation(getOperation(result2));
    expect(fromOp2.table).to.equal("orders");

    const query3 = (q: QueryBuilder<TestSchema>) => q.from("customers");
    const result3 = parseQuery(query3);
    const fromOp3 = asFromOperation(getOperation(result3));
    expect(fromOp3.table).to.equal("customers");
  });

  it("should handle table names in context", () => {
    const query = (q: QueryBuilder<TestSchema>) => q.from("employees");
    const result = parseQuery(query);
    const fromOp = asFromOperation(getOperation(result));
    expect(fromOp.table).to.equal("employees");
  });

  it("should handle departments table", () => {
    const query = (q: QueryBuilder<TestSchema>) => q.from("departments");
    const result = parseQuery(query);
    const fromOp = asFromOperation(getOperation(result));
    expect(fromOp.table).to.equal("departments");
  });
});
