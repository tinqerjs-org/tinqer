/**
 * Tests for FROM clause generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { selectStatement } from "../dist/index.js";
import { db } from "./test-schema.js";

describe("FROM SQL Generation", () => {
  it("should generate simple FROM clause", () => {
    const result = selectStatement(db, (ctx) => ctx.from("users"), {});

    expect(result.sql).to.equal('SELECT * FROM "users"');
    expect(result.params).to.deep.equal({});
  });

  it("should handle different table names", () => {
    const result = selectStatement(db, (ctx) => ctx.from("products"), {});

    expect(result.sql).to.equal('SELECT * FROM "products"');
  });

  it("should handle table names with underscores", () => {
    const result = selectStatement(db, (ctx) => ctx.from("user_accounts"), {});

    expect(result.sql).to.equal('SELECT * FROM "user_accounts"');
  });
});
