# LOWERVIBE — Production Setup & Deployment Guide

Follow these steps to run LOWERVIBE with live Firebase Auth, Storage, Firestore Security Rules, Cloud Functions, and automated payouts.

---

## 1. Prerequisites
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Logged-in Firebase account owning project `lowervibemusic`

---

## 2. Firebase Authentication Configuration
Open **Firebase Console → Authentication → Sign-in method** and enable:
1. **Email/Password** (used for sign up, sign in, password reset, and email verification).
2. **Google** (select your support email `odulamw@gmail.com`).
3. **Phone** (real Firebase SMS OTP — no client-side fake OTP PINs).

Under **Authentication → Settings → Authorized domains**, add:
- `localhost`
- Your production domain (e.g. `lowervibe.com` or Cloud Run / Firebase Hosting URL).

---

## 3. Deploy Firestore & Storage Rules
From the project root:
```bash
firebase login
firebase use lowervibemusic
firebase deploy --only firestore:rules,storage
```

Verify:
- `firestore.rules` protects `artists.monetizationStatus`, `artists.earningsBalanceMwk`, `artists.verified`, and `users.role == 'admin'` so only `odulamw@gmail.com` can grant monetization or settle payouts.
- `storage.rules` enforces owner UID paths, 120MB audio limits (`audio/*`), and 10MB cover/avatar limits (`image/*`).

---

## 4. Deploy Cloud Functions & Configure Payout Providers
1. Initialize/install dependencies inside `functions/`:
   ```bash
   cd functions
   npm init -y   # if package.json is not yet created
   npm install firebase-admin firebase-functions
   ```
2. Set payout provider environment secrets (required **only** when switching from Manual Review to automated payouts):
   - **Malawi Mobile Money (Airtel Money / TNM Mpamba)**:
     - `PAYCHANGU_SECRET_KEY=...` (recommended for Malawi MWK payouts)
     - OR `FLUTTERWAVE_SECRET_KEY=...`
   - **USDT Withdrawals (TRC-20 / BEP-20)**:
     - `TRONGRID_API_KEY=...` (for TRC-20)
     - `BSC_RPC_URL=...` (for BEP-20)
     - `USDT_TREASURY_PRIVATE_KEY=...` (server-only hot wallet key)
3. Deploy:
   ```bash
   firebase deploy --only functions
   ```
4. Once provider keys are live, sign in as `odulamw@gmail.com`, open **Admin Console → Settings**, and toggle **Automated Payout Provider Configured** ON. Until then, withdrawal requests stay clearly marked **Awaiting manual review**.

---

## 5. Legal & Compliance Placeholders
Before public launch, update `/src/config/legalConfig.ts` with your registered business details:
- `companyName` (registered business / sole proprietorship name)
- `physicalAddress` (Malawi / registered business address)
- `supportEmail`, `privacyEmail`, `dmcaEmail`
- `termsVersion` (bump this string whenever updating Terms of Service to prompt existing users to re-accept).

---

## 6. Primary Admin Account
- Sign up or sign in using **`odulamw@gmail.com`**.
- Navigate to `/admin/dashboard` (or **Account → Admin Portal**) to review artist applications, verify songs, set `ratePerPlayMwk` and `minWithdrawalMwk`, approve monetization eligibility, settle payout requests, and reply to support tickets.

---

## 7. Build & Verify Frontend
```bash
npm install
npm run lint
npm run build
```
