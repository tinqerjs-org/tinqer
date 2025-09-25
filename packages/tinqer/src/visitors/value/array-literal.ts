/**
 * Visitor for array literal expressions
 * Creates array expressions from AST array literals
 */

import type {
  ArrayExpression,
  Expression,
} from "../../expressions/expression.js";

import type { ArrayExpression as ASTArrayExpression } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";

/**
 * Visit an array literal expression
 */
export function visitArray(
  node: ASTArrayExpression,
  context: VisitorContext,
  visitExpression: (node: unknown, ctx: VisitorContext) => Expression | null
): ArrayExpression | null {
  const elements: Expression[] = [];

  for (const element of node.elements) {
    if (element) {
      const expr = visitExpression(element, context);
      if (expr) {
        elements.push(expr);
      }
    }
  }

  return {
    type: "array",
    elements,
  };
}