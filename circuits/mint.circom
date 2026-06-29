pragma circom 2.1.9;

/*
  mint.circom
  ═══════════
  Admin mints encrypted tokens to a registered user (standalone mode).

  PRIVATE inputs:
    amount      — plaintext mint amount
    v_old       — recipient's current plaintext balance
    r           — fresh randomness for the new ciphertext

  PUBLIC outputs:
    old_balance_hash — hash of recipient's current encrypted balance
    new_balance_hash — hash of recipient's new encrypted balance (old + amount)
    to_pk_hash       — hash of recipient's public key

  CONSTRAINTS:
    1. amount >= 1
    2. C_new = C_old + Enc(amount, r, PK_to)  (homomorphic addition)
    3. All hashes match the computed ciphertexts
*/

include "jubjub.circom";
include "jubjub_elgamal.circom";
include "range.circom";
include "sha256_truncated.circom";

template Mint(MAX_BITS) {
    // ── Private inputs ──────────────────────────────────────
    signal input amount;
    signal input r;
    signal input old_c1_x;
    signal input old_c1_y;
    signal input old_c2_x;
    signal input old_c2_y;
    signal input to_pk_x;
    signal input to_pk_y;

    // ── Public inputs ───────────────────────────────────────
    signal input old_balance_hash;
    signal input new_balance_hash;
    signal input to_pk_hash;

    // ── 1. amount >= 1 ──────────────────────────────────────
    component amount_positive = GreaterEqThan(MAX_BITS);
    amount_positive.in[0] <== amount;
    amount_positive.in[1] <== 1;
    amount_positive.out === 1;

    // ── 2. Encrypt amount under recipient's key ─────────────
    component enc = JubJubEncrypt();
    enc.v    <== amount;
    enc.r    <== r;
    enc.pk_x <== to_pk_x;
    enc.pk_y <== to_pk_y;

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

    // ── 4. Hash outputs ─────────────────────────────────────
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

    component h_pk = SHA256G1Hash();
    h_pk.x <== to_pk_x;
    h_pk.y <== to_pk_y;
    to_pk_hash === h_pk.out;
}

component main { public [old_balance_hash, new_balance_hash, to_pk_hash] } = Mint(64);
