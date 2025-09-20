/**
 * Tests for parseQuery function
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseQuery, from } from "../src/index.js";

describe("parseQuery", () => {
  it("should parse a simple from query", () => {
    const query = () => from<{ id: number; name: string }>("users");
    const result = parseQuery(query);

    expect(result).to.not.be.null;
    expect(result?.operationType).to.equal("from");
    expect((result as any).table).to.equal("users");
  });

  it("should parse a where clause", () => {
    const query = () => from<{ id: number; age: number }>("users").where((x) => x.age >= 18);
    const result = parseQuery(query);

    expect(result).to.not.be.null;
    expect(result?.operationType).to.equal("where");
    expect((result as any).source.operationType).to.equal("from");
    expect((result as any).predicate.type).to.equal("comparison");
  });

  it("should parse a select projection", () => {
    const query = () =>
      from<{ id: number; name: string; age: number }>("users").select((x) => ({
        id: x.id,
        name: x.name,
      }));
    const result = parseQuery(query);

    expect(result).to.not.be.null;
    expect(result?.operationType).to.equal("select");
    expect((result as any).selector.type).to.equal("object");
  });

  it("should parse a complex query chain", () => {
    const query = (): any =>
      from("users" as any)
        .where((x: any) => x.age >= 18 && x.isActive)
        .select((x: any) => ({ id: x.id, name: x.name }))
        .orderBy((x: any) => x.name)
        .take(10);
    const result = parseQuery(query);

    expect(result).to.not.be.null;
    expect(result?.operationType).to.equal("take");
    expect((result as any).count).to.equal(10);

    const orderBy: any = (result as any).source;
    expect(orderBy.operationType).to.equal("orderBy");
    expect(orderBy.keySelector).to.equal("name");

    const select: any = orderBy.source;
    expect(select.operationType).to.equal("select");

    const where: any = select.source;
    expect(where.operationType).to.equal("where");
    expect(where.predicate.type).to.equal("logical");

    const from: any = where.source;
    expect(from.operationType).to.equal("from");
    expect(from.table).to.equal("users");
  });

  it("should parse query with external parameters", () => {
    const query = (p: { minAge: number }) =>
      from<{ id: number; age: number }>("users").where((x) => x.age >= p.minAge);
    const result = parseQuery(query);

    expect(result).to.not.be.null;
    expect(result?.operationType).to.equal("where");
    const predicate = (result as any).predicate;
    expect(predicate.type).to.equal("comparison");
    expect(predicate.left.type).to.equal("column");
    expect(predicate.left.name).to.equal("age");
    expect(predicate.right.type).to.equal("param");
    expect(predicate.right.param).to.equal("p");
    expect(predicate.right.property).to.equal("minAge");
  });

  it("should parse terminal operations", () => {
    const query1 = () => from<{ id: number }>("users").count();
    const result1 = parseQuery(query1);
    expect(result1?.operationType).to.equal("count");

    const query2 = () => from<{ id: number }>("users").first();
    const result2 = parseQuery(query2);
    expect(result2?.operationType).to.equal("first");

    const query3 = () => from<{ id: number }>("users").toArray();
    const result3 = parseQuery(query3);
    expect(result3?.operationType).to.equal("toArray");
  });

  it("should parse string methods", () => {
    const query = () => from<{ name: string }>("users").where((x) => x.name.startsWith("John"));
    const result = parseQuery(query);

    expect(result).to.not.be.null;
    const predicate = (result as any).predicate;
    expect(predicate.type).to.equal("booleanMethod");
    expect(predicate.method).to.equal("startsWith");
    expect(predicate.object.type).to.equal("column");
    expect(predicate.object.name).to.equal("name");
  });
});
