/**
 * Tests for type inference in execute function
 */

import { executeSelect } from "../dist/index.js";
import { db, from } from "./test-schema.js";

// Mock database for type testing
const mockDb = {
  prepare(_sql: string) {
    return {
      all(_params?: Record<string, unknown>): unknown[] {
        return [];
      },
      get(_params?: Record<string, unknown>): unknown {
        return {};
      },
    };
  },
};

// Type tests - these should compile without errors
function typeTests() {
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
  }[] = executeSelect(mockDb, () => from(db, "users"), {});

  // With select, returns projected array
  const userNames: { id: number; name: string }[] = executeSelect(
    mockDb,
    () => from(db, "users").select((u) => ({ id: u.id, name: u.name })),
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
  } = executeSelect(mockDb, () => from(db, "users").first(), {});

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
    | undefined = executeSelect(mockDb, () => from(db, "users").firstOrDefault(), {});

  // count() returns number
  const count: number = executeSelect(mockDb, () => from(db, "users").count(), {});

  // any() returns boolean
  const hasUsers: boolean = executeSelect(mockDb, () => from(db, "users").any(), {});

  // sum() returns number
  const totalAge: number = executeSelect(mockDb, () => from(db, "users").sum((u) => u.age), {});

  // Use the variables to avoid unused variable warnings
  console.log(users, userNames, firstUser, maybeUser, count, hasUsers, totalAge);
}

// Export to ensure module is valid
export { typeTests };
