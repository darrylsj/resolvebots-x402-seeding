import {
  parseUnits,
  createWalletClient,
  createPublicClient,
  http,
  getContract,
  erc20Abi,
  parseSignature
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { eip3009ABI, authorizationTypes } from "@x402/evm";
import { readJson, writeJson } from "./fs.mjs";

const FUNDING_APPROVAL_PHRASE = "I_APPROVE_RESOLVEBOTS_X402_FUNDING";
const SWEEP_APPROVAL_PHRASE = "I_APPROVE_RESOLVEBOTS_X402_SWEEP";
const ROUNDTRIP_APPROVAL_PHRASE = "I_APPROVE_RESOLVEBOTS_X402_ROUNDTRIP";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readTokenBalanceWithRetry(publicClient, token, address, attempts = 5) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address]
      });
    } catch (error) {
      lastError = error;
      await sleep(750 * (index + 1));
    }
  }
  throw lastError;
}

async function waitForTokenBalance(publicClient, token, address, expectedBalance, attempts = 8) {
  let balance = 0n;
  for (let index = 0; index < attempts; index += 1) {
    balance = await readTokenBalanceWithRetry(publicClient, token, address);
    if (balance === expectedBalance) {
      return balance;
    }
    await sleep(1000 * (index + 1));
  }
  return balance;
}

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
    const currentBalance = await readTokenBalanceWithRetry(publicClient, options.token, recipient.address);
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

function randomNonce() {
  return `0x${randomBytes(32).toString("hex")}`;
}

function signatureParts(signature) {
  const parsed = parseSignature(signature);
  const v = parsed.v ?? BigInt(Number(parsed.yParity ?? 0) + 27);
  return {
    v: Number(v),
    r: parsed.r,
    s: parsed.s
  };
}

export async function sweepWallets(options) {
  const walletSet = await readJson(options.privateWallets);
  const limit = Math.min(Number(options.limit || 100), walletSet.wallets.length);
  const decimals = Number(options.decimals || 6);
  const reserve = parseUnits(String(options.reserveUsdc || "0"), decimals);
  const rpcUrl = options.rpcUrl || "https://base-rpc.publicnode.com";
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl)
  });

  const planned = [];
  for (const wallet of walletSet.wallets.slice(0, limit)) {
    const balance = await readTokenBalanceWithRetry(publicClient, options.token, wallet.address);
    const sweepAmount = balance > reserve ? balance - reserve : 0n;
    planned.push({
      id: wallet.id,
      role: wallet.role,
      from: wallet.address,
      to: options.to,
      token: options.token,
      balanceAtomic: balance.toString(),
      reserveAtomic: reserve.toString(),
      sweepAmountAtomic: sweepAmount.toString(),
      status: sweepAmount > 0n ? "planned" : "skipped-empty-or-reserved"
    });
  }

  if (!options.live) {
    return {
      ok: true,
      dryRun: true,
      message: "No funds moved. Re-run with --live after explicit approval.",
      wallets: planned
    };
  }

  if (process.env.RESOLVEBOTS_SWEEP_APPROVAL !== SWEEP_APPROVAL_PHRASE) {
    throw new Error(`Refusing to sweep wallets. Set RESOLVEBOTS_SWEEP_APPROVAL=${SWEEP_APPROVAL_PHRASE} after explicit approval.`);
  }
  if (!process.env.PARENT_PRIVATE_KEY) {
    throw new Error("Refusing to sweep wallets without PARENT_PRIVATE_KEY.");
  }

  const parent = privateKeyToAccount(process.env.PARENT_PRIVATE_KEY);
  if (parent.address.toLowerCase() !== options.to.toLowerCase()) {
    throw new Error(`PARENT_PRIVATE_KEY address ${parent.address} does not match --to ${options.to}.`);
  }

  const client = createWalletClient({
    account: parent,
    chain: base,
    transport: http(rpcUrl)
  });

  const now = Math.floor(Date.now() / 1000);
  const validAfter = 0n;
  const validBefore = BigInt(now + 60 * 60);
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: base.id,
    verifyingContract: options.token
  };

  const transfers = [];
  for (const plannedTransfer of planned) {
    const value = BigInt(plannedTransfer.sweepAmountAtomic);
    if (value <= 0n) {
      transfers.push(plannedTransfer);
      continue;
    }

    const child = walletSet.wallets.find(wallet => wallet.id === plannedTransfer.id);
    const childAccount = privateKeyToAccount(child.privateKey);
    const nonce = randomNonce();
    const message = {
      from: childAccount.address,
      to: options.to,
      value,
      validAfter,
      validBefore,
      nonce
    };
    const signature = await childAccount.signTypedData({
      domain,
      types: authorizationTypes,
      primaryType: "TransferWithAuthorization",
      message
    });
    const { v, r, s } = signatureParts(signature);
    const hash = await client.writeContract({
      address: options.token,
      abi: eip3009ABI,
      functionName: "transferWithAuthorization",
      args: [
        childAccount.address,
        options.to,
        value,
        validAfter,
        validBefore,
        nonce,
        v,
        r,
        s
      ]
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    transfers.push({
      ...plannedTransfer,
      status: receipt.status,
      hash
    });
  }

  return {
    ok: true,
    dryRun: false,
    parent: parent.address,
    transfers
  };
}

export async function roundtripWallets(options) {
  const walletSet = await readJson(options.privateWallets);
  const limit = Math.min(Number(options.limit || 100), walletSet.wallets.length);
  const decimals = Number(options.decimals || 6);
  const amount = parseUnits(String(options.amountUsdc || "0.10"), decimals);
  const rpcUrl = options.rpcUrl || "https://base-rpc.publicnode.com";
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl)
  });

  const planned = [];
  for (const wallet of walletSet.wallets.slice(0, limit)) {
    const startingBalance = await readTokenBalanceWithRetry(publicClient, options.token, wallet.address);
    planned.push({
      id: wallet.id,
      role: wallet.role,
      parent: options.parent,
      child: wallet.address,
      token: options.token,
      amountAtomic: amount.toString(),
      startingChildBalanceAtomic: startingBalance.toString(),
      status: "planned"
    });
  }

  if (!options.live) {
    return {
      ok: true,
      dryRun: true,
      message: "No funds moved. Re-run with --live after explicit approval.",
      wallets: planned
    };
  }

  if (process.env.RESOLVEBOTS_ROUNDTRIP_APPROVAL !== ROUNDTRIP_APPROVAL_PHRASE) {
    throw new Error(`Refusing to round-trip wallets. Set RESOLVEBOTS_ROUNDTRIP_APPROVAL=${ROUNDTRIP_APPROVAL_PHRASE} after explicit approval.`);
  }
  if (!process.env.PARENT_PRIVATE_KEY) {
    throw new Error("Refusing to round-trip wallets without PARENT_PRIVATE_KEY.");
  }

  const parent = privateKeyToAccount(process.env.PARENT_PRIVATE_KEY);
  if (parent.address.toLowerCase() !== options.parent.toLowerCase()) {
    throw new Error(`PARENT_PRIVATE_KEY address ${parent.address} does not match --parent ${options.parent}.`);
  }

  const client = createWalletClient({
    account: parent,
    chain: base,
    transport: http(rpcUrl)
  });
  const token = getContract({
    address: options.token,
    abi: erc20Abi,
    client
  });
  const now = Math.floor(Date.now() / 1000);
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: base.id,
    verifyingContract: options.token
  };

  const results = [];
  for (const plan of planned) {
    const child = walletSet.wallets.find(wallet => wallet.id === plan.id);
    const childAccount = privateKeyToAccount(child.privateKey);
    const startingBalance = BigInt(plan.startingChildBalanceAtomic);

    const sendHash = await token.write.transfer([childAccount.address, amount]);
    const sendReceipt = await publicClient.waitForTransactionReceipt({ hash: sendHash });
    const afterSendBalance = await readTokenBalanceWithRetry(publicClient, options.token, childAccount.address);
    const sweepAmount = afterSendBalance > startingBalance ? afterSendBalance - startingBalance : 0n;
    if (sweepAmount !== amount) {
      throw new Error(`Round-trip amount mismatch for ${plan.id}: expected ${amount}, got ${sweepAmount}`);
    }

    const validAfter = 0n;
    const validBefore = BigInt(now + 60 * 60);
    const nonce = randomNonce();
    const message = {
      from: childAccount.address,
      to: parent.address,
      value: sweepAmount,
      validAfter,
      validBefore,
      nonce
    };
    const signature = await childAccount.signTypedData({
      domain,
      types: authorizationTypes,
      primaryType: "TransferWithAuthorization",
      message
    });
    const { v, r, s } = signatureParts(signature);
    const sweepHash = await client.writeContract({
      address: options.token,
      abi: eip3009ABI,
      functionName: "transferWithAuthorization",
      args: [
        childAccount.address,
        parent.address,
        sweepAmount,
        validAfter,
        validBefore,
        nonce,
        v,
        r,
        s
      ]
    });
    const sweepReceipt = await publicClient.waitForTransactionReceipt({ hash: sweepHash });
    const finalBalance = await waitForTokenBalance(publicClient, options.token, childAccount.address, startingBalance);
    results.push({
      ...plan,
      afterSendChildBalanceAtomic: afterSendBalance.toString(),
      finalChildBalanceAtomic: finalBalance.toString(),
      sendHash,
      sendStatus: sendReceipt.status,
      sweepHash,
      sweepStatus: sweepReceipt.status,
      validated: finalBalance === startingBalance && sendReceipt.status === "success" && sweepReceipt.status === "success"
    });
  }

  return {
    ok: results.every(result => result.validated),
    dryRun: false,
    parent: parent.address,
    amountAtomic: amount.toString(),
    results
  };
}
