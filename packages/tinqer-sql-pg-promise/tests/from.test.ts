/**
 * Tests for FROM clause generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { db, from } from "./test-schema.js";

describe("FROM SQL Generation", () => {
  it("should generate simple FROM clause", () => {
    const result = query(() => from(db, "users"), {});

    expect(result.sql).to.equal('SELECT * FROM "users" AS t0');
    expect(result.params).to.deep.equal({});
  });

  it("should handle different table names", () => {
    const result = query(() => from(db, "products"), {});

    expect(result.sql).to.equal('SELECT * FROM "products" AS t0');
  });

  it("should handle table names with underscores", () => {
    const result = query(() => from(db, "user_accounts"), {});

    expect(result.sql).to.equal('SELECT * FROM "user_accounts" AS t0');
  });
});
