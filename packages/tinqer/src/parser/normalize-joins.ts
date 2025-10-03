import type {
  QueryOperation,
  JoinOperation,
  GroupJoinOperation,
  SelectManyOperation,
} from "../query-tree/operations.js";
import type { Expression, ObjectExpression } from "../expressions/expression.js";
import { buildResultShape } from "../visitors/join/shape.js";

function isQueryOperation(value: unknown): value is QueryOperation {
  return (
    !!value && typeof value === "object" && "operationType" in (value as Record<string, unknown>)
  );
}

function normalizeSelectMany(operation: SelectManyOperation): QueryOperation {
  const normalizedSource = normalizeJoins(operation.source);
  operation.source = normalizedSource;

  if (normalizedSource.operationType !== "groupJoin") {
    return operation;
  }

  const groupJoin = normalizedSource as GroupJoinOperation;

  if (
    !operation.usesDefaultIfEmpty ||
    !operation.collectionPropertyPath ||
    operation.collectionPropertyPath.length === 0 ||
    !groupJoin.groupBindingName ||
    operation.collectionPropertyPath[0] !== groupJoin.groupBindingName ||
    !operation.resultBindings ||
    operation.resultBindings.length === 0
  ) {
    return operation;
  }

  const normalizedOuterSource = normalizeJoins(groupJoin.source);
  const normalizedInnerSource = normalizeJoins(groupJoin.inner);

  const properties: Record<string, Expression> = {};

  for (const binding of operation.resultBindings) {
    const paramIndex = binding.source === "outer" ? 0 : 1;
    properties[binding.name] = {
      type: "reference",
      source: { type: "joinParam", paramIndex },
    } as Expression;
  }

  const resultSelector: ObjectExpression = {
    type: "object",
    properties,
  };

  const resultShape = buildResultShape(resultSelector, "__outer", "__inner");

  const joinOperation: JoinOperation = {
    type: "queryOperation",
    operationType: "join",
    source: normalizedOuterSource,
    inner: normalizedInnerSource,
    outerKey: groupJoin.outerKey,
    innerKey: groupJoin.innerKey,
    outerKeySource: groupJoin.outerKeySource,
    resultSelector,
    resultShape,
    joinType: "left",
  };

  return joinOperation;
}

export function normalizeJoins(operation: QueryOperation): QueryOperation {
  if (operation.operationType === "selectMany") {
    return normalizeSelectMany(operation as SelectManyOperation);
  }

  if ((operation as QueryOperation & { source?: QueryOperation }).source) {
    const current = operation as QueryOperation & { source?: QueryOperation };
    if (current.source) {
      current.source = normalizeJoins(current.source);
    }
  }

  if ((operation as GroupJoinOperation).inner) {
    const op = operation as GroupJoinOperation & { inner?: QueryOperation };
    if (op.inner && isQueryOperation(op.inner)) {
      op.inner = normalizeJoins(op.inner);
    }
  }

  return operation;
}
