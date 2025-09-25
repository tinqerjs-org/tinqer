/**
 * JOIN operation visitor
 */

import type {
  JoinOperation,
  QueryOperation,
  ResultShape,
  ShapeNode,
  ColumnShapeNode,
  ObjectShapeNode,
  ReferenceShapeNode,
} from "../../query-tree/operations.js";
import type {
  ColumnExpression,
  Expression,
  ObjectExpression,
} from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  Expression as ASTExpression,
  Identifier,
} from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { getParameterName, getReturnExpression } from "../visitor-utils.js";
import { visitExpression } from "../expression-visitor.js";
import { visitAstToQueryOperation } from "../ast-visitor.js";

/**
 * Join visitor context
 */
interface JoinContext {
  tableParams: Set<string>;
  queryParams: Set<string>;
  joinParams?: Map<string, number>;
  currentResultShape?: ResultShape;
  joinResultParam?: string;
}

/**
 * Build a ResultShape from a JOIN result selector expression
 * Preserves full nested structure for complete fidelity
 */
function buildResultShape(
  expr: Expression | undefined,
  outerParam: string | null,
  innerParam: string | null,
): ResultShape | undefined {
  if (!expr || expr.type !== "object") {
    return undefined;
  }

  const rootNode = buildShapeNode(expr, outerParam, innerParam);
  if (rootNode && rootNode.type === "object") {
    return rootNode as ResultShape;
  }

  return undefined;
}

/**
 * Recursively build a ShapeNode from an expression
 */
function buildShapeNode(
  expr: Expression,
  outerParam: string | null,
  innerParam: string | null,
): ShapeNode | undefined {
  switch (expr.type) {
    case "object": {
      const objExpr = expr as ObjectExpression;
      const properties = new Map<string, ShapeNode>();

      for (const [propName, propExpr] of Object.entries(objExpr.properties)) {
        const node = buildShapeNode(propExpr, outerParam, innerParam);
        if (node) {
          properties.set(propName, node);
        }
      }

      return {
        type: "object",
        properties,
      } as ObjectShapeNode;
    }

    case "column": {
      const colExpr = expr as ColumnExpression;

      // Check if this is a $param marker from JOIN context
      if (colExpr.table && colExpr.table.startsWith("$param")) {
        const paramIndex = parseInt(colExpr.table.substring(6), 10);

        // Otherwise it's a column from that table
        return {
          type: "column",
          sourceTable: paramIndex,
          columnName: colExpr.name,
        } as ColumnShapeNode;
      }
      // Check if this is a property access (e.g., u.name)
      else if (colExpr.table === outerParam && outerParam) {
        return {
          type: "column",
          sourceTable: 0,
          columnName: colExpr.name,
        } as ColumnShapeNode;
      } else if (colExpr.table === innerParam && innerParam) {
        return {
          type: "column",
          sourceTable: 1,
          columnName: colExpr.name,
        } as ColumnShapeNode;
      } else if (!colExpr.table) {
        // Direct parameter reference (e.g., { orderItem: oi })
        // Check both table and column name cases
        if (
          (colExpr.name === outerParam && outerParam) ||
          (colExpr.table === outerParam && outerParam)
        ) {
          return {
            type: "reference",
            sourceTable: 0,
          } as ReferenceShapeNode;
        } else if (
          (colExpr.name === innerParam && innerParam) ||
          (colExpr.table === innerParam && innerParam)
        ) {
          return {
            type: "reference",
            sourceTable: 1,
          } as ReferenceShapeNode;
        }
      }
      break;
    }

    // Add more cases as needed (arithmetic, concat, etc.)
  }

  return undefined;
}

export function visitJoinOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _methodName: string,
  visitorContext: VisitorContext,
): { operation: JoinOperation; autoParams: Record<string, unknown> } | null {
  // Handle 2-argument form: join(inner, predicate)
  if (ast.arguments && ast.arguments.length === 2) {
    const firstArg = ast.arguments[0];
    const predicateArg = ast.arguments[1];

    // Parse inner source
    const innerSourceResult = firstArg
      ? visitAstToQueryOperation(
          firstArg as ASTExpression,
          visitorContext.tableParams,
          visitorContext.queryParams,
        )
      : null;
    const innerSource = innerSourceResult?.operation || null;

    if (innerSource && predicateArg && predicateArg.type === "ArrowFunctionExpression") {
      const predicateArrow = predicateArg as ArrowFunctionExpression;
      const params = predicateArrow.params;

      // Get the two parameters (outer, inner)
      const outerParam =
        params && params[0]
          ? getParameterName({
              params: [params[0]],
              body: predicateArrow.body,
            } as ArrowFunctionExpression)
          : null;
      const innerParam =
        params && params[1]
          ? getParameterName({
              params: [params[1]],
              body: predicateArrow.body,
            } as ArrowFunctionExpression)
          : null;

      if (outerParam && innerParam) {
        // Create context for predicate evaluation
        const predicateContext = new Set(visitorContext.tableParams);
        predicateContext.add(outerParam);
        predicateContext.add(innerParam);

        // Get predicate body
        let bodyExpr: ASTExpression | null = null;
        if (predicateArrow.body.type === "BlockStatement") {
          bodyExpr = getReturnExpression(predicateArrow.body.body);
        } else {
          bodyExpr = predicateArrow.body;
        }

        if (bodyExpr) {
          const result = visitExpression(bodyExpr, predicateContext, visitorContext.queryParams);

          if (result && result.expression) {
            const expr = result.expression;

            // Extract join keys from equality comparison (u.id === ud.userId)
            if (expr.type === "comparison" && (expr as any).operator === "==") {
              const comparisonExpr = expr as any;
              const leftCol = comparisonExpr.left;
              const rightCol = comparisonExpr.right;

              let outerKey: string | null = null;
              let innerKey: string | null = null;

              // Determine which side is outer and which is inner based on table reference
              if (leftCol?.type === "column" && rightCol?.type === "column") {
                // Check if left column references outer param
                if (leftCol.table === outerParam || !leftCol.table) {
                  outerKey = leftCol.name;
                  innerKey = rightCol.name;
                } else if (leftCol.table === innerParam) {
                  innerKey = leftCol.name;
                  outerKey = rightCol.name;
                }
              }

              if (outerKey && innerKey) {
                const autoParams: Record<string, unknown> = {};

                // Merge auto params from inner source
                if (innerSourceResult?.autoParams) {
                  Object.assign(autoParams, innerSourceResult.autoParams);
                }

                // Merge auto params from predicate
                if (result.autoParams) {
                  Object.assign(autoParams, result.autoParams);
                }

                return {
                  operation: {
                    type: "queryOperation",
                    operationType: "join",
                    source,
                    inner: innerSource,
                    outerKey,
                    innerKey,
                  },
                  autoParams,
                };
              }
            }
          }
        }
      }
    }
  }

  // Handle 4-argument form: join(inner, outerKeySelector, innerKeySelector, resultSelector)
  if (ast.arguments && ast.arguments.length >= 4) {
    // join(inner, outerKeySelector, innerKeySelector, resultSelector)
    const firstArg = ast.arguments[0];
    const innerSourceResult = firstArg
      ? visitAstToQueryOperation(
          firstArg as ASTExpression,
          visitorContext.tableParams,
          visitorContext.queryParams,
        )
      : null;
    const innerSource = innerSourceResult?.operation || null;
    const outerKeySelectorAst = ast.arguments[1];
    const innerKeySelectorAst = ast.arguments[2];
    const resultSelectorAst = ast.arguments[3]; // Capture the result selector

    let outerKey: string | null = null;
    let innerKey: string | null = null;
    let outerKeySource: number | undefined = undefined;
    let outerParam: string | null = null;
    let innerParam: string | null = null;
    const autoParams: Record<string, unknown> = {};

    // Check if source operation is a JOIN with a result shape
    const sourceJoin = source.operationType === "join" ? (source as JoinOperation) : null;
    const previousResultShape = sourceJoin?.resultShape;

    // Process outer key selector
    if (outerKeySelectorAst && outerKeySelectorAst.type === "ArrowFunctionExpression") {
      const outerArrow = outerKeySelectorAst as ArrowFunctionExpression;
      const paramName = getParameterName(outerArrow);

      // Create a context with the result shape if we're chaining JOINs
      const outerContext: JoinContext = {
        tableParams: new Set(visitorContext.tableParams),
        queryParams: new Set(visitorContext.queryParams),
      };
      if (paramName && previousResultShape) {
        outerContext.currentResultShape = previousResultShape;
        outerContext.joinResultParam = paramName;
      } else if (paramName) {
        outerContext.tableParams.add(paramName);
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
        const result = visitExpression(
          bodyExpr,
          outerContext.tableParams,
          outerContext.queryParams,
        );
        if (result) {
          const expr = result.expression;
          Object.assign(autoParams, result.autoParams);
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
    }

    if (innerKeySelectorAst && innerKeySelectorAst.type === "ArrowFunctionExpression") {
      const innerArrow = innerKeySelectorAst as ArrowFunctionExpression;
      const paramName = getParameterName(innerArrow);
      const innerContext: JoinContext = {
        tableParams: new Set(visitorContext.tableParams),
        queryParams: new Set(visitorContext.queryParams),
      };
      if (paramName) {
        innerContext.tableParams.add(paramName);
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
        const result = visitExpression(
          bodyExpr,
          innerContext.tableParams,
          innerContext.queryParams,
        );
        if (result) {
          const expr = result.expression;
          Object.assign(autoParams, result.autoParams);
          if (expr && expr.type === "column") {
            innerKey = (expr as ColumnExpression).name;
          }
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
        params && params[0] && params[0].type === "Identifier"
          ? (params[0] as Identifier).name
          : null;
      innerParam =
        params && params[1] && params[1].type === "Identifier"
          ? (params[1] as Identifier).name
          : null;

      // Create a special context that tracks which parameter maps to which table
      const resultContext: JoinContext = {
        tableParams: new Set(visitorContext.tableParams),
        queryParams: new Set(visitorContext.queryParams),
        joinParams: new Map<string, number>(), // parameter name -> table index (0 for outer, 1 for inner)
      };

      // If we're chaining JOINs and the outer param comes from a previous JOIN result,
      // pass through its shape information
      if (outerParam && previousResultShape) {
        resultContext.currentResultShape = previousResultShape;
        resultContext.joinResultParam = outerParam;
      }

      if (outerParam) {
        resultContext.joinParams?.set(outerParam, 0);
        resultContext.tableParams.add(outerParam); // Also add to tableParams for validation
      }
      if (innerParam) {
        resultContext.joinParams?.set(innerParam, 1);
        resultContext.tableParams.add(innerParam); // Also add to tableParams for validation
      }

      // Convert the result selector body to an expression
      let bodyExpr: ASTExpression | null = null;
      if (resultArrow.body.type === "BlockStatement") {
        bodyExpr = getReturnExpression(resultArrow.body.body);
      } else {
        bodyExpr = resultArrow.body;
      }

      if (bodyExpr) {
        // Use a custom visitor that tracks JOIN parameters
        const result = visitJoinResultSelector(
          bodyExpr,
          resultContext,
          visitorContext.autoParamCounter,
        );
        if (result) {
          resultSelector = result.expression || undefined;
          Object.assign(autoParams, result.autoParams);
          visitorContext.autoParamCounter = result.counter;
        }
      }
    }

    if (innerSource && outerKey && innerKey) {
      // Build the result shape from the result selector
      const resultShape = buildResultShape(resultSelector, outerParam, innerParam);

      // Merge auto params from inner source if present
      if (innerSourceResult?.autoParams) {
        Object.assign(autoParams, innerSourceResult.autoParams);
      }

      return {
        operation: {
          type: "queryOperation",
          operationType: "join",
          source,
          inner: innerSource,
          outerKey,
          innerKey,
          outerKeySource, // Track which source table the key comes from
          resultSelector, // Include the result selector
          resultShape, // Include the result shape
        },
        autoParams,
      };
    }
  }
  return null;
}

/**
 * Visit JOIN result selector with proper parameter tracking
 */
function visitJoinResultSelector(
  node: ASTExpression,
  context: JoinContext,
  startCounter: number,
): { expression: Expression | null; autoParams: Record<string, unknown>; counter: number } | null {
  let currentCounter = startCounter;
  const autoParams: Record<string, unknown> = {};

  // Unwrap parenthesized expressions
  let expr = node;
  while (expr.type === "ParenthesizedExpression") {
    expr = (expr as any).expression;
  }

  // Handle object expressions
  if (expr.type === "ObjectExpression") {
    const properties: Record<string, Expression> = {};

    for (const prop of (expr as any).properties) {
      if (prop.type === "Property" && prop.key.type === "Identifier") {
        const key = prop.key.name;
        const valueExpr = visitJoinExpression(prop.value, context, currentCounter);

        if (valueExpr && valueExpr.value) {
          properties[key] = valueExpr.value;
          currentCounter = valueExpr.counter;
          Object.assign(autoParams, valueExpr.autoParams);
        }
      }
    }

    return {
      expression: {
        type: "object",
        properties,
      },
      autoParams,
      counter: currentCounter,
    };
  }

  // For non-object expressions, use the regular visitor
  const result = visitJoinExpression(expr, context, currentCounter);
  if (result) {
    return {
      expression: result.value,
      autoParams: result.autoParams,
      counter: result.counter,
    };
  }

  return null;
}

/**
 * Visit expressions in JOIN context with parameter tracking
 */
function visitJoinExpression(
  node: ASTExpression,
  context: JoinContext,
  startCounter: number,
): { value: Expression | null; autoParams: Record<string, unknown>; counter: number } {
  let currentCounter = startCounter;
  const autoParams: Record<string, unknown> = {};

  switch (node.type) {
    case "MemberExpression": {
      const member = node as any;

      if (member.object.type === "Identifier" && member.property.type === "Identifier") {
        const objName = member.object.name;
        const propName = member.property.name;

        // Check if this is a JOIN parameter
        if (context.joinParams?.has(objName)) {
          const tableIndex = context.joinParams.get(objName);
          return {
            value: {
              type: "column",
              name: propName,
              table: `$param${tableIndex}`,  // Mark with table index
            },
            autoParams,
            counter: currentCounter,
          };
        }

        // Regular table parameter
        if (context.tableParams.has(objName)) {
          return {
            value: {
              type: "column",
              name: propName,
              table: objName,
            },
            autoParams,
            counter: currentCounter,
          };
        }
      }
      break;
    }

    case "Literal": {
      const lit = node as any;
      currentCounter++;
      const paramName = `__p${currentCounter}`;
      autoParams[paramName] = lit.value;

      return {
        value: {
          type: "param",
          param: paramName,
        },
        autoParams,
        counter: currentCounter,
      };
    }

    // Add more cases as needed
  }

  return { value: null, autoParams, counter: currentCounter };
}
