# Encrypted Stellar

Private token balances on Stellar/Soroban using **Twisted ElGamal** (BabyJubJub) and **BN254 Groth16** proofs verified with the host's native pairing precompile.

# This implementation is part of an ongoing R&D initiative exploring the deployment of Twisted ElGamal privacy primitives within WebAssembly-based execution environments (Soroban). The current codebase serves strictly as a non-production, cryptographic research proof-of-concept for performance benchmarking on the Stellar Testnet.

## Architecture

Two Soroban contracts stay under the **64 KB WASM limit**:

| Contract | Role | Size (optimized) |
|----------|------|------------------|
| `groth16_verifier` | BN254 Groth16 pairing check via `env.crypto().bn254()` | ~11 KB |
| `encrypted_token` | User registration, encrypted balances, cross-contract verify | ~15 KB |

```
Client (snarkjs)
  ├─ generate BabyJub keypair + Groth16 proof
  └─ submit Soroban tx
        └─ encrypted_token.register / private_mint / private_transfer
              └─ groth16_verifier.verify(vk, proof, pub_signals)
```

**Circuits** (Circom): `register`, `mint`, `transfer`, `deposit`, `withdraw`  
**Public signals** bind Poseidon hashes of keys/balances (Circom uses Poseidon; on-chain hash helpers live in `poseidon_circom.rs` for tests only).

## Protocol asset lifecycle flow

The protocol uses a hybrid Converter/Standalone architecture on Stellar, bridging public asset transparency with cryptographic confidentiality.

### Deposit phase (public to shielded)

Users deposit public Stellar assets, such as Soroban USDC, into the `encrypted_token` protocol contract. In converter mode this would execute a native token transfer from the user to protocol escrow, leaving the total locked supply auditable on the public ledger. In parallel, `deposit.circom` proves that the public amount is correctly encrypted under the user's BabyJub public key and homomorphically added to their previous balance commitment. The contract then replaces the user's encrypted balance state with the new ciphertext/hash-backed state.

### Private transfer phase (confidential settlement)

The sender transfers a hidden value to a pre-registered receiver. On-chain, the token contract only updates encrypted balances and emits privacy-safe event metadata. No asset quantities or plaintext balances are exposed. Stellar nodes verify the Groth16 proof generated from `transfer.circom`, preventing overdrafts and malformed balance updates without learning the transferred amount.

### Mint phase (standalone enterprise injection)

An authorized administrator can provision encrypted token supply directly to a registered account without locking a public asset first. `mint.circom` proves that the minted value is encrypted under the recipient's authenticated key, allowing standalone enterprise demos where circulation remains private from public observers.

## Prerequisites

- Rust 1.84+ and `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) (`stellar contract optimize`)
- Node.js 20+
- `circom` 2.x and `snarkjs` (via `sdk/` npm install)
- Powers of Tau file at repo root: `powersOfTau28_hez_final_14.ptau`
- Funded Stellar **testnet** account

## Project layout

```
circuits/               Circom sources + build artifacts
contracts/
  groth16_verifier/     Standalone BN254 verifier
  encrypted_token/      Token + VK storage + register/mint/transfer
sdk/
  src/bn254.ts          snarkjs → Soroban BN254 serialization
  src/client.ts         Keygen, encrypt, proveRegister, tx helpers
  scripts/
    deploy-native-bn254.ts
    generate-register-proof.ts
    upload-vks.ts
frontend/               Shield B2B dashboard (Next.js mock UI)
scripts/build-circuits.sh
.env                    RPC, SECRET_KEY, contract IDs
```

## 1. Install SDK dependencies

```bash
cd sdk
npm install
```

## 2. Build circuits

Compile all circuits and run Groth16 setup (requires PTAU):

```bash
# from repo root (bash/WSL)
PHASE2=true PTAU=./powersOfTau28_hez_final_14.ptau ./scripts/build-circuits.sh
```

Outputs per circuit under `circuits/build/<name>/`:

- `<name>.wasm`, `<name>.zkey`, `verification_key.json`

Single circuit example:

```bash
CIRCUITS=register PHASE2=true PTAU=./powersOfTau28_hez_final_14.ptau ./scripts/build-circuits.sh
```

## 3. Build contracts

```bash
cargo build --target wasm32v1-none --release -p groth16_verifier -p encrypted_token

stellar contract optimize --wasm target/wasm32v1-none/release/groth16_verifier.wasm \
  --wasm-out target/wasm32v1-none/release/groth16_verifier.optimized.wasm

stellar contract optimize --wasm target/wasm32v1-none/release/encrypted_token.wasm \
  --wasm-out target/wasm32v1-none/release/encrypted_token.optimized.wasm
```

Run contract unit tests (includes Circom-compatible Poseidon checks):

```bash
cargo test -p encrypted_token
```

Generate TypeScript bindings from the optimized WASM:

```bash
make generate-bindings
```

Bindings are generated under `sdk/bindings/encrypted_token` and `sdk/bindings/groth16_verifier`.

## 4. Configure environment

Create `.env` at repo root:

```env
RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
SECRET_KEY=S...your testnet secret...
VK_BUILD_DIR=../circuits/build
TX_TIMEOUT_SECONDS=1800
```

After deploy, add:

```env
GROTH16_VERIFIER_CONTRACT_ID=C...
ENCRYPTED_TOKEN_CONTRACT_ID=C...
```

## 5. Deploy (testnet)

From `sdk/`:

```bash
# Windows TLS workaround if needed:
# $env:NODE_TLS_REJECT_UNAUTHORIZED='0'

npm run deploy:native-bn254
```

This script:

1. Builds and optimizes both contracts
2. Uploads WASM and deploys `groth16_verifier`, then `encrypted_token(admin, verifier)`
3. Uploads the **Register** VK to the token contract
4. Writes new contract IDs back to `.env`

## 6. Upload verification keys

Upload all circuit VKs to the token contract:

```bash
CONTRACT_ID=<ENCRYPTED_TOKEN_CONTRACT_ID> npm run upload:vks
```

If you hit sequence errors from rapid txs, wait a few seconds and re-run for the remaining ops.

## 7. Generate a register proof and register on-chain

```bash
npm run proof:register
```

Pipeline:

1. Generate BabyJub keypair (`sk` reduced mod `subOrder` for 251-bit circuit compatibility)
2. Compute `pk_hash = Poseidon(2)(pk.x, pk.y)`
3. Run `snarkjs.groth16.fullProve` with `register.wasm` / `register.zkey`
4. Local snarkjs verify
5. On-chain `groth16_verifier.verify` → expect `true`
6. On-chain `encrypted_token.register` with `user_pk`, proof, and public signals

Artifacts written to `circuits/build/register/proof.json` and `public.json`.

## BN254 encoding notes

snarkjs JSON stores Fq2 as `[c0, c1]`. Soroban native G2 expects **`c1 || c0`** per coordinate. The SDK handles this in `sdk/src/bn254.ts`.

Register circuit uses **1** public signal (`pk_hash`). Pass `expectedPublicSignals: 1` when calling `transformProofToSoroban`.

## Contract API (token)

| Function | Description |
|----------|-------------|
| `set_vk(op, vk)` | Admin: store VK for Register/Mint/Transfer/Deposit/Withdraw |
| `register(user, user_pk, proof, pub_signals)` | User registers with ZK proof of key ownership |
| `private_mint(to, new_balance, proof, pub_signals)` | Admin mints encrypted balance |
| `private_transfer(from, to, new_from, new_to, proof, pub_signals)` | Private transfer |
| `get_balance(user)` | Read encrypted ciphertext |
| `get_user_pk(user)` | Read JubJub public key |
| `is_registered(user)` | Registration flag |

## Contract events

`encrypted_token` emits privacy-safe Soroban contract events for indexers and frontends:

| Event | Topics | Data |
|-------|--------|------|
| `Registered` | `enc`, `register`, `user` | `user_pk` |
| `PrivateTransfer` | `enc`, `xfer`, `from`, `to` | `new_from_hash`, `new_to_hash` |
| `VkSet` | `enc`, `vk`, `op` | `{}` |
| `PrivateMint` | `enc`, `mint`, `to` | `{}` |

The transfer event intentionally omits amount and plaintext balances. It only exposes addresses and ciphertext hashes already required as public proof signals.

Fetch recent events:

```bash
make fetch-events
cd sdk && npm run events:fetch -- register
cd sdk && npm run events:fetch -- xfer
cd sdk && npm run events:fetch -- xfer <tx_hash>
```

The script also accepts explicit flags when invoked directly, for example `node --require ./scripts/bootstrap-env.cjs ./node_modules/tsx/dist/cli.mjs scripts/fetch-contract-events.ts --topic xfer --tx <tx_hash>`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| WASM > 64 KB | Use split contracts; keep token lean (no on-chain Poseidon in deploy WASM) |
| `Num2Bits` witness failure | Sample `sk` with `babyjub.subOrder`, not full `order` |
| `bn254 G2: point not on curve` | Re-upload VKs after fixing G2 byte order; verify with fresh proof |
| `Account not found` (RPC) | Fund account on testnet; deploy script falls back to Horizon |
| TLS errors on Windows | `$env:NODE_TLS_REJECT_UNAUTHORIZED='0'` for local dev only |
| `AlreadyRegistered` | Account already registered; use a different Stellar key or query state |

## 8. Private transfer (owner → TEST_RECEPTOR_ADDRESS)

Prerequisites:

- Owner `GBT7...` registered (`make check-register`)
- Receptor registered (`make check-receptor` → `true`)
- `circuits/build/register/state.json` with owner BabyJub `sk` (saved by `make proof-register`)
  - Or set `SENDER_BABYJUB_SK` in `.env`
- `TEST_RECEPTOR_ADDRESS` in `.env`
- Transfer VK uploaded (`make upload-vk-transfer`)

Register the receptor (requires their Stellar secret):

```bash
# add to .env: RECEPTOR_SECRET_KEY=S...
make proof-register-receptor
```

Run private transfer:

```bash
make proof-transfer
# or: TRANSFER_AMOUNT=10 TRANSFER_FROM_BALANCE=100 make proof-transfer
```

The script uploads the Transfer VK, generates a Groth16 proof, and calls `private_transfer`.

After redeploying contracts, re-run the full testnet loop because storage does not carry across contract IDs:

```bash
make upload-vks
make proof-register
make proof-register-receptor
make upload-vk-transfer
make proof-transfer
make fetch-events
```

## 9. Decrypt balance (display)

Fetch the on-chain Twisted ElGamal ciphertext via `get_balance`, then decrypt locally with the user's BabyJub secret key (`decrypt()` in `sdk/src/client.ts`).

```bash
make decrypt-receptor    # receptor should show 10 after a TRANSFER_AMOUNT=10 transfer
make decrypt-balance     # owner side (needs matching BabyJub sk in .env / state.json)
```

Secret key resolution order:

| Target | Env vars | Fallback file |
|--------|----------|---------------|
| owner | `BABYJUB_SK`, `SENDER_BABYJUB_SK` | `circuits/build/register/state.json` |
| receptor | `BABYJUB_SK`, `RECEPTOR_BABYJUB_SK` | `circuits/build/register/state-receptor.json` |

Only the account owner can decrypt their balance; the chain stores `(c1, c2)` points only.

**Important:** the BabyJub `sk` in your local state file must match the public key stored at registration (`get_user_pk`). If a register run failed after generating a new keypair, it may have overwritten `state-receptor.json` with a key that was never registered — decrypt will fail until you restore the original state file.

After a successful transfer, `circuits/build/transfer/transfer-state.json` records the expected plaintext balances for reference.

## 10. Shield dashboard (Freighter + Soroban)

The `frontend/` app connects to Freighter and the deployed `encrypted_token` contract on testnet.

Real features:

- Freighter connect / disconnect / network mismatch banner
- On-chain reads via Soroban simulation: `is_registered`, `get_balance`
- Live contract events via RPC `getEvents`
- Register flow: `/api/register` builds Groth16 proof + unsigned tx → Freighter sign → submit
- Transfer flow: `/api/transfer` builds proof + unsigned tx → Freighter sign → submit
- Local decrypt via `/api/decrypt` using BabyJub secret stored in browser `localStorage`

Setup:

```bash
cp frontend/.env.local.example frontend/.env.local
make install-frontend
make dev-frontend
```

Requirements:

- [Freighter](https://www.freighter.app/) on Testnet
- Funded testnet account in Freighter
- Built circuits at `circuits/build/` (for API proof generation)
- `ENCRYPTED_TOKEN_CONTRACT_ID` in `frontend/.env.local`

Production build uses webpack (required for SDK proof imports):

```bash
make build-frontend
```

## Makefile targets

```bash
make help                  # list all targets
make install-sdk
make circuits-phase2 PTAU=./powersOfTau28_hez_final_14.ptau
make build-contracts
make generate-bindings
make deploy
make upload-vk-transfer
make proof-register
make proof-register-receptor
make proof-transfer
make check-register
make check-receptor
make decrypt-balance
make decrypt-receptor
make fetch-events
make install-frontend
make dev-frontend
make build-frontend
```

## npm scripts

| Script | Command |
|--------|---------|
| `deploy:native-bn254` | Build, deploy contracts, upload Register VK |
| `proof:register` | Register proof + on-chain register |
| `proof:transfer` | Transfer proof + `private_transfer` |
| `check:register` / `check:receptor` | Query `is_registered` |
| `decrypt:balance` / `decrypt:receptor` | Fetch + decrypt encrypted balance |
| `events:fetch` | Fetch recent Soroban contract events |
| `upload:vks` | Upload all VKs to `CONTRACT_ID` |

## Status

- Register: end-to-end on testnet **working**
- Transfer: end-to-end on testnet **working**
- Decrypt: local display via `make decrypt-receptor` / `make decrypt-balance`
- Events: `Registered` / `VkSet` verified via `make fetch-events`; `PrivateTransfer` emits on successful transfers
- Frontend: Shield dashboard with Freighter + Soroban via `make dev-frontend`
- Mint / deposit / withdraw: circuits present; scripts TODO
