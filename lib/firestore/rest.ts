/**
 * Firestore do SaySell pela REST, sem SDK. O suficiente para a camada de
 * dados do Studio: ler um documento, consultar uma coleção e gravar em lote
 * com precondição (`commit`), que é o que dá atomicidade sem transação.
 */
import { databaseRoot, firestoreToken } from "./credential";
import { decodeFields, encodeFields, type FirestoreFields } from "./values";

const API = "https://firestore.googleapis.com/v1";

export type FirestoreDoc = { id: string; path: string; data: Record<string, unknown>; updateTime: string };

export class FirestorePreconditionFailed extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "FirestorePreconditionFailed";
  }
}

function documentName(path: string): string {
  return `${databaseRoot()}/documents/${path}`;
}

async function request(url: string, init: RequestInit = {}): Promise<unknown> {
  const token = await firestoreToken();
  const res = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 404 && (init.method ?? "GET") === "GET") return null;
  const body = (await res.json().catch(() => ({}))) as { error?: { status?: string; message?: string } };
  if (!res.ok) {
    const status = body.error?.status ?? "";
    if (status === "FAILED_PRECONDITION" || status === "ALREADY_EXISTS" || res.status === 409) {
      throw new FirestorePreconditionFailed(body.error?.message ?? status);
    }
    throw new Error(`Firestore ${res.status} ${status}: ${body.error?.message ?? "erro"}`);
  }
  return body;
}

function parseDoc(raw: { name: string; fields?: FirestoreFields; updateTime?: string }): FirestoreDoc {
  const path = raw.name.split("/documents/")[1] ?? raw.name;
  return {
    id: path.split("/").pop() ?? "",
    path,
    data: decodeFields(raw.fields ?? {}),
    updateTime: raw.updateTime ?? "",
  };
}

export async function fsGet(path: string): Promise<FirestoreDoc | null> {
  const body = (await request(`${API}/${documentName(path)}`)) as
    | { name: string; fields?: FirestoreFields; updateTime?: string }
    | null;
  return body ? parseDoc(body) : null;
}

export type Where = { field: string; op: "EQUAL" | "LESS_THAN" | "GREATER_THAN"; value: unknown };

/**
 * Consulta uma coleção (`parent` vazio = raiz; senão o caminho do documento
 * dono da subcoleção). Filtro de igualdade + ordenação por um campo pede índice
 * composto no Firestore; por isso as consultas daqui usam um filtro **ou** uma
 * ordenação, e o resto é filtrado em memória.
 */
export async function fsQuery(
  parent: string,
  collectionId: string,
  options: {
    where?: Where;
    orderBy?: { field: string; direction: "ASCENDING" | "DESCENDING" };
    limit?: number;
    /** Só estes campos voltam (o resto do documento não atravessa a rede). */
    select?: string[];
  } = {},
): Promise<FirestoreDoc[]> {
  const parentName = parent ? documentName(parent) : `${databaseRoot()}/documents`;
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId }] };
  if (options.where) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: options.where.field },
        op: options.where.op,
        value: encodeFields({ v: options.where.value }).v,
      },
    };
  }
  if (options.orderBy) {
    structuredQuery.orderBy = [{ field: { fieldPath: options.orderBy.field }, direction: options.orderBy.direction }];
  }
  if (options.limit) structuredQuery.limit = options.limit;
  if (options.select) structuredQuery.select = { fields: options.select.map((fieldPath) => ({ fieldPath })) };
  const rows = (await request(`${API}/${parentName}:runQuery`, {
    method: "POST",
    body: JSON.stringify({ structuredQuery }),
  })) as Array<{ document?: { name: string; fields?: FirestoreFields; updateTime?: string } }>;
  return (Array.isArray(rows) ? rows : []).flatMap((row) => (row.document ? [parseDoc(row.document)] : []));
}

export type Write =
  | {
      kind: "set";
      path: string;
      data: Record<string, unknown>;
      /** Só os campos de `data` mudam; o resto do documento fica. */
      merge?: boolean;
      precondition?: { exists: boolean } | { updateTime: string };
    }
  | { kind: "delete"; path: string };

/** Grava tudo ou nada. Precondição falhando → `FirestorePreconditionFailed`. */
export async function fsCommit(writes: Write[]): Promise<void> {
  if (writes.length === 0) return;
  for (let i = 0; i < writes.length; i += 450) {
    const chunk = writes.slice(i, i + 450).map((w) => {
      if (w.kind === "delete") return { delete: documentName(w.path) };
      const fields = encodeFields(w.data);
      return {
        update: { name: documentName(w.path), fields },
        ...(w.merge ? { updateMask: { fieldPaths: Object.keys(fields).map((k) => `\`${k}\``) } } : {}),
        ...(w.precondition ? { currentDocument: w.precondition } : {}),
      };
    });
    await request(`${API}/${databaseRoot()}/documents:commit`, {
      method: "POST",
      body: JSON.stringify({ writes: chunk }),
    });
  }
}

export const fsSet = (path: string, data: Record<string, unknown>, merge = false) =>
  fsCommit([{ kind: "set", path, data, merge }]);

export const fsDelete = (path: string) => fsCommit([{ kind: "delete", path }]);

/** Cria só se não existir. `false` quando já existia. */
export async function fsCreate(path: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    await fsCommit([{ kind: "set", path, data, precondition: { exists: false } }]);
    return true;
  } catch (error) {
    if (error instanceof FirestorePreconditionFailed) return false;
    throw error;
  }
}
