import { expect } from "chai";
import { parseQuery, from } from "../dist/index.js";

describe("Cross join normalization", () => {
  it("converts selectMany with query collection into cross join", () => {
    interface User {
      id: number;
      name: string;
    }

    interface Order {
      id: number;
      userId: number;
    }

    const result = parseQuery(() =>
      from<User>("users")
        .selectMany(
          () => from<Order>("orders"),
          (user, order) => ({ user, order }),
        )
        .select((row) => ({ userId: row.user.id, orderId: row.order.id })),
    );

    expect(result).to.not.equal(null);
    interface OperationWithSource {
      operationType: string;
      source: {
        operationType: string;
        joinType?: string;
      };
    }
    const operation = (result as unknown as { operation: OperationWithSource }).operation;
    expect(operation.operationType).to.equal("select");
    const selectSource = operation.source;
    expect(selectSource.operationType).to.equal("join");
    const joinOp = selectSource as { joinType?: string };
    expect(joinOp.joinType).to.equal("cross");
  });
});
