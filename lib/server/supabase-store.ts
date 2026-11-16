import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Filter, ListOptions, Store } from "@/lib/backend/store";
import type { Mutation, TableName, TableRows } from "@/lib/domain/mutations";

/** Columns that exist only in the client model and must not be written. */
const VIRTUAL_COLUMNS: Partial<Record<TableName, string[]>> = {
  household_members: ["profile"],
};

function clean(table: TableName, row: Record<string, unknown>) {
  const drop = VIRTUAL_COLUMNS[table];
  if (!drop) return row;
  const copy = { ...row };
  for (const k of drop) delete copy[k];
  return copy;
}

/**
 * `Store` backed by Supabase with the service-role client. Only constructed
 * inside API routes after authorization checks.
 */
export class SupabaseAdminStore implements Store {
  constructor(private db: SupabaseClient) {}

  private pk(table: TableName) {
    return table === "device_events" ? "event_id" : "id";
  }

  async get<T extends TableName>(table: T, id: string) {
    const { data, error } = await this.db.from(table).select("*").eq(this.pk(table), id).maybeSingle();
    if (error) throw new Error(`${table}.get: ${error.message}`);
    return (data as TableRows[T] | null) ?? null;
  }

  async list<T extends TableName>(table: T, filter: Filter<TableRows[T]>, options: ListOptions<TableRows[T]> = {}) {
    const select = table === "household_members" ? "*, profile:profiles(full_name, email, avatar_url)" : "*";
    let q = this.db.from(table).select(select);
    for (const [k, v] of Object.entries(filter)) {
      if (v === undefined) continue;
      q = Array.isArray(v) ? q.in(k, v) : v === null ? q.is(k, null) : q.eq(k, v as string);
    }
    if (options.orderBy) q = q.order(options.orderBy, { ascending: options.ascending ?? true });
    if (options.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) throw new Error(`${table}.list: ${error.message}`);
    return (data ?? []) as unknown as TableRows[T][];
  }

  async apply(mutations: Mutation[]) {
    // PostgREST has no multi-statement transactions; mutations are ordered so
    // parents are written before children. Idempotency is provided by
    // `device_events.event_id`.
    for (const m of mutations) {
      if (m.kind === "insert") {
        const { error } = await this.db.from(m.table).insert(clean(m.table, m.row as unknown as Record<string, unknown>));
        if (error) throw new Error(`${m.table}.insert: ${error.message}`);
      } else if (m.kind === "update") {
        if (!Object.keys(m.values).length) continue;
        const { error } = await this.db.from(m.table).update(clean(m.table, m.values as Record<string, unknown>)).eq(this.pk(m.table), m.id);
        if (error) throw new Error(`${m.table}.update: ${error.message}`);
      } else {
        const { error } = await this.db.from(m.table).delete().eq(this.pk(m.table), m.id);
        if (error) throw new Error(`${m.table}.delete: ${error.message}`);
      }
    }
  }
}
