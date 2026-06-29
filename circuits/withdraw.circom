pragma circom 2.1.9;

/*
  withdraw.circom  (converter mode)
  ══════════════════════════════════
  User withdraws a PUBLIC amount by spending encrypted balance.

  PRIVATE inputs:
    sk        — user's secret key
    v_old     — current plaintext balance (to prove no overdraft)
    r         — fresh randomness for the new ciphertext
    old_c1_x, old_c1_y, old_c2_x, old_c2_y — current encrypted balance

  PUBLIC inputs / outputs:
    amount           — withdrawal amount (visible on-chain)
    old_balance_hash — hash of old encrypted balance (must match on-chain)
    new_balance_hash — hash of new encrypted balance (after deduction)

  CONSTRAINTS:
    1. Decrypt(C_old, sk) = v_old              (user knows their balance)
    2. v_old >= amount >= 1                    (sufficient funds, positive amount)
    3. C_new = C_old - Enc(amount, r, PK)      (correct deduction)
    4. Hashes match
*/

include "jubjub.circom";
include "jubjub_elgamal.circom";
include "range.circom";
include "sha256_truncated.circom";

template Withdraw(MAX_BITS) {
    // ── Private inputs ──────────────────────────────────────
    signal input sk;
    signal input v_old;
    signal input r;
    signal input old_c1_x;
    signal input old_c1_y;
    signal input old_c2_x;
    signal input old_c2_y;

    // ── Public inputs ───────────────────────────────────────
    signal input amount;          // visible on-chain

    // ── Public inputs ───────────────────────────────────────
    signal input old_balance_hash;
    signal input new_balance_hash;

    // ── 1. Derive PK from sk ────────────────────────────────
    component pk_mul = JubJubScalarMul();
    pk_mul.scalar <== sk;

    // ── 2. Verify decryption ────────────────────────────────
    component decrypt = JubJubDecrypt();
    decrypt.c1_x       <== old_c1_x;
    decrypt.c1_y       <== old_c1_y;
    decrypt.c2_x       <== old_c2_x;
    decrypt.c2_y       <== old_c2_y;
    decrypt.sk         <== sk;
    decrypt.v_expected <== v_old;

    // ── 3. Range checks ─────────────────────────────────────
    component amount_positive = GreaterEqThan(MAX_BITS);
    amount_positive.in[0] <== amount;
    amount_positive.in[1] <== 1;
    amount_positive.out === 1;

    component sufficient = GreaterEqThan(MAX_BITS);
    sufficient.in[0] <== v_old;
    sufficient.in[1] <== amount;
    sufficient.out === 1;

    // ── 4. Encrypt deducted amount ──────────────────────────
    component enc = JubJubEncrypt();
    enc.v    <== amount;
    enc.r    <== r;
    enc.pk_x <== pk_mul.out[0];
    enc.pk_y <== pk_mul.out[1];

    // ── 5. Subtract from old balance ────────────────────────
    component new_bal = JubJubSubCiphertext();
    new_bal.c1_x_a <== old_c1_x;
    new_bal.c1_y_a <== old_c1_y;
    new_bal.c2_x_a <== old_c2_x;
    new_bal.c2_y_a <== old_c2_y;
    new_bal.c1_x_b <== enc.c1_x;
    new_bal.c1_y_b <== enc.c1_y;
    new_bal.c2_x_b <== enc.c2_x;
    new_bal.c2_y_b <== enc.c2_y;

    // ── 6. Hashes ───────────────────────────────────────────
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

component main { public [amount, old_balance_hash, new_balance_hash] } = Withdraw(64);
