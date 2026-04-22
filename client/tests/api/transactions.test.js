import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock axios before importing the module under test so `api` picks up the stub.
vi.mock("../../src/api/api", () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return {
    api,
    unwrap: (p) => p.then((r) => r.data?.data ?? r.data),
    getToken: vi.fn(),
    setToken: vi.fn(),
    errorMessage: (e) => e?.message ?? "err",
  };
});

import { api } from "../../src/api/api";
import {
  bulkCreateTransactions,
  createTransaction,
  deleteTransaction,
  getBySource,
  listAllTransactions,
  listTransactions,
  restoreTransaction,
  toEntry,
  updateTransaction,
  uploadFile,
} from "../../src/api/transactions";

const backendRow = {
  id: "e3f44059-2142-4a5e-a593-5b90c46f8635",
  user_id: "416be68b-4c4a-466e-b234-97a1225bdb20",
  card_number: "4267628872390355",
  card_type: "Visa",
  amount: "500.00",
  transaction_date: "2024-06-01T10:00:00",
  status: "success",
  source: "manual_entry",
  file_name: null,
  remarks: "first payment",
  is_deleted: false,
  created_at: "2024-06-01T10:00:00",
  updated_at: "2024-06-01T10:00:00",
};

describe("toEntry", () => {
  it("maps snake_case backend row to camelCase Entry", () => {
    const entry = toEntry(backendRow);
    expect(entry.id).toBe("e3f44059-2142-4a5e-a593-5b90c46f8635");
    expect(entry.cardNumber).toBe("4267628872390355");
    expect(entry.cardType).toBe("Visa");
    expect(entry.amount).toBe(500);
    expect(entry.status).toBe("success");
    expect(entry.source).toBe("manual_entry");
    expect(entry.isDeleted).toBe(false);
    expect(entry.timestamp).toBe(new Date("2024-06-01T10:00:00").getTime());
  });

  it("returns null timestamp when transaction_date is missing", () => {
    expect(toEntry({ ...backendRow, transaction_date: null }).timestamp).toBeNull();
  });

  it("coerces is_deleted truthy values to boolean", () => {
    expect(toEntry({ ...backendRow, is_deleted: 1 }).isDeleted).toBe(true);
    expect(toEntry({ ...backendRow, is_deleted: 0 }).isDeleted).toBe(false);
  });
});

describe("service methods hit the right endpoint + params", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.delete.mockReset();
  });

  it("listAllTransactions asks for all 10k rows sorted desc", async () => {
    api.get.mockResolvedValueOnce({
      data: { data: { items: [backendRow], total: 1, page: 1, page_size: 10000 } },
    });
    const out = await listAllTransactions();
    expect(api.get).toHaveBeenCalledWith(
      "/transactions",
      expect.objectContaining({
        params: expect.objectContaining({
          page: 1,
          page_size: 10000,
          sort_by: "transaction_date",
          sort_dir: "desc",
        }),
      })
    );
    expect(out.total).toBe(1);
    expect(out.items[0].cardNumber).toBe("4267628872390355");
  });

  it("listTransactions passes arbitrary filters straight to the API", async () => {
    api.get.mockResolvedValueOnce({
      data: { data: { items: [], total: 0, page: 1, page_size: 8 } },
    });
    await listTransactions({
      card_type: "Visa",
      date_from: "2024-06-01T00:00:00",
      amount_min: 0,
      sort_by: "amount",
    });
    expect(api.get).toHaveBeenCalledWith("/transactions", {
      params: {
        card_type: "Visa",
        date_from: "2024-06-01T00:00:00",
        amount_min: 0,
        sort_by: "amount",
      },
    });
  });

  it("createTransaction posts snake_case body", async () => {
    api.post.mockResolvedValueOnce({ data: { data: backendRow } });
    const out = await createTransaction({
      cardNumber: "4267628872390355",
      amount: 500,
      remarks: "note",
      timestamp: Date.UTC(2024, 5, 1, 10, 0, 0),
    });
    expect(api.post).toHaveBeenCalledWith(
      "/transactions",
      expect.objectContaining({
        card_number: "4267628872390355",
        amount: 500,
        remarks: "note",
        transaction_date: expect.any(String),
      })
    );
    expect(out.id).toBe(backendRow.id);
  });

  it("updateTransaction only sends changed fields", async () => {
    api.put.mockResolvedValueOnce({ data: { data: backendRow } });
    await updateTransaction("abc", { amount: 99.99 });
    expect(api.put).toHaveBeenCalledWith("/transactions/abc", { amount: 99.99 });
  });

  it("updateTransaction maps cardNumber, status and remarks to snake_case", async () => {
    api.put.mockResolvedValueOnce({ data: { data: backendRow } });
    await updateTransaction("abc", {
      cardNumber: "5553959204036891",
      status: "failed",
      remarks: "chargeback",
    });
    expect(api.put).toHaveBeenCalledWith("/transactions/abc", {
      card_number: "5553959204036891",
      status: "failed",
      remarks: "chargeback",
    });
  });

  it("updateTransaction sends null for an explicitly-cleared timestamp", async () => {
    api.put.mockResolvedValueOnce({ data: { data: backendRow } });
    await updateTransaction("abc", { timestamp: null });
    expect(api.put.mock.calls[0][1]).toEqual({ transaction_date: null });
  });

  it("createTransaction defaults remarks to null and timestamp to null when omitted", async () => {
    api.post.mockResolvedValueOnce({ data: { data: backendRow } });
    await createTransaction({
      cardNumber: "4267628872390355",
      amount: 50,
    });
    expect(api.post).toHaveBeenCalledWith("/transactions", {
      card_number: "4267628872390355",
      amount: 50,
      remarks: null,
      transaction_date: null,
    });
  });

  it("updateTransaction normalizes timestamp to ISO", async () => {
    api.put.mockResolvedValueOnce({ data: { data: backendRow } });
    const when = Date.UTC(2024, 0, 1, 0, 0, 0);
    await updateTransaction("abc", { timestamp: when });
    const body = api.put.mock.calls[0][1];
    expect(body.transaction_date).toBe(new Date(when).toISOString());
  });

  it("deleteTransaction hits DELETE /transactions/:id", async () => {
    api.delete.mockResolvedValueOnce({ data: { data: null } });
    await deleteTransaction("abc");
    expect(api.delete).toHaveBeenCalledWith("/transactions/abc");
  });

  it("restoreTransaction hits POST /transactions/:id/restore", async () => {
    api.post.mockResolvedValueOnce({ data: { data: null } });
    await restoreTransaction("abc");
    expect(api.post).toHaveBeenCalledWith("/transactions/abc/restore");
  });

  it("bulkCreateTransactions posts mapped items", async () => {
    api.post.mockResolvedValueOnce({
      data: { data: { accepted: 2, rejected: 0, rejected_samples: [] } },
    });
    await bulkCreateTransactions([
      { cardNumber: "4267628872390355", amount: 10 },
      { cardNumber: "5553959204036891", amount: 20, remarks: "r" },
    ]);
    expect(api.post).toHaveBeenCalledWith("/transactions/bulk", {
      items: [
        {
          card_number: "4267628872390355",
          amount: 10,
          remarks: null,
          transaction_date: null,
        },
        {
          card_number: "5553959204036891",
          amount: 20,
          remarks: "r",
          transaction_date: null,
        },
      ],
    });
  });

  it("bulkCreateTransactions forwards timestamp as ISO when present", async () => {
    api.post.mockResolvedValueOnce({
      data: { data: { accepted: 1, rejected: 0, rejected_samples: [] } },
    });
    const when = Date.UTC(2024, 5, 1, 10, 0, 0);
    await bulkCreateTransactions([
      { cardNumber: "4267628872390355", amount: 10, timestamp: when },
    ]);
    const body = api.post.mock.calls[0][1];
    expect(body.items[0].transaction_date).toBe(new Date(when).toISOString());
  });

  it("getBySource hits /reports/by-source and returns the unwrapped payload", async () => {
    api.get.mockResolvedValueOnce({
      data: { data: { upload: 9999, manual: 1, unknown: 0, total: 10000 } },
    });
    const out = await getBySource();
    expect(api.get).toHaveBeenCalledWith("/reports/by-source");
    expect(out).toEqual({ upload: 9999, manual: 1, unknown: 0, total: 10000 });
  });

  it("uploadFile sends multipart with progress callback", async () => {
    api.post.mockImplementationOnce((_url, _form, config) => {
      config.onUploadProgress({ loaded: 50, total: 100 });
      return Promise.resolve({
        data: { data: { filename: "x.csv", accepted: 1, rejected: 0 } },
      });
    });
    const file = new File(["x"], "x.csv", { type: "text/csv" });
    const progress = vi.fn();
    await uploadFile(file, progress);
    expect(api.post).toHaveBeenCalledWith(
      "/uploads",
      expect.any(FormData),
      expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } })
    );
    expect(progress).toHaveBeenCalledWith(50);
  });
});
