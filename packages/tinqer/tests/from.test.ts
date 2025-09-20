/**
 * Tests for FROM operation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";
import { asFromOperation } from "./test-utils/operation-helpers.js";

describe("FROM Operation", () => {
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

  it("should handle table names with underscores", () => {
    const query = () => from<{ id: number }>("user_profiles");
    const result = parseQuery(query);
    const fromOp = asFromOperation(result);
    expect(fromOp.table).to.equal("user_profiles");
  });

  it("should handle table names with numbers", () => {
    const query = () => from<{ id: number }>("logs2024");
    const result = parseQuery(query);
    const fromOp = asFromOperation(result);
    expect(fromOp.table).to.equal("logs2024");
  });
});
