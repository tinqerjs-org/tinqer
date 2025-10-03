import type {
  QueryOperation,
  JoinOperation,
  GroupJoinOperation,
  SelectManyOperation,
  DefaultIfEmptyOperation,
} from "../query-tree/operations.js";

export function normalizeJoins(operation: QueryOperation): QueryOperation {
  return operation;
}
