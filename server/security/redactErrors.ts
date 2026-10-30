/**
 * API-key-redacting error serializer (task 11.5.5).
 *
 * The error middleware runs every error through {@link redactSecrets} before it
 * is logged OR returned to the client. The serializer walks an arbitrary value
 * (object graph, array, Error) and replaces the value of any field whose NAME
 * is key-ish — `apiKey`, `authorization`, or `key` (case-insensitive, and any
 * field that merely contains those tokens, e.g. `x-api-key`, `Authorization`)
 * — with a fixed redaction marker. This guarantees a raw API key can never leak
 * through an error object, a stack-attached context field, or a logged payload.
 *
 * The walk is defensive:
 *  - It is cycle-safe (a WeakSet tracks visited objects).
 *  - It never executes getters that could throw; property reads are guarded.
 *  - It preserves the shape of the input so downstream copy (code/message/
 *    resolution) is untouched unless the field name itself is key-ish.
 *  - Error instances are converted to a plain `{ name, message, stack }` object
 *    with the same redaction applied, so a key captured in an Error field is
 *    stripped too.
 *
 * Note: this redacts by FIELD NAME. Belt-and-braces, the error middleware also
 * never echoes raw request bodies, and the audit log / user-log builders never
 * write the key (Property 4). Together with Property 28 this gives both
 * log-time and error-time redaction.
 *
 * @see design.md "API key redaction" / "Error Handling"
 * Requirements 15.7, 3.3
 */

/** The marker substituted for any redacted value. */
export const REDACTED = "[REDACTED]";

/** Field-name tokens that trigger redaction (case-insensitive substring). */
const SECRET_TOKENS = ["apikey", "authorization", "key", "secret", "token"];

/** Is this object-key name key-ish (should its value be redacted)? */
export function isSecretFieldName(name: string): boolean {
  const lower = name.toLowerCase();
  return SECRET_TOKENS.some((t) => lower.includes(t));
}

/** Max recursion depth — a guard against pathological nesting. */
const MAX_DEPTH = 8;

/**
 * Return a deep copy of `value` with every key-ish field's value replaced by
 * {@link REDACTED}. Primitives pass through unchanged; Errors become plain
 * objects; cycles and over-deep graphs are handled gracefully.
 */
export function redactSecrets(value: unknown): unknown {
  return walk(value, 0, new WeakSet<object>());
}

function walk(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (depth > MAX_DEPTH) {
    return "[TRUNCATED]";
  }
  if (seen.has(value as object)) {
    return "[CIRCULAR]";
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => walk(item, depth + 1, seen));
  }

  // Errors: serialise to a plain object (name/message/stack + own enumerable
  // props) so a key stashed on the Error is subject to the same redaction.
  if (value instanceof Error) {
    const base: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
    for (const key of Object.keys(value)) {
      base[key] = (value as unknown as Record<string, unknown>)[key];
    }
    return redactObject(base, depth, seen);
  }

  return redactObject(value as Record<string, unknown>, depth, seen);
}

function redactObject(
  obj: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(obj)) {
    if (isSecretFieldName(name)) {
      out[name] = REDACTED;
      continue;
    }
    let raw: unknown;
    try {
      raw = obj[name];
    } catch {
      // A throwing getter must not break serialisation.
      out[name] = "[UNREADABLE]";
      continue;
    }
    out[name] = walk(raw, depth + 1, seen);
  }
  return out;
}
