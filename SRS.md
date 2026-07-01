# Shield — Software Requirements Specification

**Project:** Encrypted Stellar / Shield B2B Dashboard  
**Version:** 1.0  
**Status:** Implementation in progress  
**Last updated:** 2026-06-30

---

## 1. Purpose

Shield is an institutional web interface for confidential payments on Stellar Soroban. Users connect via **Freighter**, manage **BabyJub view keys** locally, and submit **Groth16 proofs** (BN254) verified on-chain by `encrypted_token` + `groth16_verifier`.

This document specifies the **live architecture**: Next.js frontend, **Express + rapidsnark** proof server, and shared **SDK** crypto/Stellar helpers — optimized for self-custody and demo/production readiness.

---

## 2. Scope

### In scope

| Feature | Description |
|---------|-------------|
| Registration | ZK proof of BabyJub key ownership → on-chain `register` |
| Private transfer | Confidential settlement between registered users |
| Private mint | Admin injects encrypted supply (standalone mode) |
| Deposit | Public amount → shielded balance update (converter mode; SAC escrow Phase 2b) |
| Balance decrypt | Client-side only via local view key |
| Proof generation | Express server using **rapidsnark** (snarkjs fallback) |
| Transaction signing | Always **Freighter** (self-custodial Stellar keys) |

### Out of scope (v1)

- Withdraw circuit/on-chain flow
- Production HSM / MPC key management
- Mobile wallet support beyond Freighter
- Mainnet deployment checklist

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Next.js Shield)                                       │
│  • Freighter connect / sign                                     │
│  • View key vault (localStorage)                                │
│  • Transfer witness build (optional Phase 3b — sk stays local)  │
│  • Local decrypt (circomlibjs via dynamic import)               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS JSON
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express backend (backend/)                                     │
│  • POST /tx/register|transfer|mint|deposit                      │
│  • POST /prove/:circuit (witness → proof)                       │
│  • rapidsnark prover + snarkjs witness calc                     │
│  • Soroban simulate + unsigned XDR assembly                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ JSON-RPC
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stellar Testnet — encrypted_token + groth16_verifier           │
└─────────────────────────────────────────────────────────────────┘

Shared: sdk/src/{client,bn254}.ts — crypto, witnesses, Soroban encoding
Artifacts: circuits/build/{register,mint,transfer,deposit}/
```

### 3.1 Self-custody model

| Secret | Location | Sent to server? |
|--------|----------|-----------------|
| Stellar signing key | Freighter | Never |
| BabyJub view/spend key (`sk`) | Browser localStorage | **Never** (target) |
| Plaintext balances | Browser memory only | Never |
| Groth16 witness (transfer) | Browser (target) or server (interim) | Witness only, not raw `sk` (target) |

**Register flow:** Server generates ephemeral BabyJub keypair for the proof, returns `sk` **once** in the API response; the frontend persists it before Freighter signing.

**Decrypt flow:** Entirely client-side. The `/api/decrypt` Next route is **deprecated** in favor of `frontend/lib/decrypt.ts`.

---

## 4. Functional requirements

### 4.1 Registration (FR-REG)

1. User connects Freighter.
2. Frontend `POST /tx/register { address }`.
3. Backend generates BabyJub keypair, runs register proof (rapidsnark), assembles unsigned XDR.
4. Response: `{ unsignedXdr, babyJub: { sk, pk, pkHash }, publicSignals }`.
5. Frontend saves `sk` to view-key vault, prompts Freighter sign, submits tx.
6. Contract stores `user_pk`, zero encrypted balance, `Registered` event.

### 4.2 Private transfer (FR-XFER)

1. Sender must be registered with view key in vault.
2. Backend reads sender/receiver encrypted balances and receiver PK from chain (or client supplies plaintext balance hints).
3. Build transfer witness → prove → assemble `private_transfer` XDR.
4. Sender signs with Freighter.
5. Event exposes `new_from_hash`, `new_to_hash` only (no amount).

**Target (Phase 3b):** Client builds witness locally; server runs rapidsnark only.

### 4.3 Private mint (FR-MINT)

1. Admin wallet connected (matches contract admin).
2. Frontend `POST /tx/mint { to, amount }`.
3. Backend reads recipient balance + PK from chain, builds mint witness, proves, assembles `private_mint` XDR.
4. Admin signs with Freighter.

### 4.4 Deposit (FR-DEP)

1. User registered; specifies public deposit amount.
2. Frontend `POST /tx/deposit { user, amount }`.
3. Backend builds deposit witness (no user `sk` required — uses on-chain PK + balance).
4. User signs with Freighter.
5. On-chain `deposit(user, amount, new_balance, proof, pub_signals)` updates shielded balance.

**Phase 2b:** Add SAC token transfer to protocol escrow in the same transaction.

### 4.5 Balance reveal (FR-BAL)

1. User toggles eye icon on Corporate Balances.
2. Frontend loads view key from vault, decrypts ciphertext locally (`decrypt()` from SDK logic).
3. No network call for decryption.

---

## 5. Backend API (Express)

| Method | Route | Auth | Body | Response |
|--------|-------|------|------|----------|
| GET | `/health` | — | — | `{ ok, prover, rpc, contractId }` |
| POST | `/tx/register` | — | `{ address }` | `{ unsignedXdr, babyJub, publicSignals }` |
| POST | `/tx/transfer` | — | `{ from, to, amount, babyJubSk?, fromBalance?, toBalance?, witness? }` | `{ unsignedXdr, publicInputs, publicSignals }` |
| POST | `/tx/mint` | Admin header | `{ to, amount }` | `{ unsignedXdr, publicInputs, publicSignals }` |
| POST | `/tx/deposit` | — | `{ user, amount }` | `{ unsignedXdr, publicInputs, publicSignals }` |
| POST | `/prove/:circuit` | — | `{ witness: object }` | `{ proof, publicSignals }` |

**Environment variables:**

```env
PORT=8787
RPC_URL=
NETWORK_PASSPHRASE=
ENCRYPTED_TOKEN_CONTRACT_ID=
VK_BUILD_DIR=../circuits/build
RAPIDSNARK_BIN=          # optional; falls back to snarkjs groth16.fullProve
ADMIN_PUBLIC_KEY=        # mint route guard
CORS_ORIGIN=http://localhost:3000
```

**Non-functional:**

- Rate limit: 30 req/min/IP on `/tx/*`
- No request-body logging on proof routes
- Max JSON body: 2 MB

---

## 6. Frontend components

| Component | Route / view | Status |
|-----------|--------------|--------|
| `Sidebar` | Shell | Done |
| `DashboardOverview` | Dashboard | Done |
| `ConfidentialTransferForm` | Transfer | Done — wire to Express |
| `CorporateBalances` | Balances | Done — local decrypt |
| `DepositForm` | Deposit | **New** |
| `MintForm` | Admin mint | **New** (admin-only) |
| `ProofStatusWidget` | Compliance | Done |
| `ConnectWalletButton` | Shell | Done |

**New modules:**

- `lib/api/shield-client.ts` — HTTP client for Express
- `lib/keys/view-key-store.ts` — view key persistence + export
- `lib/decrypt.ts` — client-side balance decryption

**Env:**

```env
NEXT_PUBLIC_SHIELD_API=http://localhost:8787
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_NETWORK_PASSPHRASE=
NEXT_PUBLIC_ENCRYPTED_TOKEN_CONTRACT_ID=
```

---

## 7. SDK extensions

| Function | Purpose |
|----------|---------|
| `buildMintWitness()` | Mint circuit inputs + hashes |
| `buildDepositWitness()` | Deposit circuit inputs + hashes |
| `proveMint()` | snarkjs fallback / CLI |
| `proveDeposit()` | snarkjs fallback / CLI |
| `proveWithProver()` | witness → rapidsnark or snarkjs |

**CLI scripts (TODO):**

- `sdk/scripts/generate-mint-proof.ts`
- `sdk/scripts/generate-deposit-proof.ts`

---

## 8. Smart contract changes

### 8.1 New entrypoint: `deposit`

```rust
pub fn deposit(
    env: Env,
    user: Address,
    amount: i128,
    new_balance: EncryptedBalance,
    proof: Proof,
    pub_signals: Vec<FieldBytes>,
) -> Result<(), Error>
```

- `user.require_auth()`
- `require_registered(user)`
- Verify `OpType::Deposit` proof
- Set `Balance(user)` = `new_balance`
- Emit `Deposit { user, amount }` event

### 8.2 Existing entrypoints

| Function | Role |
|----------|------|
| `register` | User onboarding |
| `private_mint` | Admin mint |
| `private_transfer` | Confidential transfer |
| `get_balance` / `get_user_pk` / `is_registered` | Views |

---

## 9. Proof pipeline (rapidsnark)

1. Build circuit input JSON (SDK witness builders).
2. `snarkjs.wtns.calculate(input, wasm)` → witness buffer.
3. Write `witness.wtns` to temp dir.
4. If `RAPIDSNARK_BIN` set: `{prover} circuit.zkey witness.wtns proof.json public.json`.
5. Else: `snarkjs.groth16.fullProve(input, wasm, zkey)`.
6. `transformProofToSoroban()` → Soroban `Proof` + public signal bytes.

**Rapidsnark build (WSL/Linux):**

```bash
git clone https://github.com/iden3/rapidsnark.git
cd rapidsnark && ./build.sh
export RAPIDSNARK_BIN=$(pwd)/build/prover
```

---

## 10. Implementation phases

| Phase | Deliverables | Acceptance |
|-------|--------------|------------|
| **1** | `SRS.md`, `backend/`, register + transfer routes, rapidsnark service, Makefile | `curl /health`, register + transfer via API |
| **2a** | SDK mint/deposit witnesses, backend mint/deposit routes | Admin mint simulation succeeds |
| **2b** | Contract `deposit`, event, bindings regen, redeploy testnet | On-chain deposit tx |
| **3** | Frontend Express client, DepositForm, MintForm, local decrypt, remove Next `/api/*` | E2E demo from UI |
| **4** | Docker Compose, README updates, rate limits | `make dev-shield` one-command dev |

---

## 11. Repository layout (target)

```
encrypted-stellar/
├── SRS.md
├── backend/                 ← Cloud Run service root (self-contained)
│   ├── Dockerfile           ← build from repo root: docker build -f backend/Dockerfile .
│   ├── src/
│   │   ├── lib/             ← vendored crypto (copy of sdk/src)
│   │   ├── services/
│   │   └── routes/
│   └── circuits/build/      ← baked into container at /app/circuits/build
├── frontend/                ← Next.js UI
├── sdk/                     ← CLI/scripts (dev); backend does not depend on this at runtime
└── circuits/
```

---

## 12. Security considerations

1. View keys never logged or persisted server-side.
2. Mint route validates `ADMIN_PUBLIC_KEY` matches request context.
3. CORS restricted to frontend origin.
4. Circuit artifacts and zkeys mounted read-only.
5. Temp witness files deleted after each request.
6. Register response is the **only** endpoint that returns a view key — must be saved client-side before signing.

---

## 13. References

- [README.md](./README.md) — setup, circuits, deploy
- [MVP.md](./MVP.md) — UI/UX mock requirements
- [circuits/](./circuits/) — Circom sources
- [iden3/rapidsnark](https://github.com/iden3/rapidsnark) — native Groth16 prover

---

## 14. Implementation status

| Phase | Status | Notes |
|-------|--------|-------|
| SRS.md | Done | This document |
| Phase 1 — Express backend | Done | `backend/` with `/health`, `/tx/register`, `/tx/transfer`, rapidsnark + snarkjs fallback |
| Phase 2a — SDK mint/deposit | Done | `buildMintWitness`, `proveMint`, `buildDepositWitness`, `proveDeposit`, `sdk/src/prover.ts` |
| Phase 2b — Contract `deposit` | Done (code) | Requires WASM rebuild + testnet redeploy + Deposit VK upload |
| Phase 3 — Frontend | Done | Express client, DepositForm, MintForm, local decrypt, Next `/api/*` removed |
| Phase 4 — Cloud Run deploy | In progress | `backend/Dockerfile`, monolithic `src/lib/`, default `PORT=8080` |

### Dev startup

```bash
# Terminal 1 — proof server
make install-backend && make dev-backend

# Terminal 2 — UI
make dev-frontend
```

**Frontend `.env.local` (development):**

```env
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_SHIELD_API_DEV=http://localhost:8080
```

**Frontend (production / Vercel):**

```env
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_SHIELD_API_PROD=https://your-cloud-run-url.run.app
```

Optional override for any environment: `NEXT_PUBLIC_SHIELD_API=<url>`

**Root `.env` additions for backend:**

```env
ADMIN_PUBLIC_KEY=<contract-admin-stellar-address>
RAPIDSNARK_BIN=          # optional path to rapidsnark prover binary
PORT=8787
```

