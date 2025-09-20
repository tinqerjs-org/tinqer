/**
 * TerminalQuery represents a terminated query that returns a specific type.
 * This is a marker class - no actual implementation needed.
 * The generic T is used solely for compile-time type safety.
 */
export class TerminalQuery<T = unknown> {
  // Make T usage explicit for TypeScript
  readonly __phantom!: T;

  constructor() {
    // Marker class - never actually instantiated
    // T parameter used for compile-time type checking only
  }
}
