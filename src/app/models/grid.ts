/** A generic row from the server. */
export type GridRow = Record<string, unknown>;

/** Generic paged result returned by the API service. */
export interface PagedResult<T> {
  items: T[];
  total: number;
}
