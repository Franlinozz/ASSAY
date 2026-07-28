// The JSON value shape used by canonical serialization. No Dates, no undefined —
// canonicalize() coerces inputs through JSON first, which drops undefined and non-JSON values.
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
