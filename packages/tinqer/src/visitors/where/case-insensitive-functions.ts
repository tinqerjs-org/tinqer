/**
 * Case-insensitive function visitor for WHERE clauses
 * Handles helpers.functions.* calls like _.functions.iequals(a, b)
 */

import type {
  CaseInsensitiveFunctionExpression,
  ValueExpression,
} from "../../expressions/expression.js";
import type {
  CallExpression,
  MemberExpression,
  Identifier,
  Expression as ASTExpression,
} from "../../parser/ast-types.js";
import type { WhereContext, VisitorResult } from "./context.js";
import { visitValue } from "./value.js";

/**
 * Visit case-insensitive function calls
 * Expects pattern: helpersParam.functions.methodName(arg1, arg2)
 */
export function visitCaseInsensitiveFunction(
  node: CallExpression,
  context: WhereContext,
): VisitorResult<CaseInsensitiveFunctionExpression | null> {
  let currentCounter = context.autoParamCounter;

  // Must have a helpers parameter defined
  if (!context.helpersParam) {
    return { value: null, counter: currentCounter };
  }

  // Check if this is a helpers.functions.* call
  const callee = node.callee;
  if (callee.type !== "MemberExpression") {
    return { value: null, counter: currentCounter };
  }

  const memberCallee = callee as MemberExpression;

  // Check for pattern: something.functionName
  if (memberCallee.property.type !== "Identifier") {
    return { value: null, counter: currentCounter };
  }

  const functionName = (memberCallee.property as Identifier).name;

  // Check if this is one of our case-insensitive functions
  if (!["iequals", "istartsWith", "iendsWith", "icontains"].includes(functionName)) {
    return { value: null, counter: currentCounter };
  }

  // Check if the object is helpers.functions
  const obj = memberCallee.object;
  if (obj.type !== "MemberExpression") {
    return { value: null, counter: currentCounter };
  }

  const objMember = obj as MemberExpression;

  // Check for "functions" property
  if (
    objMember.property.type !== "Identifier" ||
    (objMember.property as Identifier).name !== "functions"
  ) {
    return { value: null, counter: currentCounter };
  }

  // Check if the base object is our helpers parameter
  if (
    objMember.object.type !== "Identifier" ||
    (objMember.object as Identifier).name !== context.helpersParam
  ) {
    return { value: null, counter: currentCounter };
  }

  // Now we know this is a helpers.functions.* call
  // Parse the arguments - all case-insensitive functions take exactly 2 arguments
  if (!node.arguments || node.arguments.length !== 2) {
    return { value: null, counter: currentCounter };
  }

  const args: ValueExpression[] = [];

  for (const arg of node.arguments) {
    const argResult = visitValue(arg as ASTExpression, {
      ...context,
      autoParamCounter: currentCounter,
    });

    if (!argResult.value) {
      return { value: null, counter: currentCounter };
    }

    args.push(argResult.value);
    currentCounter = argResult.counter;
  }

  // Create the case-insensitive function expression
  const expr: CaseInsensitiveFunctionExpression = {
    type: "caseInsensitiveFunction",
    function: functionName as "iequals" | "istartsWith" | "iendsWith" | "icontains",
    arguments: [args[0]!, args[1]!],
  };

  return { value: expr, counter: currentCounter };
}
