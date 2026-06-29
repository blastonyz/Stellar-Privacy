pragma circom 2.1.9;

include "babyjub.circom";
include "escalarmulany.circom";

template JubJubScalarMul() {
    signal input scalar;
    signal output out[2];

    component mul = BabyPbk();
    mul.in <== scalar;

    out[0] <== mul.Ax;
    out[1] <== mul.Ay;
}

template JubJubScalarMulPoint() {
    signal input scalar;
    signal input point[2];
    signal output out[2];

    component check = BabyCheck();
    check.x <== point[0];
    check.y <== point[1];

    component scalarBits = Num2Bits(253);
    scalarBits.in <== scalar;

    component mul = EscalarMulAny(253);
    mul.p[0] <== point[0];
    mul.p[1] <== point[1];

    for (var i = 0; i < 253; i++) {
        mul.e[i] <== scalarBits.out[i];
    }

    out[0] <== mul.out[0];
    out[1] <== mul.out[1];
}
