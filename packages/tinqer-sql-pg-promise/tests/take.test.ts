import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

describe("Take SQL Generation", () => {
  interface User {
    id: number;
    name: string;
    age: number;
  }

  it("should generate LIMIT clause", () => {
    const result = query(() => from<User>("users").take(10), {});

    expect(result.sql).to.equal('SELECT * FROM "users" AS "t0" LIMIT $(_limit1)');
    expect(result.params).to.deep.equal({ _limit1: 10 });
  });

  it("should handle take(1)", () => {
    const result = query(() => from<User>("users").take(1), {});

    expect(result.sql).to.equal('SELECT * FROM "users" AS "t0" LIMIT $(_limit1)');
    expect(result.params).to.deep.equal({ _limit1: 1 });
  });

  it("should combine take with where", () => {
    const result = query(
      () =>
        from<User>("users")
          .where((u) => u.age > 18)
          .take(5),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS "t0" WHERE "age" > $(_age1) LIMIT $(_limit1)',
    );
    expect(result.params).to.deep.equal({ _age1: 18, _limit1: 5 });
  });

  it("should combine take with orderBy", () => {
    const result = query(
      () =>
        from<User>("users")
          .orderBy((u) => u.name)
          .take(3),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS "t0" ORDER BY "name" ASC LIMIT $(_limit1)',
    );
    expect(result.params).to.deep.equal({ _limit1: 3 });
  });
});
