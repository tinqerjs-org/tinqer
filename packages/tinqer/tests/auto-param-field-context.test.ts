/**
 * Tests for enhanced auto-parameter field context tracking
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../dist/index.js";
import { db } from "./test-schema.js";

describe("Auto-Parameter Field Context", () => {
  it("should store field context for comparison operations", () => {
    const query = () => from(db, "users").where((x) => x.age >= 18 && x.name == "John");
    const result = parseQuery(query);

    expect(result?.autoParams).to.deep.equal({
      __p1: 18,
      __p2: "John",
    });

    // Check enhanced field context information
    expect(result?.autoParamInfos).to.exist;
    expect(result?.autoParamInfos?.__p1).to.deep.equal({
      value: 18,
      fieldName: "age",
      tableName: "users",
      sourceTable: undefined,
    });
    expect(result?.autoParamInfos?.__p2).to.deep.equal({
      value: "John",
      fieldName: "name",
      tableName: "users",
      sourceTable: undefined,
    });
  });

  it("should store field context for TAKE/SKIP operations", () => {
    const query = () => from(db, "users").skip(10).take(25);
    const result = parseQuery(query);

    expect(result?.autoParams).to.deep.equal({
      __p1: 10,
      __p2: 25,
    });

    // Check enhanced field context information
    expect(result?.autoParamInfos).to.exist;
    expect(result?.autoParamInfos?.__p1).to.deep.equal({
      value: 10,
      fieldName: "OFFSET",
      tableName: undefined,
      sourceTable: undefined,
    });
    expect(result?.autoParamInfos?.__p2).to.deep.equal({
      value: 25,
      fieldName: "LIMIT",
      tableName: undefined,
      sourceTable: undefined,
    });
  });

  it("should store field context for arithmetic expressions", () => {
    const query = () => from(db, "products").where((x) => x.price + 10 > 100);
    const result = parseQuery(query);

    expect(result?.autoParams).to.deep.equal({
      __p1: 10,
      __p2: 100,
    });

    // Check enhanced field context information
    expect(result?.autoParamInfos).to.exist;
    expect(result?.autoParamInfos?.__p1).to.deep.equal({
      value: 10,
      fieldName: "price", // Extracted from left side of arithmetic
      tableName: "products",
      sourceTable: undefined,
    });
    expect(result?.autoParamInfos?.__p2).to.deep.equal({
      value: 100,
      fieldName: undefined, // Right side of comparison, no specific field
      tableName: "products", // Table context is preserved
      sourceTable: undefined,
    });
  });

  it("should store field context for negative numbers", () => {
    const query = () => from(db, "items").where((x) => x.value > -1000);
    const result = parseQuery(query);

    expect(result?.autoParams).to.deep.equal({
      __p1: -1000,
    });

    // Check enhanced field context information
    expect(result?.autoParamInfos).to.exist;
    expect(result?.autoParamInfos?.__p1).to.deep.equal({
      value: -1000,
      fieldName: undefined, // Negative literals don't get field context yet
      tableName: undefined,
      sourceTable: undefined,
    });
  });

  it("should handle constants without field context", () => {
    const query = () => from(db, "items").where((_x) => 5 < 10);
    const result = parseQuery(query);

    expect(result?.autoParams).to.deep.equal({
      __p1: 5,
      __p2: 10,
    });

    // Check enhanced field context information
    expect(result?.autoParamInfos).to.exist;
    expect(result?.autoParamInfos?.__p1).to.deep.equal({
      value: 5,
      fieldName: undefined, // No field context for standalone literals
      tableName: "items",
      sourceTable: undefined,
    });
    expect(result?.autoParamInfos?.__p2).to.deep.equal({
      value: 10,
      fieldName: undefined,
      tableName: "items",
      sourceTable: undefined,
    });
  });
});
