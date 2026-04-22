// Transaction API + DTO mapping.
//
// The backend returns snake_case with ISO date strings; the UI uses
// camelCase with ms-epoch numbers. `toEntry` is the single boundary where
// that translation happens — every render path expects the UI shape.

import { api, unwrap } from "./api";

// Backend row → UI Entry shape (camelCase + numeric timestamp in ms).
export function toEntry(tx) {
  return {
    id: String(tx.id),
    userId: tx.user_id,
    cardNumber: tx.card_number,
    cardType: tx.card_type, // computed server-side
    amount: Number(tx.amount),
    timestamp: tx.transaction_date
      ? new Date(tx.transaction_date).getTime()
      : null,
    status: tx.status,
    source: tx.source,
    fileName: tx.file_name,
    remarks: tx.remarks,
    isDeleted: !!tx.is_deleted,
    createdAt: tx.created_at,
    updatedAt: tx.updated_at,
  };
}

// "Load everything" — used on dashboard boot to hydrate the in-memory
// entries list (powers the distribution chart + source-split). Capped at
// 10k rows by the backend; charts that need every row go through the
// /reports endpoints instead.
export const listAllTransactions = async () => {
  const data = await unwrap(
    api.get("/transactions", {
      params: {
        page: 1,
        page_size: 10000,
        sort_by: "transaction_date",
        sort_dir: "desc",
      },
    })
  );
  return { items: data.items.map(toEntry), total: data.total };
};

// Server-side paginated + filtered list. Filters are passed straight through to
// the /api/transactions endpoint — NO client-side filtering is performed.
export const listTransactions = async (params = {}) => {
  const data = await unwrap(api.get("/transactions", { params }));
  return {
    items: data.items.map(toEntry),
    total: data.total,
    page: data.page,
    page_size: data.page_size,
  };
};

export const createTransaction = (payload) =>
  unwrap(
    api.post("/transactions", {
      card_number: payload.cardNumber,
      amount: payload.amount,
      remarks: payload.remarks ?? null,
      transaction_date: payload.timestamp
        ? new Date(payload.timestamp).toISOString()
        : null,
    })
  ).then(toEntry);

export const updateTransaction = (id, patch) => {
  const body = {};
  if (patch.cardNumber !== undefined) body.card_number = patch.cardNumber;
  if (patch.amount !== undefined) body.amount = patch.amount;
  if (patch.timestamp !== undefined) {
    body.transaction_date = patch.timestamp
      ? new Date(patch.timestamp).toISOString()
      : null;
  }
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.remarks !== undefined) body.remarks = patch.remarks;
  return unwrap(api.put(`/transactions/${id}`, body)).then(toEntry);
};

export const deleteTransaction = (id) =>
  unwrap(api.delete(`/transactions/${id}`));

export const restoreTransaction = (id) =>
  unwrap(api.post(`/transactions/${id}/restore`));

export const bulkCreateTransactions = (items) =>
  unwrap(
    api.post("/transactions/bulk", {
      items: items.map((e) => ({
        card_number: e.cardNumber,
        amount: e.amount,
        remarks: e.remarks ?? null,
        transaction_date: e.timestamp
          ? new Date(e.timestamp).toISOString()
          : null,
      })),
    })
  );

// Upload a CSV/JSON/XML file. `onProgress(percent)` fires on every chunk
// axios reports — wired through to the upload-panel's progress bar. Note
// `e.total` can be missing on some proxies, in which case we just don't
// update (progress stays at the last known value rather than bouncing).
export const uploadFile = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return unwrap(
    api.post("/uploads", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total)
          onProgress(Math.round((e.loaded / e.total) * 100));
      },
    })
  );
};

export const getSummary = () => unwrap(api.get("/reports/summary"));

// Full-dataset aggregates. Use these for dashboard charts instead of
// deriving from the capped /transactions list — they reflect every row,
// scoped to the current user, excluding soft-deleted.
export const getByCardType = () => unwrap(api.get("/reports/by-card-type"));

export const getByDay = (limit = 90) =>
  unwrap(api.get("/reports/by-day", { params: { limit } }));

export const getByCard = (limit = 10) =>
  unwrap(api.get("/reports/by-card", { params: { limit } }));

// Real-time source split — counts of every active row in the DB grouped
// by `source`. The Insights panel reads this so the Batch vs Manual ratio
// reflects the full dataset, not just the 10k entries window.
export const getBySource = () => unwrap(api.get("/reports/by-source"));
