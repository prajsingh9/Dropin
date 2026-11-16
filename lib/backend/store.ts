import type { Mutation, TableName, TableRows } from "@/lib/domain/mutations";
import type { DeviceCommand, Device } from "@/types/dropin";

export type Filter<T> = { [K in keyof T]?: T[K] | T[K][] };

export interface ListOptions<T> {
  orderBy?: keyof T & string;
  ascending?: boolean;
  limit?: number;
}

/**
 * Persistence port used by the domain service. Implemented by
 * `LocalStore` (browser demo) and `SupabaseAdminStore` (server).
 */
export interface Store {
  get<T extends TableName>(table: T, id: string): Promise<TableRows[T] | null>;
  list<T extends TableName>(table: T, filter: Filter<TableRows[T]>, options?: ListOptions<TableRows[T]>): Promise<TableRows[T][]>;
  apply(mutations: Mutation[]): Promise<void>;
}

export type DispatchOutcome =
  /** Device confirmed. */
  | { status: "completed" }
  /** Handed to the transport; confirmation will arrive later via the ack endpoint. */
  | { status: "sent" }
  /** Stored for the device to pull. */
  | { status: "pending" }
  | { status: "failed"; error: string };

/**
 * Transport port for talking to hardware. See `lib/hardware/` for the
 * simulated gateway and the real firmware gateway contract.
 */
export interface DeviceGateway {
  dispatch(command: DeviceCommand, device: Device): Promise<DispatchOutcome>;
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/** Apply mutations to in-memory table arrays. Shared by the demo store and tests. */
export function applyToTables(tables: { [T in TableName]: TableRows[T][] }, mutations: Mutation[]) {
  for (const m of mutations) {
    const rows = tables[m.table] as unknown as Array<Record<string, unknown>>;
    const pk = m.table === "device_events" ? "event_id" : "id";
    if (m.kind === "insert") {
      rows.unshift({ ...(m.row as unknown as Record<string, unknown>) });
    } else if (m.kind === "update") {
      const idx = rows.findIndex((r) => r[pk] === m.id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...(m.values as Record<string, unknown>) };
    } else {
      const idx = rows.findIndex((r) => r[pk] === m.id);
      if (idx >= 0) rows.splice(idx, 1);
    }
  }
}

export function matchesFilter<T>(row: T, filter: Filter<T>): boolean {
  for (const [k, v] of Object.entries(filter) as [keyof T, unknown][]) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      if (!v.includes(row[k])) return false;
    } else if (row[k] !== v) return false;
  }
  return true;
}
