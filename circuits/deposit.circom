pragma circom 2.1.9;

/*
  deposit.circom  (converter mode)
  ══════════════════════════════════
  User deposits a PUBLIC amount of SAC tokens and receives an encrypted balance.
  The amount is visible on-chain (necessary to track total locked supply).

  PRIVATE inputs:
    r         — fresh randomness for the new ciphertext
    old_c1_x, old_c1_y, old_c2_x, old_c2_y  — current encrypted balance
    pk_x, pk_y   — user's Jubjub public key

  PUBLIC inputs / outputs:
    amount           — deposit amount (visible on-chain)
    old_balance_hash — hash of old encrypted balance (must match on-chain)
    new_balance_hash — hash of new encrypted balance (committed to)

  CONSTRAINTS:
    1. amount >= 1
    2. C_new = C_old + Enc(amount, r, PK)
    3. Hashes match
*/

include "jubjub.circom";
include "jubjub_elgamal.circom";
include "range.circom";
include "sha256_truncated.circom";

template Deposit(MAX_BITS) {
    // ── Private inputs ──────────────────────────────────────
    signal input r;
    signal input old_c1_x;
    signal input old_c1_y;
    signal input old_c2_x;
    signal input old_c2_y;
    signal input pk_x;
    signal input pk_y;

    // ── Public inputs ───────────────────────────────────────
    signal input amount;          // visible on-chain

    // ── Public inputs ───────────────────────────────────────
    signal input old_balance_hash;
    signal input new_balance_hash;

    // ── 1. amount >= 1 ──────────────────────────────────────
    component amount_positive = GreaterEqThan(MAX_BITS);
    amount_positive.in[0] <== amount;
    amount_positive.in[1] <== 1;
    amount_positive.out === 1;

    // ── 2. Encrypt deposit amount ───────────────────────────
    component enc = JubJubEncrypt();
    enc.v    <== amount;
    enc.r    <== r;
    enc.pk_x <== pk_x;
    enc.pk_y <== pk_y;

    // ── 3. Add to old balance ───────────────────────────────
    component new_bal = JubJubAddCiphertext();
    new_bal.c1_x_a <== old_c1_x;
    new_bal.c1_y_a <== old_c1_y;
    new_bal.c2_x_a <== old_c2_x;
    new_bal.c2_y_a <== old_c2_y;
    new_bal.c1_x_b <== enc.c1_x;
    new_bal.c1_y_b <== enc.c1_y;
    new_bal.c2_x_b <== enc.c2_x;
    new_bal.c2_y_b <== enc.c2_y;

    // ── 4. Hashes ───────────────────────────────────────────
    component h_old = SHA256CiphertextHash();
    h_old.c1_x <== old_c1_x;
    h_old.c1_y <== old_c1_y;
    h_old.c2_x <== old_c2_x;
    h_old.c2_y <== old_c2_y;
    old_balance_hash === h_old.out;

    component h_new = SHA256CiphertextHash();
    h_new.c1_x <== new_bal.c1_x_out;
    h_new.c1_y <== new_bal.c1_y_out;
    h_new.c2_x <== new_bal.c2_x_out;
    h_new.c2_y <== new_bal.c2_y_out;
    new_balance_hash === h_new.out;
}

component main { public [amount, old_balance_hash, new_balance_hash] } = Deposit(64);
