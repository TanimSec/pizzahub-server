import type { Document } from "mongodb";

export const monthStart = (monthsAgo: number): Date => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsAgo, 1));
};

export const monthKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function lastMonths(n = 6): string[] {
  return Array.from({ length: n }, (_, i) => monthKey(monthStart(n - 1 - i)));
}

export function monthlyGroupStage(extra: Document = { count: { $sum: 1 } }): Document {
  return {
    $group: {
      _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } },
      ...extra,
    },
  };
}

export function fillMonths(rows: Document[], fields: string[], months = lastMonths()) {
  const map = new Map<string, Document>(rows.map((r) => [String(r._id), r]));
  return months.map((month) => {
    const row = map.get(month);
    return { month, ...Object.fromEntries(fields.map((f) => [f, Number(row?.[f] ?? 0)])) };
  });
}
