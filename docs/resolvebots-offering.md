# ResolveBots x402 Launch Seeding

ResolveBots x402 Launch Seeding is a disclosed testing and promotion service for x402 sellers.

It packages a seller's paid endpoints, verifies discovery, runs real paid-agent trial calls, and reports what happened. Darrylbots is the proof case: its paid research endpoints are listed on x402Scan and can be used as the first internal campaign.

## What We Sell

- Discovery readiness for x402Scan and CDP Bazaar.
- OpenAPI and x402 endpoint checks.
- Sponsored paid-agent test campaigns.
- Campaign wallets for budget control and attribution.
- Seeded-vs-organic reporting.
- Pilot outreach to x402/API teams.
- A self-serve x402 paid intake that sells the first step of the managed service.

## What We Do Not Sell

- Fake buyers.
- Fake endorsements.
- Organic-looking synthetic activity.
- Ranking manipulation guarantees.
- Undisclosed paid promotion.

## Pilot Campaign Positioning

Pilot campaigns can be discounted or free in exchange for permission to publish an anonymised case study.

Suggested pilot offer:

- 10 labelled evaluator wallets.
- 1-3 endpoints tested.
- $100-$500 seed budget supplied by client or ResolveBots.
- One campaign report.
- One discovery-readiness memo.

## x402 Paid Intake SKU

ResolveBots can itself be sold as an x402 service through Darrylbots:

```text
GET https://darrylbots.com/api/resolvebots-x402-launch-seeding-intake
```

Price: `49 USDC` on Base.

This endpoint is the paid front door, not the full campaign. After payment, the buyer receives:

- The intake schema for their x402 seller origin.
- The fulfilment workflow.
- The Darrylbots proof case.
- The managed pilot scope and limitations.
- Next steps for approval, seed budget, and reporting.

The intake fee is credited toward a managed pilot if the buyer proceeds within 30 days.

## Managed Fulfilment Flow

1. Buyer purchases the x402 intake.
2. Buyer sends the completed intake schema to `robotics@agentmail.to`.
3. ResolveBots confirms endpoint list, seed budget, reporting preference, and approval gates.
4. ResolveBots checks discovery surfaces and registers or refreshes x402scan/CDP Bazaar metadata.
5. ResolveBots validates evaluator wallets with parent-child-parent round trips.
6. ResolveBots observes 402 challenges, completes controlled paid test purchases, and records receipts.
7. ResolveBots runs approved sponsored-test seeding purchases.
8. ResolveBots delivers a seeded-vs-organic report with errors, receipts, buyer/volume data, and recommended next actions.

## Landing Copy

Headline:

> Give paid APIs their first real agent buyers.

Subhead:

> ResolveBots registers x402 services, validates paid endpoints, runs controlled evaluator-wallet purchases, and reports what happened. The result is launch liquidity, discovery confidence, and a clean proof trail for sellers entering agentic commerce.

Primary CTA:

> Buy the x402 intake

Secondary CTA:

> See the Darrylbots proof case

## Sales Email

Subject: Your x402 endpoint is live. Want its first paid-agent launch test?

Hi {{name}},

I found {{company}} in the x402 ecosystem and noticed you are already doing the hard part: exposing a paid API agents can buy.

ResolveBots runs x402 launch seeding campaigns. We register or refresh discovery, validate paid endpoints, run controlled evaluator-wallet purchases, and deliver a report showing what worked, what failed, and how your x402scan/Bazaar presence changed.

Darrylbots is our proof case: paid research resources, paid Polymarket chapters, labelled evaluator wallets, and successful controlled purchases.

You can buy the paid intake directly over x402 here:

https://darrylbots.com/api/resolvebots-x402-launch-seeding-intake

Or I can run a discounted pilot for your first 1-3 endpoints.

Best,
ResolveBots
