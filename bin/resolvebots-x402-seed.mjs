#!/usr/bin/env node

import { Command } from "commander";
import { createWalletSet, writeWalletSet } from "../src/wallets.mjs";
import { buildFundingPlan, fundWallets, roundtripWallets, sweepWallets } from "../src/funding.mjs";
import { runCampaignPurchases } from "../src/campaign.mjs";
import { checkDiscovery } from "../src/discovery.mjs";
import { buildReport } from "../src/report.mjs";

const program = new Command();

program
  .name("resolvebots-x402-seed")
  .description("ResolveBots x402 launch seeding and testing harness")
  .version("0.1.0");

program
  .command("wallets:create")
  .description("Create labelled campaign test wallets and write public/private manifests")
  .requiredOption("--campaign <name>", "campaign slug, e.g. darrylbots-proof")
  .option("--count <number>", "number of child test wallets", "10")
  .option("--network <network>", "x402 network identifier", "eip155:8453")
  .option("--out <dir>", "campaign data directory", "data")
  .option("--roles <roles>", "comma-separated evaluator roles", "metadata-auditor,stock-agent,price-checker,latency-checker,report-reader,workflow-agent,api-integrator,marketplace-reviewer,qa-agent,launch-observer")
  .action(async options => {
    const wallets = createWalletSet({
      campaign: options.campaign,
      count: Number(options.count),
      network: options.network,
      roles: options.roles.split(",").map(role => role.trim()).filter(Boolean)
    });
    const paths = await writeWalletSet(wallets, options.out);
    console.log(JSON.stringify({ ok: true, campaign: wallets.campaign, count: wallets.wallets.length, ...paths }, null, 2));
  });

program
  .command("funding:plan")
  .description("Create a funding plan for child test wallets without moving funds")
  .requiredOption("--campaign <name>", "campaign slug")
  .requiredOption("--public-wallets <path>", "public wallet manifest from wallets:create")
  .option("--usdc-per-wallet <amount>", "USDC amount per wallet", "1.00")
  .option("--eth-per-wallet <amount>", "optional ETH gas buffer per wallet", "0")
  .option("--out <path>", "funding plan output path")
  .action(async options => {
    const plan = await buildFundingPlan(options);
    console.log(JSON.stringify(plan, null, 2));
  });

program
  .command("funding:send")
  .description("Guarded live ERC-20 funding transfer to child test wallets")
  .requiredOption("--plan <path>", "funding plan JSON from funding:plan")
  .requiredOption("--token <address>", "ERC-20 token contract address, e.g. USDC on Base")
  .option("--rpc-url <url>", "EVM RPC URL", process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com")
  .option("--decimals <number>", "token decimals", "6")
  .option("--live", "actually send transfers")
  .action(async options => {
    const result = await fundWallets(options);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("funding:sweep")
  .description("Guarded live USDC sweep from child wallets back to a parent wallet using EIP-3009 authorizations")
  .requiredOption("--private-wallets <path>", "private wallet manifest from wallets:create")
  .requiredOption("--to <address>", "parent wallet address to receive swept funds")
  .requiredOption("--token <address>", "ERC-20 token contract address, e.g. USDC on Base")
  .option("--rpc-url <url>", "EVM RPC URL", process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com")
  .option("--decimals <number>", "token decimals", "6")
  .option("--reserve-usdc <amount>", "USDC to leave in each child wallet", "0")
  .option("--limit <number>", "max wallets to sweep", "100")
  .option("--live", "actually submit sweep transactions")
  .action(async options => {
    const result = await sweepWallets(options);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("funding:roundtrip")
  .description("Guarded parent-child-parent USDC round-trip test before wallet validation")
  .requiredOption("--private-wallets <path>", "private wallet manifest from wallets:create")
  .requiredOption("--parent <address>", "parent funding wallet address")
  .requiredOption("--token <address>", "ERC-20 token contract address, e.g. USDC on Base")
  .option("--rpc-url <url>", "EVM RPC URL", process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com")
  .option("--decimals <number>", "token decimals", "6")
  .option("--amount-usdc <amount>", "USDC amount to send out and sweep back for each child", "0.10")
  .option("--limit <number>", "max wallets to test", "100")
  .option("--live", "actually submit round-trip transactions")
  .action(async options => {
    const result = await roundtripWallets(options);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("discovery:check")
  .description("Check a seller origin for OpenAPI and x402 discovery surfaces")
  .requiredOption("--origin <url>", "seller origin, e.g. https://darrylbots.com")
  .action(async options => {
    const result = await checkDiscovery(options.origin);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("campaign:run")
  .description("Run a dry-run or live x402 purchase campaign")
  .requiredOption("--campaign <name>", "campaign slug")
  .requiredOption("--private-wallets <path>", "private wallet manifest from wallets:create")
  .requiredOption("--url <url>", "x402 paid endpoint URL")
  .option("--method <method>", "HTTP method", "GET")
  .option("--network <network>", "x402 network identifier", "eip155:8453")
  .option("--limit <number>", "max wallets to use", "10")
  .option("--out <path>", "JSONL run log path")
  .option("--live", "make paid x402 requests; otherwise only tests 402 challenge")
  .action(async options => {
    const result = await runCampaignPurchases(options);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("report:build")
  .description("Build a seeded-vs-organic campaign report from run logs")
  .requiredOption("--campaign <name>", "campaign slug")
  .requiredOption("--run-log <path>", "JSONL run log from campaign:run")
  .option("--out <path>", "report JSON output path")
  .action(async options => {
    const report = await buildReport(options);
    console.log(JSON.stringify(report, null, 2));
  });

program.parseAsync(process.argv).catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
