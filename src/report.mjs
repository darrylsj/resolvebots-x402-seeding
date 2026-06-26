import { readFile } from "node:fs/promises";
import { writeJson } from "./fs.mjs";

export async function buildReport(options) {
  const raw = await readFile(options.runLog, "utf8");
  const records = raw.split("\n").filter(Boolean).map(line => JSON.parse(line));
  const seeded = records.filter(record => record.trafficLabel === "sponsored-test");
  const report = {
    campaign: options.campaign,
    generatedAt: new Date().toISOString(),
    disclosure: "This report covers ResolveBots sponsored test traffic. It must not be represented as organic buyer adoption.",
    totals: {
      attempts: records.length,
      seededAttempts: seeded.length,
      successes: records.filter(record => record.ok).length,
      paymentResponses: records.filter(record => record.paymentResponsePresent).length,
      uniqueSeededWallets: new Set(seeded.map(record => record.address)).size
    },
    wallets: seeded.map(record => ({
      walletId: record.walletId,
      role: record.walletRole,
      address: record.address,
      status: record.status,
      ok: record.ok,
      paymentResponsePresent: record.paymentResponsePresent || false,
      error: record.error
    }))
  };

  if (options.out) {
    await writeJson(options.out, report);
  }
  return report;
}

