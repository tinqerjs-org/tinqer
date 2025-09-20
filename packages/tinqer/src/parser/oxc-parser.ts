/**
 * OXC Parser Wrapper
 * Simple wrapper around oxc-parser that returns the raw AST
 */

import { parseSync } from "oxc-parser";
import type { Program } from "@oxc-project/types";

interface ParseResult {
  program: Program | null;
  errors: Array<{ message: string }>;
}

export class OxcParser {
  /**
   * Parse a lambda function string into an AST
   */
  parse(lambdaString: string): Program {
    const result = parseSync("query.ts", lambdaString, {}) as ParseResult;

    if (!result || !result.program) {
      throw new Error("Failed to parse lambda function");
    }

    if (result.errors && result.errors.length > 0) {
      throw new Error(`Parse error: ${result.errors[0]?.message || "Unknown error"}`);
    }

    // Return the raw OXC AST - no conversion needed
    return result.program;
  }
}
