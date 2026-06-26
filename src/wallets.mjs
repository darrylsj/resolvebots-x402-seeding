import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { writeJson } from "./fs.mjs";

function pad(index) {
  return String(index + 1).padStart(2, "0");
}

export function createWalletSet({ campaign, count = 10, network = "eip155:8453", roles = [] }) {
  if (!campaign || !/^[a-z0-9][a-z0-9-]{1,80}$/i.test(campaign)) {
    throw new Error("campaign must be a short slug using letters, numbers, and hyphens");
  }
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("count must be an integer between 1 and 100");
  }

  const createdAt = new Date().toISOString();
  const wallets = Array.from({ length: count }, (_, index) => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const role = roles[index % Math.max(roles.length, 1)] || `evaluator-${pad(index)}`;
    return {
      id: `${campaign}-wallet-${pad(index)}`,
      role,
      network,
      address: account.address,
      privateKey,
      seededTrafficLabel: "sponsored-test",
      createdAt
    };
  });

  return { campaign, network, createdAt, wallets };
}

export async function writeWalletSet(walletSet, outDir = "data") {
  const campaignDir = join(outDir, walletSet.campaign);
  const publicPath = join(campaignDir, "wallets.public.json");
  const privatePath = join(".secrets", walletSet.campaign, "wallets.private.json");

  const publicManifest = {
    campaign: walletSet.campaign,
    network: walletSet.network,
    createdAt: walletSet.createdAt,
    disclosure: "ResolveBots sponsored test wallets for paid-agent launch seeding. These are not organic buyers.",
    wallets: walletSet.wallets.map(({ privateKey, ...wallet }) => wallet)
  };

  await writeJson(publicPath, publicManifest);
  await writeJson(privatePath, walletSet, 0o600);

  return { publicPath, privatePath };
}

