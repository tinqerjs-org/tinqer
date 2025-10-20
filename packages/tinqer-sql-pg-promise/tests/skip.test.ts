import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect, createSchema } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";

describe("Skip SQL Generation", () => {
  interface User {
    id: number;
    name: string;
    age: number;
  }

  interface Schema {
    users: User;
  }

  const schema = createSchema<Schema>();

  it("should generate OFFSET clause", () => {
    const result = toSql(defineSelect(schema, (q) => q.from("users").skip(10)), {});

    expect(result.sql).to.equal('SELECT * FROM "users" OFFSET $(__p1)');
    expect(result.params).to.deep.equal({ __p1: 10 });
  });

  it("should combine skip with take for pagination", () => {
    const result = toSql(defineSelect(schema, (q) => q.from("users").skip(20).take(10)), {});

    expect(result.sql).to.equal('SELECT * FROM "users" LIMIT $(__p2) OFFSET $(__p1)');
    expect(result.params).to.deep.equal({ __p2: 10, __p1: 20 });
  });

  it("should combine skip with where and orderBy", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("users")
            .where((u) => u.age >= 21)
            .orderBy((u) => u.name)
            .skip(5),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "users" WHERE "age" >= $(__p1) ORDER BY "name" ASC OFFSET $(__p2)',
    );
    expect(result.params).to.deep.equal({ __p1: 21, __p2: 5 });
  });

  it("should throw error when using local variables", () => {
    const pageSize = 25;
    const pageNumber = 3; // 0-based

    // Local variables should NOT work - parser should return null and throw error
    expect(() => {
      toSql(
        defineSelect(
          schema,
          (q) =>
            q
              .from("users")
              .orderBy((u) => u.id)
              .skip(pageNumber * pageSize)
              .take(pageSize),
        ),
        {},
      );
    }).to.throw("Failed to parse query");
  });
});
