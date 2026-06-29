pragma circom 2.1.9;

include "poseidon.circom";

// Adapter module for the Stellar prototype circuits.
// TODO: replace these Poseidon field commitments with byte-accurate SHA-256
// truncation before producing proofs expected by the Soroban contract.
template SHA256Truncated31(N_BITS) {
    signal input in[N_BITS];
    signal output out;

    component packed = Bits2Field(N_BITS);
    for (var i = 0; i < N_BITS; i++) {
        packed.in[i] <== in[i];
    }

    out <== packed.out;
}

template SHA256G1Hash() {
    signal input x;
    signal input y;
    signal output out;

    component hash = Poseidon(2);
    hash.inputs[0] <== x;
    hash.inputs[1] <== y;

    out <== hash.out;
}

template SHA256CiphertextHash() {
    signal input c1_x;
    signal input c1_y;
    signal input c2_x;
    signal input c2_y;
    signal output out;

    component hash = Poseidon(4);
    hash.inputs[0] <== c1_x;
    hash.inputs[1] <== c1_y;
    hash.inputs[2] <== c2_x;
    hash.inputs[3] <== c2_y;

    out <== hash.out;
}

template Bits2Field(N_BITS) {
    signal input in[N_BITS];
    signal output out;

    var acc = 0;
    var coeff = 1;
    for (var i = 0; i < N_BITS; i++) {
        in[i] * (in[i] - 1) === 0;
        acc += in[i] * coeff;
        coeff = coeff + coeff;
    }

    out <== acc;
}
