// Test what OXC parser returns
import { OxcParser } from "./packages/tinqer/dist/parsers/oxc-parser.js";

const parser = new OxcParser();

const fn = (u) => u.id === 10;
const fnString = fn.toString();

console.log("Function string:", fnString);

const ast = parser.parse(fnString);
console.log("AST:", JSON.stringify(ast, null, 2));
