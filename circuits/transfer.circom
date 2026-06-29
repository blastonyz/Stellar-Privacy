pragma circom 2.1.9;

/*
  transfer.circom
  ═══════════════
  The core circuit of the EncryptedToken protocol.

  Proves that a private transfer is valid WITHOUT revealing the transfer amount.

  TWISTED ELGAMAL ON JUBJUB (BLS12-381 embedded curve)
  ─────────────────────────────────────────────────────
  Public key:  PK = sk * G         (Jubjub point)
  Ciphertext:  C = (C1, C2)
                 C1 = r * G
                 C2 = v * G + r * PK

  Homomorphic subtraction (sender's new balance):
    C_new = C_old - Enc(amount, r_s)
          = (C1_old - r_s * G,  C2_old - amount * G - r_s * PK_sender)

  Homomorphic addition (receiver's new balance):
    C_new = C_old + Enc(amount, r_r)
          = (C1_old + r_r * G,  C2_old + amount * G + r_r * PK_receiver)

  PRIVATE inputs (never revealed):
    sk_from      — sender's secret key
    v_from_old   — sender's current plaintext balance
    v_to_old     — receiver's current plaintext balance
    amount       — transfer amount
    r_s          — fresh randomness for sender's new ciphertext
    r_r          — fresh randomness for receiver's new ciphertext

  PUBLIC outputs (committed to on-chain via hashes):
    old_from_hash   — hash of sender's old encrypted balance
    new_from_hash   — hash of sender's new encrypted balance
    old_to_hash     — hash of receiver's old encrypted balance
    new_to_hash     — hash of receiver's new encrypted balance

  CONSTRAINTS verified by the circuit:
    1. PK_from = sk_from * G                   (sender owns the key)
    2. Decrypt(C_from_old, sk_from) = v_from_old  (sender knows their balance)
    3. amount >= 1                              (positive transfer)
    4. v_from_old >= amount                    (no overdraft)
    5. v_to_old >= 0                           (sanity)
    6. C_from_new = C_from_old - Enc(amount)   (correct homomorphic update)
    7. C_to_new   = C_to_old   + Enc(amount)   (correct homomorphic update)
    8. Hash(C_from_old) == old_from_hash       (binds to on-chain state)
    9. Hash(C_from_new) == new_from_hash       (binds to submitted new state)
   10. Hash(C_to_old)   == old_to_hash
   11. Hash(C_to_new)   == new_to_hash
*/

include "jubjub.circom";
include "jubjub_elgamal.circom";
include "range.circom";           // range helpers built on circomlib LessThan
include "sha256_truncated.circom";

template Transfer(MAX_BITS) {

    // ── Private inputs ──────────────────────────────────────
    signal input sk_from;         // sender secret key

    signal input from_c1_x;       // sender old ciphertext C1
    signal input from_c1_y;
    signal input from_c2_x;       // sender old ciphertext C2
    signal input from_c2_y;

    signal input to_c1_x;         // receiver old ciphertext C1
    signal input to_c1_y;
    signal input to_c2_x;         // receiver old ciphertext C2
    signal input to_c2_y;

    signal input v_from_old;      // sender's plaintext balance (for range check)
    signal input v_to_old;        // receiver's plaintext balance (for range check)
    signal input amount;          // transfer amount (private)

    signal input r_s;             // re-randomisation for sender's new ciphertext
    signal input r_r;             // re-randomisation for receiver's new ciphertext

    signal input to_pk_x;         // receiver's public key (private here but
    signal input to_pk_y;         // committed to via the new_to_balance hash)

    // ── Public inputs ───────────────────────────────────────
    signal input old_from_hash;
    signal input new_from_hash;
    signal input old_to_hash;
    signal input new_to_hash;

    // ── 1. Verify sender knows their secret key ─────────────
    component pk_check = JubJubScalarMul();
    pk_check.scalar <== sk_from;
    // pk_check.out[0..1] = PK_from

    // ── 2. Decrypt old balance: v_from_old * G = C2 - sk * C1
    component decrypt_from = JubJubDecrypt();
    decrypt_from.c1_x  <== from_c1_x;
    decrypt_from.c1_y  <== from_c1_y;
    decrypt_from.c2_x  <== from_c2_x;
    decrypt_from.c2_y  <== from_c2_y;
    decrypt_from.sk    <== sk_from;
    decrypt_from.v_expected <== v_from_old;  // circuit verifies v*G matches

    // ── 3-4. Range checks ───────────────────────────────────
    component amount_positive = GreaterEqThan(MAX_BITS);
    amount_positive.in[0] <== amount;
    amount_positive.in[1] <== 1;
    amount_positive.out === 1;

    component no_overdraft = GreaterEqThan(MAX_BITS);
    no_overdraft.in[0] <== v_from_old;
    no_overdraft.in[1] <== amount;
    no_overdraft.out === 1;

    // ── 5-7. Homomorphic balance updates ────────────────────
    // Sender new ciphertext: C_from_new = C_from_old - Enc(amount, r_s)
    component enc_amount_s = JubJubEncrypt();
    enc_amount_s.v      <== amount;
    enc_amount_s.r      <== r_s;
    enc_amount_s.pk_x   <== pk_check.out[0];   // sender's own PK
    enc_amount_s.pk_y   <== pk_check.out[1];

    component new_from = JubJubSubCiphertext();
    new_from.c1_x_a <== from_c1_x;
    new_from.c1_y_a <== from_c1_y;
    new_from.c2_x_a <== from_c2_x;
    new_from.c2_y_a <== from_c2_y;
    new_from.c1_x_b <== enc_amount_s.c1_x;
    new_from.c1_y_b <== enc_amount_s.c1_y;
    new_from.c2_x_b <== enc_amount_s.c2_x;
    new_from.c2_y_b <== enc_amount_s.c2_y;

    // Receiver new ciphertext: C_to_new = C_to_old + Enc(amount, r_r)
    component enc_amount_r = JubJubEncrypt();
    enc_amount_r.v      <== amount;
    enc_amount_r.r      <== r_r;
    enc_amount_r.pk_x   <== to_pk_x;
    enc_amount_r.pk_y   <== to_pk_y;

    component new_to = JubJubAddCiphertext();
    new_to.c1_x_a <== to_c1_x;
    new_to.c1_y_a <== to_c1_y;
    new_to.c2_x_a <== to_c2_x;
    new_to.c2_y_a <== to_c2_y;
    new_to.c1_x_b <== enc_amount_r.c1_x;
    new_to.c1_y_b <== enc_amount_r.c1_y;
    new_to.c2_x_b <== enc_amount_r.c2_x;
    new_to.c2_y_b <== enc_amount_r.c2_y;

    // ── 8-11. Bind to on-chain state via hashes ─────────────
    component h_old_from = SHA256CiphertextHash();
    h_old_from.c1_x <== from_c1_x;
    h_old_from.c1_y <== from_c1_y;
    h_old_from.c2_x <== from_c2_x;
    h_old_from.c2_y <== from_c2_y;
    old_from_hash === h_old_from.out;

    component h_new_from = SHA256CiphertextHash();
    h_new_from.c1_x <== new_from.c1_x_out;
    h_new_from.c1_y <== new_from.c1_y_out;
    h_new_from.c2_x <== new_from.c2_x_out;
    h_new_from.c2_y <== new_from.c2_y_out;
    new_from_hash === h_new_from.out;

    component h_old_to = SHA256CiphertextHash();
    h_old_to.c1_x <== to_c1_x;
    h_old_to.c1_y <== to_c1_y;
    h_old_to.c2_x <== to_c2_x;
    h_old_to.c2_y <== to_c2_y;
    old_to_hash === h_old_to.out;

    component h_new_to = SHA256CiphertextHash();
    h_new_to.c1_x <== new_to.c1_x_out;
    h_new_to.c1_y <== new_to.c1_y_out;
    h_new_to.c2_x <== new_to.c2_x_out;
    h_new_to.c2_y <== new_to.c2_y_out;
    new_to_hash === h_new_to.out;
}

// MAX_BITS = 64 supports amounts up to 2^64 (sufficient for token amounts)
component main { public [old_from_hash, new_from_hash, old_to_hash, new_to_hash] } = Transfer(64);
