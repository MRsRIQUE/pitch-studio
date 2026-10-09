/**
 * O envelope de valores da REST do Firestore, nos dois sentidos.
 *
 * Inteiro vira `integerValue` (string no JSON — o Firestore guarda 64 bits),
 * número com fração vira `doubleValue`. `undefined` some do documento, como
 * no SDK; `null` é gravado como `nullValue`.
 */

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export type FirestoreFields = Record<string, FirestoreValue>;

export function encodeValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { nullValue: null };
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.filter((v) => v !== undefined).map(encodeValue) } };
  }
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  return { nullValue: null };
}

export function encodeFields(data: Record<string, unknown>): FirestoreFields {
  const out: FirestoreFields = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) out[key] = encodeValue(value);
  }
  return out;
}

export function decodeValue(value: unknown): unknown {
  const v = (value ?? {}) as Record<string, unknown>;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return Boolean(v.booleanValue);
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) {
    const values = (v.arrayValue as { values?: unknown[] } | undefined)?.values ?? [];
    return values.map(decodeValue);
  }
  if ("mapValue" in v) {
    return decodeFields((v.mapValue as { fields?: Record<string, unknown> } | undefined)?.fields ?? {});
  }
  return null;
}

export function decodeFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}
