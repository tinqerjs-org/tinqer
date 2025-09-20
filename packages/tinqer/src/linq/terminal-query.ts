/**
 * TerminalQuery represents a terminated query that returns a specific type.
 * This is a marker class - no actual implementation needed.
 */
export class TerminalQuery<T> {
  // @ts-expect-error - T is used for type checking only
  private readonly _type?: T;

  constructor() {
    // Marker class - never actually instantiated
  }
}
