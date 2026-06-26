import { parseUnits, createWalletClient, createPublicClient, http, getContract, erc20Abi } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { readJson, writeJson } from "./fs.mjs";

const FUNDING_APPROVAL_PHRASE = "I_APPROVE_RESOLVEBOTS_X402_FUNDING";

export async function buildFundingPlan(options) {
  const publicWallets = await readJson(options.publicWallets);
  const usdcPerWallet = String(options.usdcPerWallet || "1.00");
  const ethPerWallet = String(options.ethPerWallet || "0");
  const plan = {
    campaign: options.campaign,
    createdAt: new Date().toISOString(),
    network: publicWallets.network,
    status: "planned-not-funded",
    disclosure: "Funding plan for ResolveBots sponsored test wallets. Creating this file does not move funds.",
    perWallet: {
      usdc: usdcPerWallet,
      ethGasBuffer: ethPerWallet
    },
    totals: {
      wallets: publicWallets.wallets.length,
      usdc: (Number(usdcPerWallet) * publicWallets.wallets.length).toFixed(6),
      ethGasBuffer: (Number(ethPerWallet) * publicWallets.wallets.length).toFixed(18)
    },
    recipients: publicWallets.wallets.map(wallet => ({
      id: wallet.id,
      role: wallet.role,
      address: wallet.address,
      usdc: usdcPerWallet,
      ethGasBuffer: ethPerWallet
    }))
  };

  if (options.out) {
    await writeJson(options.out, plan);
  }
  return plan;
}

export async function fundWallets(options) {
  if (!options.live) {
    return {
      ok: true,
      dryRun: true,
      message: "No funds moved. Re-run with --live after explicit approval."
    };
  }

  if (process.env.RESOLVEBOTS_FUNDING_APPROVAL !== FUNDING_APPROVAL_PHRASE) {
    throw new Error(`Refusing to fund wallets. Set RESOLVEBOTS_FUNDING_APPROVAL=${FUNDING_APPROVAL_PHRASE} after explicit approval.`);
  }
  if (!process.env.FUNDER_PRIVATE_KEY) {
    throw new Error("Refusing to fund wallets without FUNDER_PRIVATE_KEY.");
  }

  const plan = await readJson(options.plan);
  const account = privateKeyToAccount(process.env.FUNDER_PRIVATE_KEY);
  const client = createWalletClient({
    account,
    chain: base,
    transport: http(options.rpcUrl)
  });
  const publicClient = createPublicClient({
    chain: base,
    transport: http(options.rpcUrl)
  });
  const token = getContract({
    address: options.token,
    abi: erc20Abi,
    client
  });
  const decimals = Number(options.decimals || 6);

  const transfers = [];
  for (const recipient of plan.recipients) {
    const amount = parseUnits(String(recipient.usdc), decimals);
    const currentBalance = await publicClient.readContract({
      address: options.token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [recipient.address]
    });
    if (currentBalance >= amount) {
      transfers.push({
        id: recipient.id,
        address: recipient.address,
        amount: recipient.usdc,
        token: options.token,
        status: "skipped-already-funded"
      });
      continue;
    }
    const hash = await token.write.transfer([recipient.address, amount]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    transfers.push({
      id: recipient.id,
      address: recipient.address,
      amount: recipient.usdc,
      token: options.token,
      hash,
      status: receipt.status
    });
  }

  return {
    ok: true,
    dryRun: false,
    campaign: plan.campaign,
    sender: account.address,
    transfers
  };
}
