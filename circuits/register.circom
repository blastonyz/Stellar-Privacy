pragma circom 2.1.9;

/*
  register.circom
  ═══════════════
  Proves knowledge of a secret key corresponding to a BLS12-381 G1 public key.

  This is a Schnorr Proof-of-Knowledge (PoK) simplified to a ZK statement:

    PRIVATE:  sk  (scalar, 253-bit field element)
    PUBLIC:   pk_hash  (SHA-256(compress(sk * G))[0..31], packed into Fr)

  The circuit proves:
    1. PK = sk * G  (on the embedded Jubjub curve inside BLS12-381's scalar field)
    2. pk_hash = truncated_sha256(PK)

  NOTE: Full BLS12-381 G1 scalar multiplication is too expensive to do
  inside a circuit. Instead we use the Jubjub curve, whose base field equals
  BLS12-381's scalar field (Fr), making in-circuit arithmetic efficient.

  Jubjub parameters (BLS12-381 embedded curve):
    a = -1
    d = -(10240/10241) mod r
    Generator Gx = 0x11dafe5d23e1218086a365b99fbf3d3be72f6afd7d1f72623e6b071492d1122b57a77997d815b671452d9d290406d5e55
    Generator Gy = 0x1d523cf1ddab1a1793132e78c866c0c33e26ba5cc220fed7cc3f870e59d292aa7d29f42e950c8f52e20bd1f8cbfbb5af
*/

include "jubjub.circom";     // Jubjub curve operations (import from circomlib-bls12381)
include "sha256_truncated.circom";  // SHA-256 truncated to 31 bytes

template Register() {
    // ── Private inputs ──────────────────────────────────────
    signal input sk;            // secret key scalar

    // ── Public inputs ───────────────────────────────────────
    signal input pk_hash;       // truncated SHA-256 of the compressed public key

    // ── Compute PK = sk * G (Jubjub scalar multiplication) ──
    component pk_mul = JubJubScalarMul();
    pk_mul.scalar <== sk;
    // pk_mul.out[0] = pk_x
    // pk_mul.out[1] = pk_y

    // ── Hash the public key ─────────────────────────────────
    component hasher = SHA256G1Hash();
    hasher.x <== pk_mul.out[0];
    hasher.y <== pk_mul.out[1];
    pk_hash === hasher.out;
}

component main { public [pk_hash] } = Register();
