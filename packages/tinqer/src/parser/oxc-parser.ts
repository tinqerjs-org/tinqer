/**
 * OXC Parser wrapper
 * Wraps the OXC WASM parser for JavaScript/TypeScript parsing
 */

import { parseSync } from "oxc-parser";

/**
 * Parses JavaScript/TypeScript code using OXC parser
 * @param code The JavaScript/TypeScript code to parse
 * @returns The parsed AST or null if parsing fails
 */
export function parseJavaScript(code: string): any {
  try {
    const result = parseSync(code, {
      sourceType: "module",
      sourceFilename: "query.ts",
    });

    if (result.errors.length > 0) {
      console.error("Parse errors:", result.errors);
      return null;
    }

    return result.program;
  } catch (error) {
    console.error("Failed to parse JavaScript:", error);
    return null;
  }
}