/**
 * TerminalQuery represents a terminated query that returns a specific type.
 * This is a marker class - no actual implementation needed.
 */
export class TerminalQuery<T> {
  private _phantom?: T;

  constructor() {
    // Marker class - never actually instantiated
  }
}