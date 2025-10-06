/**
 * Tests for type inference in execute function
 */

import { executeSelect } from "../dist/index.js";
import { db } from "./test-schema.js";

// Mock database for type testing
const mockDb = {
  async any(_sql: string, _params: unknown): Promise<unknown[]> {
    return [];
  },
  async one(_sql: string, _params: unknown): Promise<unknown> {
    return {};
  },
  async result(_sql: string, _params: unknown): Promise<{ rowCount: number }> {
    return { rowCount: 0 };
  },
};

// Type tests - these should compile without errors
async function typeTests() {
  // Queryable returns array
  const users: {
    id: number;
    name: string;
    age: number;
    email: string | null;
    isActive: boolean;
    role: string;
    department: string;
    salary: number;
    city: string;
    country: string;
    phone: string;
    isDeleted: boolean;
    createdAt: Date;
    username: string;
    active: boolean;
    deptId: number;
  }[] = await executeSelect(mockDb, db, (ctx) => ctx.from("users"), {});

  // With select, returns projected array
  const userNames: { id: number; name: string }[] = await executeSelect(
    mockDb,
    db,
    (ctx) => ctx.from("users").select((u) => ({ id: u.id, name: u.name })),
    {},
  );

  // first() returns single item
  const firstUser: {
    id: number;
    name: string;
    age: number;
    email: string | null;
    isActive: boolean;
    role: string;
    department: string;
    salary: number;
    city: string;
    country: string;
    phone: string;
    isDeleted: boolean;
    createdAt: Date;
    username: string;
    active: boolean;
    deptId: number;
  } = await executeSelect(mockDb, db, (ctx) => ctx.from("users").first(), {});

  // firstOrDefault() returns item or undefined
  const maybeUser:
    | {
        id: number;
        name: string;
        age: number;
        email: string | null;
        isActive: boolean;
        role: string;
        department: string;
        salary: number;
        city: string;
        country: string;
        phone: string;
        isDeleted: boolean;
        createdAt: Date;
        username: string;
        active: boolean;
        deptId: number;
      }
    | undefined = await executeSelect(mockDb, db, (ctx) => ctx.from("users").firstOrDefault(), {});

  // count() returns number
  const count: number = await executeSelect(mockDb, db, (ctx) => ctx.from("users").count(), {});

  // any() returns boolean
  const hasUsers: boolean = await executeSelect(mockDb, db, (ctx) => ctx.from("users").any(), {});

  // sum() returns number
  const totalAge: number = await executeSelect(
    mockDb,
    db,
    (ctx) => ctx.from("users").sum((u) => u.age),
    {},
  );

  // Use the variables to avoid unused variable warnings
  console.log(users, userNames, firstUser, maybeUser, count, hasUsers, totalAge);
}

// Export to ensure module is valid
export { typeTests };
