import { describe, expect, it } from "vitest";
import { computeSummary } from "@/lib/debt/summary";
import type { DebtRecord } from "@/lib/debt/types";

const rec = (o: Partial<DebtRecord>): DebtRecord => ({
  id: "x", docNo: "D1", docType: "", date: "2026-08-01", customer: "A", project: "", taxId: "",
  dueDate: "2026-08-31", branch: "", value: 0, vat: 0, total: 1000, depositRef: "",
  status: "วางบิลแล้ว", salesperson: "", paid: 0, ...o,
});

describe("computeSummary with web payments", () => {
  const today = new Date("2026-09-25T00:00:00Z");

  it("counts only the unpaid part of a part-paid bill as outstanding and overdue", () => {
    const s = computeSummary([rec({ paid: 400 })], today);
    expect(s.outstandingAmount).toBe(600);
    expect(s.overdueAmount).toBe(600);
    expect(s.collectedAmount).toBe(400);
    expect(s.topCustomers[0].amount).toBe(600);
    expect(s.agingBuckets[0].amount).toBe(600);
  });

  it("never goes below zero", () => {
    expect(computeSummary([rec({ paid: 1200 })], today).outstandingAmount).toBe(0);
  });
});
