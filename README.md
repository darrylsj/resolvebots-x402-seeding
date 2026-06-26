# ResolveBots x402 Seeding

ResolveBots x402 Seeding is a launch-testing harness for disclosed x402 paid-agent campaigns.

It creates labelled test wallets, produces funding plans, runs dry-run or live x402 purchase tests, and builds seeded-vs-organic campaign reports. Darrylbots is the first proof case.

## Important Safety Line

This project is for sponsored testing and launch seeding. It is not for fake buyers, fake endorsements, or undisclosed ranking manipulation.

Wallets created by this tool are campaign test wallets. Reports label their traffic as `sponsored-test`.

## Install

```bash
npm install
```

## Create 10 Test Wallets

```bash
npm run start -- wallets:create --campaign darrylbots-proof --count 10
```

This writes:

- `data/darrylbots-proof/wallets.public.json`
- `.secrets/darrylbots-proof/wallets.private.json`

The private manifest is ignored by git.

## Build a Funding Plan

```bash
npm run start -- funding:plan \
  --campaign darrylbots-proof \
  --public-wallets data/darrylbots-proof/wallets.public.json \
  --usdc-per-wallet 1.00 \
  --out data/darrylbots-proof/funding-plan.json
```

This does not move funds.

## Guarded Live Funding

Live funding requires all of the following:

- Explicit Darryl approval for source wallet, chain, token, amount, and recipient list.
- `FUNDER_PRIVATE_KEY` in the environment.
- `RESOLVEBOTS_FUNDING_APPROVAL=I_APPROVE_RESOLVEBOTS_X402_FUNDING`
- `--live`

Example:

```bash
RESOLVEBOTS_FUNDING_APPROVAL=I_APPROVE_RESOLVEBOTS_X402_FUNDING \
FUNDER_PRIVATE_KEY=0x... \
npm run start -- funding:send \
  --plan data/darrylbots-proof/funding-plan.json \
  --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --live
```

## Dry-Run a Darrylbots x402 Endpoint

```bash
npm run start -- campaign:run \
  --campaign darrylbots-proof \
  --private-wallets .secrets/darrylbots-proof/wallets.private.json \
  --url https://darrylbots.com/api/research-report-standard \
  --limit 10
```

Dry-run mode checks the endpoint and should observe the `402 Payment Required` challenge. It does not make paid purchases.

## Live x402 Purchases

After wallets are funded and approved:

```bash
npm run start -- campaign:run \
  --campaign darrylbots-proof \
  --private-wallets .secrets/darrylbots-proof/wallets.private.json \
  --url https://darrylbots.com/api/research-report-standard \
  --limit 10 \
  --live
```

## Build Report

```bash
npm run start -- report:build \
  --campaign darrylbots-proof \
  --run-log data/darrylbots-proof/YOUR-RUN.jsonl \
  --out reports/darrylbots-proof-report.json
```

## ResolveBots Offering

See `docs/resolvebots-offering.md`.

