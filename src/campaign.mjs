import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { join } from "node:path";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { readJson, appendJsonl } from "./fs.mjs";

function safeBodyPreview(text) {
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

async function writeEmpty(path) {
  const stream = createWriteStream(path, { flags: "w" });
  stream.end();
  await once(stream, "finish");
}

export async function runCampaignPurchases(options) {
  const walletSet = await readJson(options.privateWallets);
  const limit = Math.min(Number(options.limit || 10), walletSet.wallets.length);
  const outPath = options.out || join("data", options.campaign, `${new Date().toISOString().replaceAll(":", "-")}-run.jsonl`);
  await writeEmpty(outPath);

  const summary = {
    campaign: options.campaign,
    url: options.url,
    live: Boolean(options.live),
    startedAt: new Date().toISOString(),
    outPath,
    attempted: 0,
    succeeded: 0,
    paymentResponses: 0,
    failures: 0
  };

  for (const wallet of walletSet.wallets.slice(0, limit)) {
    const startedAt = new Date().toISOString();
    const record = {
      campaign: options.campaign,
      walletId: wallet.id,
      walletRole: wallet.role,
      address: wallet.address,
      url: options.url,
      method: options.method || "GET",
      live: Boolean(options.live),
      trafficLabel: "sponsored-test",
      startedAt
    };

    summary.attempted += 1;
    try {
      const fetcher = options.live
        ? wrapFetchWithPaymentFromConfig(fetch, {
            schemes: [
              {
                network: options.network || wallet.network || "eip155:8453",
                client: new ExactEvmScheme(privateKeyToAccount(wallet.privateKey))
              }
            ]
          })
        : fetch;

      const response = await fetcher(options.url, { method: options.method || "GET" });
      const body = await response.text();
      const paymentResponse = response.headers.get("PAYMENT-RESPONSE");
      Object.assign(record, {
        ok: response.ok,
        status: response.status,
        paymentResponsePresent: Boolean(paymentResponse),
        completedAt: new Date().toISOString(),
        bodyPreview: safeBodyPreview(body)
      });
      if (response.ok) summary.succeeded += 1;
      if (paymentResponse) summary.paymentResponses += 1;
    } catch (error) {
      summary.failures += 1;
      Object.assign(record, {
        ok: false,
        error: error?.message || String(error),
        completedAt: new Date().toISOString()
      });
    }

    await appendJsonl(outPath, record);
  }

  summary.completedAt = new Date().toISOString();
  return summary;
}

