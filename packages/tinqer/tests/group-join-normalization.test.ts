import { expect } from "chai";
import { parseQuery, from } from "../dist/index.js";

describe("GroupJoin normalization", () => {
  it("converts groupJoin + selectMany + defaultIfEmpty into left join", () => {
    interface User {
      id: number;
      deptId: number;
    }

    interface Department {
      id: number;
      name: string;
    }

    const result = parseQuery(() =>
      from<User>("users")
        .groupJoin(
          from<Department>("departments"),
          (u) => u.deptId,
          (d) => d.id,
          (u, deptGroup) => ({ user: u, deptGroup }),
        )
        .selectMany(
          (g) => g.deptGroup.defaultIfEmpty(),
          (g, dept) => ({ user: g.user, dept }),
        )
        .select((x) => ({ userId: x.user.id, deptName: x.dept && x.dept.name })),
    );

    expect(result).to.not.equal(null);
    const operation = (result as { operation: { operationType: string; source: unknown } })
      .operation as { operationType: string; source: unknown };
    expect(operation.operationType).to.equal("select");
    const selectSource = (operation as { source: unknown }).source as {
      operationType: string;
      joinType?: string;
      outerKey?: string;
      innerKey?: string;
    };
    expect(selectSource.operationType).to.equal("join");
    const joinOp = selectSource as {
      joinType?: string;
      outerKey?: string;
      innerKey?: string;
    };
    expect(joinOp.joinType).to.equal("left");
    expect(joinOp.outerKey).to.equal("deptId");
    expect(joinOp.innerKey).to.equal("id");
  });
});
