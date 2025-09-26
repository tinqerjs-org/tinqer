/**
 * JOIN operation visitors
 * Re-exports from separate files
 */

export { visitJoinOperation } from "./join.js";
export { visitJoinResultSelector } from "./result-selector.js";
export { visitJoinExpression } from "./expression.js";
export { buildResultShape, buildShapeNode } from "./shape.js";
export type { JoinContext } from "./context.js";
