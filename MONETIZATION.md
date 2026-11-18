# LOWERVIBE Monetization Architecture & Payout Guide

LOWERVIBE is an independent music streaming platform built for artists and listeners across **Malawi, Nigeria, and wider Africa**. This document details how earnings are computed, how revenue splits and fees operate, what eligibility rules govern monetization, and how the automatic payout system integrates with Creator Studio.

---

## 1. How Monetization Works on LOWERVIBE

Every artist account tracks real, verifiable listening activity from Firestore rather than estimated or static counters:

1. **Verified Play Recording (`plays` & `tracks` collections)**
   - A play event is only recorded after a listener streams **at least 30 continuous seconds** (`listenedSeconds >= 30`, enforced in `firestore.rules` and client playback tracking).
   - Plays are deduplicated per listener account and track inside a **30-minute window** (`windowKey`) so repeated scrubbing or refreshing never inflates play counts.
   - **Self-play exclusion:** If the authenticated listener owns the uploaded track or matches `artistId`, the stream is flagged with `isArtistSelfPlay: true` and `qualifiesForPayout: false`.

2. **Real-Time Per-Song Earnings Mapping**
   - Inside **Creator Studio** (`Overview`, `Tracks`, `Analytics`, and `Monetization`), each song subscribes to live Firestore `tracks` and `plays` records.
   - Once an artist's monetization status is `approved` (`isMonetized: true`), every song displays its exact attached earnings:
     $$\text{Song Earnings (MWK)} = \text{round}(\text{Qualifying Plays} \times \text{ratePerPlayMwk})$$
   - Total artist lifetime earnings equal the sum of all song earnings across the artist's catalog, minus any completed or in-flight withdrawal requests (`status !== 'failed'`).

---

## 2. Revenue Splits, Rates & Withdrawal Fees

LOWERVIBE keeps creator math transparent and configurable via Firestore (`config/platform`), managed from the Admin Console:

| Parameter | Default Value | Description |
| :--- | :--- | :--- |
| **`ratePerPlayMwk`** | `4.5 MWK` | Per qualifying stream payout rate in Malawian Kwacha. |
| **`ratePerPlayUsd`** | `$0.0025` | Reference USD equivalent per qualifying stream. |
| **`payoutFeePercent`** | `2.5%` | Processing / settlement fee deducted from gross withdrawal requests to cover mobile-money and gateway disbursement charges. |
| **`minWithdrawalMwk`** | `20,000 MWK` | Minimum balance required before an artist can submit a cashout request, preventing transfer fees from eroding small payouts. |

### Revenue Split Formula (Production Pool Model)

While the current configurable rate (`4.5 MWK / play`) gives artists predictable earnings during launch, scaling LOWERVIBE sustainably relies on tying payouts directly to **real collected platform revenue**:

1. **Revenue Inflows**
   - **Listener Subscriptions / Data-Friendly Passes:** Weekly or monthly ad-free & offline passes paid via Airtel Money, TNM Mpamba, PayChangu, Paystack, or Flutterwave.
   - **Audio & Sponsored Display Ads:** Local brand sponsorships and pre-roll audio spots on free-tier streams.
   - **Direct Fan Support (Tips & Digital Purchases):** Direct listener tips or lossless downloads.
2. **Net Creator Pool Split**
   - **70% Creator Royalty Pool / 30% Platform Operations & Streaming Bandwidth** (or **85% Artist / 15% Platform** on direct fan tips & purchases).
   - Each artist's share of the monthly subscription/ad pool is proportional to their verified qualifying streams:
     $$\text{Artist Monthly Share} = \text{Net Creator Pool} \times \frac{\text{Artist Verified Streams}}{\text{Total Platform Verified Streams}}$$
3. **Withdrawal Fee Breakdown**
   - When an artist requests a withdrawal of `grossAmountMwk`:
     - `feeMwk = round(grossAmountMwk * (payoutFeePercent / 100))`
     - `netAmountMwk = max(0, grossAmountMwk - feeMwk)`
   - The artist sees the exact fee and `netAmountMwk` before confirming the withdrawal.

---

## 3. Payout Eligibility Criteria

Monetization is **locked** until an artist passes all automated integrity checks defined in `MonetizationConfig` (`config/platform`) and enforced across both the client and `firestore.rules`:

| Requirement | Default Threshold | Enforcement |
| :--- | :--- | :--- |
| **Published Catalog** | `>= 3` published songs | Excludes drafts (`isDraft`) and hidden/deranked tracks (`isDeranked`). |
| **Qualifying Real Plays** | `>= 500` plays | Computed across the artist's non-self-play catalog streams. |
| **Follower Base** | `>= 50` followers | Enforced both in Studio UI and Firestore rule `meetsAutoEligibilityBaseline()`. |
| **Copyright Standing** | `0` active strikes (`<= maxActiveStrikes`) | Any suspended profile (`monetizationStatus == 'suspended'`) is blocked from auto-approval. |
| **Re-apply Cooldown** | `14` days | Applies if an account is manually declined for policy violations. |

### Automatic Eligibility Approval

When an artist reaches all thresholds (and is not `suspended`):
- **Automatic Activation:** `AudioContext` and **Creator Studio** automatically promote the artist profile to `isMonetized: true`, `monetizationStatus: 'approved'`, and `monetizationApprovedBy: 'auto-eligibility'`—without waiting for manual admin backlog.
- **Database Security Guard:** `firestore.rules` (`isValidArtistOwnerUpdate`) permits an owner update to set `monetizationStatus = 'approved'` **only** when `monetizationApprovedBy == 'auto-eligibility'`, the account is not `suspended`, `copyrightStrikes <= maxActiveStrikes`, and `followersCount >= requiredFollowers` from `/config/platform`.
- **Admin Override:** The primary admin (`odulamw@gmail.com` with verified email token) can still manually approve, reject, or suspend any artist from the Admin Console (`Monetization & Payouts` tab).

---

## 4. Automatic Payout Acceptance & Studio Settlement Integration

### Supported Payout Rails

Approved and eligible artists can link payout accounts directly inside **Creator Studio → Monetization**:
- **Airtel Money (Malawi):** Validated `+265 99...` or `+265 98...` numbers.
- **TNM Mpamba (Malawi):** Validated `+265 88...` or `+265 89...` numbers.
- **USDT (TRC-20):** Validated TRON addresses (`T...`, 34 characters) for cross-border creators.
- **USDT (BEP-20):** Validated BNB Smart Chain addresses (`0x...`, 42 hex characters).

All identifiers are masked before display/storage metadata (`maskedIdentifier`) and require recent **re-authentication** (`requireReauth`) before adding a payout method or submitting a withdrawal.

### Automatic Acceptance Workflow

1. **Instant Payout Method Acceptance:**
   - When an eligible or monetized artist adds a valid payout method, `addPayoutMethod` marks the method `status: 'accepted'`, sets `acceptedAt`, and makes it immediately available (`payoutHoldUntil: nowIso`) so creators are not blocked unnecessarily.
   - Studio displays the payout status as **Accepted (Auto-verified)** and Admin displays the count of accepted payout methods.
2. **Withdrawal Submission (`payoutRequests` collection):**
   - Artist enters an amount (`>= minWithdrawalMwk` and `<= availableBalanceMwk`) and selects an accepted payout method.
   - Firestore rules validate that:
     - `request.auth.uid` owns both the `artist` document (`isArtistDocOwnedBy`) and the referenced `payoutMethods` document.
     - `grossAmountMwk > 0` and `netAmountMwk > 0`.
     - Initial status is strictly `'awaiting_review'` or `'processing'` (artists can never self-mark a request `'paid'`).
3. **Production Payment Gateway Settlement (Next Integration Step):**
   - Today, when `payoutProviderConfigured === false`, withdrawals queue cleanly in `payoutRequests` for Admin settlement (`Mark Paid` / `Mark Failed` with a `txRef`).
   - To enable **hands-free automated disbursements** in production (`payoutProviderConfigured === true`):
     1. Deploy a **Firebase Cloud Function** (`onDocumentCreated('payoutRequests/{requestId}')`) or Express webhook endpoint holding server-side API secrets (never exposed to the browser).
     2. Route **Malawi Mobile Money** (`airtel_money`, `tnm_mpamba`) through **PayChangu** or **OneKhusa** B2C transfer APIs, and route **Nigeria / Pan-African** bank/wallet transfers through **Flutterwave** or **Paystack Transfers**.
     3. Verify available balance server-side against an immutable double-entry ledger, initiate the transfer with an idempotency key (`requestId`), and update `status: 'paid'` + `txRef` only when the provider's signed webhook confirms settlement.
