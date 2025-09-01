/** A row is just a bag of values keyed by column key. */
export type GridRow = Record<string, unknown>;

/** Column metadata is display-only; no runtime typing enforced. */
export interface GridColumn {
  /** Unique key used to read from each row, e.g., "email" or "orderId". */
  key: string;
  /** Human-friendly header text. */
  label: string;

  // Optional, purely presentational knobs — safe to ignore.
  widthPx?: number;
  align?: 'start' | 'center' | 'end';
  sortable?: boolean;
}

/** One dataset you can load via /data/:id (e.g., /data/users). */
export interface GridDataset {
  id: string;              // "users", "orders", ...
  name: string;            // Display name
  columns: GridColumn[];   // Column metadata
  rows: GridRow[];         // Actual data
}
