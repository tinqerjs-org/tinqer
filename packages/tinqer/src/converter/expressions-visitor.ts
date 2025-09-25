/**
 * Expression conversion using visitor architecture
 * Replacement for the monolithic expressions.ts
 */

import type { Expression } from "../expressions/expression.js";
import type { Expression as ASTExpression } from "../parser/ast-types.js";
import type { ConversionContext } from "./converter-utils.js";

import { visitExpression } from "../visitors/index.js";
import type { VisitorContext } from "../visitors/types.js";

/**
 * Convert legacy ConversionContext to new VisitorContext
 */
function toVisitorContext(context: ConversionContext): VisitorContext {
  // Map auto params to the new format
  const autoParams = new Map<string, unknown>();
  for (const [name, info] of context.autoParams) {
    autoParams.set(name, info.value);
  }

  return {
    tableParams: context.tableParams,
    queryParams: context.queryParams,
    groupingParams: context.groupingParams,
    autoParams,
    autoParamCounter: 0, // Start from 0 so first param is __p1
    joinParams: context.joinParams,
    joinResultParam: context.joinResultParam,
    currentResultShape: context.currentResultShape,
    currentTable: context.currentTable,
    inSelectProjection: context.inSelectProjection,
    hasTableParam: context.hasTableParam,
  };
}

/**
 * Convert visitor context back to legacy context
 */
function fromVisitorContext(visitorCtx: VisitorContext, originalCtx: ConversionContext): void {
  // Update auto params
  originalCtx.autoParamCounter = visitorCtx.autoParamCounter;

  // Convert new auto params back to enhanced format
  for (const [name, value] of visitorCtx.autoParams) {
    if (!originalCtx.autoParams.has(name)) {
      originalCtx.autoParams.set(name, {
        value: value as string | number | boolean | null,
      });
    }
  }
}

/**
 * Main entry point - converts AST to Expression using visitors
 * Drop-in replacement for convertAstToExpression
 */
export function convertAstToExpression(
  ast: ASTExpression,
  context: ConversionContext
): Expression | null {
  // Convert to visitor context
  const visitorCtx = toVisitorContext(context);

  // Use visitor architecture
  const result = visitExpression(ast, visitorCtx);

  // Update original context with any changes
  fromVisitorContext(visitorCtx, context);

  return result;
}