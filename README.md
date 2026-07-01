# Encrypted Stellar (Shield)

**Private token balances on Stellar Soroban** using Twisted ElGamal (BabyJubJub) commitments and BN254 Groth16 proofs verified with the host's native pairing precompile.

> **Research / hackathon proof-of-concept — not production software.**  
> Deployed on **Stellar testnet** only. This codebase explores privacy primitives in WASM (Soroban); treat balances, keys, and the proof server as demo infrastructure.

**Author:** Blas Antonio Zamora Matich
**License:** [AGPL-3.0-or-later](LICENSE) — see [NOTICE](NOTICE) for authorship.  
**Version:** 0.2.0 (hackathon MVP, June 2026)

---


## What we built

**Shield** is a B2B-style web dashboard where institutions:

1. Connect **Freighter** (testnet)
2. **Register** with a Groth16 proof (BabyJub view key saved locally)
3. **Transfer** shielded amounts to another registered counterparty
4. **Reveal** balances by decrypting locally (view key never leaves the browser)
5. **Deposit** public amounts into shielded balance (contract + VK deployed)
6. **Mint** encrypted supply (admin-only demo)

```
┌─────────────────┐     POST /tx/*      ┌──────────────────┐     Soroban RPC    ┌─────────────────────┐
│  Shield UI      │ ──────────────────► │  Express backend │ ────────────────► │  encrypted_token    │
│  (Next.js)      │   unsigned XDR      │  + rapidsnark    │   submit tx       │  + groth16_verifier │
│  Freighter sign │                     │  (.zkey prove)   │                   │  (VK on-chain)      │
└─────────────────┘                     └──────────────────┘                   └─────────────────────┘
        │                                                                                 ▲
        │ localStorage view key                                                           │
        └──────────────── decrypt get_balance ciphertext ─────────────────────────────────┘
                              (no backend)
```

---

## Architecture

Two Soroban contracts (under the **64 KB WASM** limit):

| Contract | Role | Optimized size |
|----------|------|----------------|
| `groth16_verifier` | BN254 Groth16 verify via `env.crypto().bn254()` | ~10 KB |
| `encrypted_token` | Registration, encrypted balances, cross-contract verify | ~18 KB |

**Circuits (Circom):** `register`, `mint`, `transfer`, `deposit`, `withdraw`  
**Proving:** backend uses `.zkey` + rapidsnark (or snarkjs fallback)  
**Verifying:** contract loads **verification keys** uploaded at deploy (`set_vk`)

---

## Tech stack & versions

| Layer | Stack | Version (pinned in repo) |
|-------|--------|---------------------------|
| Contracts | Rust, soroban-sdk | Rust 1.84+, soroban-sdk **25.0.0** |
| Circuits | Circom 2, snarkjs | snarkjs **0.7.6** |
| SDK / scripts | TypeScript, tsx | @stellar/stellar-sdk **16.0.1** |
| Backend | Express 5, rapidsnark | Node **≥ 20**, Express **5.1** |
| Frontend | Next.js, React, Tailwind | Next **16.2.9**, React **19.2.4** |
| Wallet | Freighter | @stellar/freighter-api **6.0.1** |

---

## What works / what doesn't

### Working on testnet (verified)

- [x] Deploy verifier + token + all circuit VKs (`make deploy`)
- [x] Register (UI + CLI)
- [x] Private transfer sender → registered receiver
- [x] Local balance decrypt (view key in browser or CLI state file)
- [x] Deposit entrypoint (after redeploy with `deposit` in WASM)
- [x] Admin mint (backend + Freighter admin wallet)
- [x] Contract events (`Registered`, `PrivateTransfer`, `VkSet`, …)
- [x] Counterparty registration flow in UI (switch Freighter to receiver wallet)

### Demo / partial / not production-ready

- [ ] **Withdraw** — circuit + VK uploaded; no contract entrypoint yet
- [ ] **Converter mode** — no real USDC escrow; asset dropdown in UI is **label only**
- [ ] **Compliance view** — presentation / event inspection, not legal compliance
- [ ] **Client-side proving** — proofs run on backend today (`.zkey` on server); view keys for transfer sent to backend for witness building (documented trade-off for MVP)
- [ ] **Mainnet** — testnet only
- [ ] **Production key management** — demo uses `.env` secrets and localStorage

---

## Registration: three options (do not put secrets in the frontend)

| Method | When to use | Where secrets live |
|--------|-------------|-------------------|
| **A. Freighter UI (recommended)** | Real user / counterparty flow | View key → browser `localStorage`; Stellar auth → Freighter |
| **B. Makefile / CLI** | Automate demo receptor | `RECEPTOR_SECRET_KEY` in **root `.env` only** → `make proof-register-receptor` |
| **C. UI + backend (demo shortcut)** | Skip Freighter wallet switching | Paste receiver **secret** on Transfer page → `POST /tx/register-counterparty` signs server-side; view key saved in browser for receiver address |

Disable option C in production: `ALLOW_COUNTERPARTY_REGISTER=false` in backend env.

### Never do this

```env
# WRONG — any NEXT_PUBLIC_* is bundled into the browser bundle
NEXT_PUBLIC_RECEPTOR_SECRET_KEY=S...
```

Stellar **secret keys must not** appear in frontend code, `frontend/.env.local`, or public repos. Hackathon judges (and AGPL) care that you **document** this honestly; AGPL does not require exposing your private keys.

### Backend-assisted registration (CLI today)

Equivalent to `make proof-register-receptor`:

```bash
# .env (never commit)
RECEPTOR_SECRET_KEY=S...
TEST_RECEPTOR_ADDRESS=G...

make proof-register-receptor
```

The script generates a BabyJub keypair, proves registration, signs with the receptor secret, and saves state to `circuits/build/register/state-receptor.json`. The UI path is preferred for demonstrating self-custody.


## Project layout

```
encrypted-stellar/
├── contracts/
│   ├── groth16_verifier/    BN254 verifier contract
│   └── encrypted_token/     Token, VK storage, register/mint/transfer/deposit
├── circuits/                Circom sources + build/ artifacts (.zkey, VK JSON)
├── sdk/                     Crypto helpers, deploy scripts, CLI proof flows
├── backend/                 Shield Express API (prove + assemble XDR)
├── frontend/                Shield Next.js dashboard (Freighter)
├── scripts/                 build-circuits.sh, generate-bindings.sh
├── Makefile                 ← primary entry point for build/deploy/demo
├── LICENSE                  AGPL-3.0-or-later
├── NOTICE                   Authorship
└── .env                     Secrets + contract IDs (gitignored — use .env.example pattern)
```

---

## Quick start (Makefile)

**Use the Makefile** — do not hand-copy `cargo` / `stellar` commands unless debugging.

```bash
# Prerequisites: Rust 1.84+, wasm32v1-none, Node 20+, Stellar CLI, circom, PTAU file at repo root

make install-sdk
make install-backend
make install-frontend

# Circuits (needs powersOfTau28_hez_final_14.ptau at repo root)
make circuits-phase2 PTAU=./powersOfTau28_hez_final_14.ptau

make build-contracts
make deploy                    # deploy contracts + upload all VKs; updates .env + frontend/.env.local

# Terminal 1
make dev-backend               # http://localhost:8080

# Terminal 2
make dev-frontend              # http://localhost:3000
```

Full target list: `make help`

---

## Environment variables

### Root `.env` (backend + SDK — **never commit**)

```env
RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
SECRET_KEY=S...                 # deploy / admin CLI
RECEPTOR_SECRET_KEY=S...        # optional — make proof-register-receptor only
TEST_RECEPTOR_ADDRESS=G...
ENCRYPTED_TOKEN_CONTRACT_ID=C...
GROTH16_VERIFIER_CONTRACT_ID=C...
VK_BUILD_DIR=../circuits/build
```

### `frontend/.env.local` (public config only)

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_ENCRYPTED_TOKEN_CONTRACT_ID=C...
NEXT_PUBLIC_SHIELD_API_DEV=http://localhost:8080
NEXT_PUBLIC_DEMO_RECEPTOR_ADDRESS=G...   # optional — prefill transfer receiver
```

Copy from [`frontend/.env.local.example`](frontend/.env.local.example).

---

## Demo B2B flow (two wallets)

| Step | Sender (`GBT7…`) | Receiver (`GD4RG…`) |
|------|------------------|---------------------|
| 1 | Connect Freighter → **Register** | Switch Freighter account → **Register** (Transfer page counterparty panel) |
| 2 | Optional: **Copy view key backup** | Same |
| 3 | Transfer → enter receiver → sign | — |
| 4 | — | Balances → **Reveal** (needs view key in this browser) |

CLI alternative for receiver: `make proof-register-receptor` with `RECEPTOR_SECRET_KEY` in `.env`.

---

## Shield frontend features

- Freighter connect + testnet mismatch banner
- On-chain reads: `is_registered`, `get_balance`, contract events
- Register / transfer / deposit / mint via backend proof API → Freighter sign
- View key: saved at register, import backup, copy backup toast
- Counterparty registration status on transfer page
- Balance decrypt **entirely in browser** (circomlibjs + BabyJub sk)

---

## Shield backend API

| Route | Purpose |
|-------|---------|
| `GET /health` | RPC, contract ID, `features.deposit` probe |
| `POST /tx/register` | Groth16 register proof + unsigned XDR (Freighter sign) |
| `POST /tx/register-counterparty` | Demo: `{ secretKey }` → prove, sign, submit register server-side |
| `POST /tx/transfer` | Transfer proof (needs `babyJubSk` for witness) |
| `POST /tx/deposit` | Deposit proof |
| `POST /tx/mint` | Mint proof (admin header) |

Proving keys (`.zkey`) stay on the server; verification keys are on-chain.

---

## Contract API (token)

| Function | Description |
|----------|-------------|
| `set_vk(op, vk)` | Admin: store VK for Register/Mint/Transfer/Deposit/Withdraw |
| `register(user, user_pk, proof, pub_signals)` | User registers with ZK proof |
| `private_mint(to, new_balance, proof, pub_signals)` | Admin mints encrypted balance |
| `deposit(user, amount, new_balance, proof, pub_signals)` | Public amount → shielded balance |
| `private_transfer(from, to, new_from, new_to, proof, pub_signals)` | Private transfer |
| `get_balance(user)` | Encrypted ciphertext `(c1, c2)` |
| `get_user_pk(user)` | BabyJub public key |
| `is_registered(user)` | Registration flag |

---

## Makefile reference

```bash
make help
make build-contracts      # cargo release + stellar contract optimize
make deploy               # deploy + all VKs
make upload-vks           # re-upload VKs to existing contract
make proof-register       # CLI register owner
make proof-register-receptor   # CLI register TEST_RECEPTOR (needs RECEPTOR_SECRET_KEY)
make proof-transfer
make check-register / make check-receptor
make decrypt-balance / make decrypt-receptor
make fetch-events
make dev-backend / make dev-frontend
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Deposit “not on deployed contract” | Redeploy with `deposit` entrypoint: `make build-contracts && make deploy` |
| Receiver transfer fails | Ensure receiver registered (`make check-receptor` or UI counterparty panel) |
| Cannot decrypt balance | View key in browser must match on-chain `get_user_pk` from registration |
| `make build-contracts` deprecation warning | Makefile uses `stellar contract optimize` (still works); ignore or migrate later to `stellar contract build --optimize` |
| Windows TLS on npm | Makefile sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for local dev only |
| WASM > 64 KB | Split verifier + token; use optimized WASM |

---

## Contributing

Contributions welcome under the same **AGPL-3.0-or-later** terms. By contributing, you agree your commits may be licensed under this project's LICENSE with copyright notices preserved.

---

## Status summary

| Feature | Status |
|---------|--------|
| Register | ✅ testnet |
| Transfer | ✅ testnet |
| Decrypt (local) | ✅ |
| Deposit | ✅ after redeploy |
| Mint | ✅ admin demo |
| Withdraw | ⏳ circuit only |
| Freighter UI | ✅ |
| CLI / Makefile demos | ✅ |
| Production hardening | ❌ out of scope |

---

## Further reading

- [`SRS.md`](SRS.md) — detailed system spec (implementation notes)
- [`MVP.md`](MVP.md) — original UI product brief (superseded by live Freighter integration)
