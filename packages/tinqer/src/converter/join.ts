/**
 * JOIN operation converter
 */

import type { JoinOperation, QueryOperation, ResultShape, ShapeProperty } from "../query-tree/operations.js";
import type { ColumnExpression, Expression, ObjectExpression } from "../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  Expression as ASTExpression,
} from "../parser/ast-types.js";
import type { ConversionContext } from "./converter-utils.js";
import { getParameterName, getReturnExpression } from "./converter-utils.js";
import { convertAstToExpression } from "./expressions.js";
import { convertMethodChain } from "./ast-converter.js";

/**
 * Build a ResultShape from a JOIN result selector expression
 */
function buildResultShape(
  expr: Expression | undefined,
  outerParam: string | null,
  innerParam: string | null,
): ResultShape | undefined {
  if (!expr || expr.type !== "object") {
    return undefined;
  }

  const objExpr = expr as ObjectExpression;
  const shape: ResultShape = {
    properties: new Map<string, ShapeProperty>(),
  };

  for (const [propName, propExpr] of Object.entries(objExpr.properties)) {
    // Check if this is a reference to one of the JOIN parameters
    if (propExpr.type === "column") {
      const colExpr = propExpr as ColumnExpression;

      // Check if this references the outer or inner parameter
      if (colExpr.table === outerParam && outerParam) {
        // This property references the outer table
        shape.properties.set(propName, {
          sourceTable: 0,
          columnName: colExpr.name,
        });
      } else if (colExpr.table === innerParam && innerParam) {
        // This property references the inner table
        shape.properties.set(propName, {
          sourceTable: 1,
          columnName: colExpr.name,
        });
      } else if (!colExpr.table) {
        // Direct parameter reference (e.g., { orderItem: oi })
        if (colExpr.name === outerParam && outerParam) {
          shape.properties.set(propName, {
            sourceTable: 0,
            // This represents the entire outer table row
          });
        } else if (colExpr.name === innerParam && innerParam) {
          shape.properties.set(propName, {
            sourceTable: 1,
            // This represents the entire inner table row
          });
        }
      }
    }
  }

  return shape;
}

export function convertJoinOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  context: ConversionContext,
): JoinOperation | null {
  if (ast.arguments && ast.arguments.length >= 4) {
    // join(inner, outerKeySelector, innerKeySelector, resultSelector)
    const firstArg = ast.arguments[0];
    const innerSource = firstArg ? convertMethodChain(firstArg as ASTExpression, context) : null;
    const outerKeySelectorAst = ast.arguments[1];
    const innerKeySelectorAst = ast.arguments[2];
    const resultSelectorAst = ast.arguments[3]; // Capture the result selector

    let outerKey: string | null = null;
    let innerKey: string | null = null;
    let outerKeySource: number | undefined = undefined;
    let outerParam: string | null = null;
    let innerParam: string | null = null;

    // Check if source operation is a JOIN with a result shape
    const sourceJoin = source.operationType === "join" ? (source as JoinOperation) : null;
    const previousResultShape = sourceJoin?.resultShape;

    // Process outer key selector
    if (outerKeySelectorAst && outerKeySelectorAst.type === "ArrowFunctionExpression") {
      const outerArrow = outerKeySelectorAst as ArrowFunctionExpression;
      const paramName = getParameterName(outerArrow);

      // Create a context with the result shape if we're chaining JOINs
      const outerContext = { ...context };
      if (paramName && previousResultShape) {
        outerContext.currentResultShape = previousResultShape;
        outerContext.joinResultParam = paramName;
      } else if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (outerArrow.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(outerArrow.body.body);
      } else {
        bodyExpr = outerArrow.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, outerContext);
        if (expr && expr.type === "column") {
          const colExpr = expr as ColumnExpression;
          // For nested paths like orderItem.product_id, we get the final column name
          outerKey = colExpr.name;

          // Track which source table this key comes from
          if (colExpr.table && colExpr.table.startsWith("$joinSource")) {
            outerKeySource = parseInt(colExpr.table.substring(11), 10);
          }
        }
      }
    }

    if (innerKeySelectorAst && innerKeySelectorAst.type === "ArrowFunctionExpression") {
      const innerArrow = innerKeySelectorAst as ArrowFunctionExpression;
      const paramName = getParameterName(innerArrow);
      if (paramName) {
        context.tableParams.add(paramName);
      }

      // Handle both Expression body and BlockStatement body
      let bodyExpr: ASTExpression | null = null;
      if (innerArrow.body.type === "BlockStatement") {
        // For block statements, look for a return statement
        bodyExpr = getReturnExpression(innerArrow.body.body);
      } else {
        bodyExpr = innerArrow.body;
      }

      if (bodyExpr) {
        const expr = convertAstToExpression(bodyExpr, context);
        if (expr && expr.type === "column") {
          innerKey = (expr as ColumnExpression).name;
        }
      }
    }

    // Process the result selector
    let resultSelector: Expression | undefined = undefined;
    if (resultSelectorAst && resultSelectorAst.type === "ArrowFunctionExpression") {
      const resultArrow = resultSelectorAst as ArrowFunctionExpression;

      // Store the parameter names for the result selector
      // These will be needed to map properties back to their source tables
      const params = resultArrow.params;
      outerParam =
        params && params[0]
          ? getParameterName({
              params: [params[0]],
              body: resultArrow.body,
            } as ArrowFunctionExpression)
          : null;
      innerParam =
        params && params[1]
          ? getParameterName({
              params: [params[1]],
              body: resultArrow.body,
            } as ArrowFunctionExpression)
          : null;

      // Create a special context that tracks which parameter maps to which table
      const resultContext = {
        ...context,
        joinParams: new Map<string, number>(), // parameter name -> table index (0 for outer, 1 for inner)
      };

      if (outerParam) {
        resultContext.joinParams?.set(outerParam, 0);
      }
      if (innerParam) {
        resultContext.joinParams?.set(innerParam, 1);
      }

      // Convert the result selector body to an expression
      let bodyExpr: ASTExpression | null = null;
      if (resultArrow.body.type === "BlockStatement") {
        bodyExpr = getReturnExpression(resultArrow.body.body);
      } else {
        bodyExpr = resultArrow.body;
      }

      if (bodyExpr) {
        resultSelector = convertAstToExpression(bodyExpr, resultContext) || undefined;
      }
    }

    if (innerSource && outerKey && innerKey) {
      // Build the result shape from the result selector
      const resultShape = buildResultShape(resultSelector, outerParam, innerParam);

      return {
        type: "queryOperation",
        operationType: "join",
        source,
        inner: innerSource,
        outerKey,
        innerKey,
        outerKeySource, // Track which source table the key comes from
        resultSelector, // Include the result selector
        resultShape, // Include the result shape
      };
    }
  }
  return null;
}
