pragma circom 2.1.9;

include "jubjub.circom";

template JubJubEncrypt() {
    signal input v;
    signal input r;
    signal input pk_x;
    signal input pk_y;
    signal output c1_x;
    signal output c1_y;
    signal output c2_x;
    signal output c2_y;

    component valuePoint = JubJubScalarMul();
    valuePoint.scalar <== v;

    component randomPoint = JubJubScalarMul();
    randomPoint.scalar <== r;

    component randomPk = JubJubScalarMulPoint();
    randomPk.scalar <== r;
    randomPk.point[0] <== pk_x;
    randomPk.point[1] <== pk_y;

    component c2 = BabyAdd();
    c2.x1 <== valuePoint.out[0];
    c2.y1 <== valuePoint.out[1];
    c2.x2 <== randomPk.out[0];
    c2.y2 <== randomPk.out[1];

    c1_x <== randomPoint.out[0];
    c1_y <== randomPoint.out[1];
    c2_x <== c2.xout;
    c2_y <== c2.yout;
}

template JubJubDecrypt() {
    signal input c1_x;
    signal input c1_y;
    signal input c2_x;
    signal input c2_y;
    signal input sk;
    signal input v_expected;

    component skC1 = JubJubScalarMulPoint();
    skC1.scalar <== sk;
    skC1.point[0] <== c1_x;
    skC1.point[1] <== c1_y;

    component recovered = BabyAdd();
    recovered.x1 <== c2_x;
    recovered.y1 <== c2_y;
    recovered.x2 <== 0 - skC1.out[0];
    recovered.y2 <== skC1.out[1];

    component expected = JubJubScalarMul();
    expected.scalar <== v_expected;

    recovered.xout === expected.out[0];
    recovered.yout === expected.out[1];
}

template JubJubAddCiphertext() {
    signal input c1_x_a;
    signal input c1_y_a;
    signal input c2_x_a;
    signal input c2_y_a;
    signal input c1_x_b;
    signal input c1_y_b;
    signal input c2_x_b;
    signal input c2_y_b;
    signal output c1_x_out;
    signal output c1_y_out;
    signal output c2_x_out;
    signal output c2_y_out;

    component c1 = BabyAdd();
    c1.x1 <== c1_x_a;
    c1.y1 <== c1_y_a;
    c1.x2 <== c1_x_b;
    c1.y2 <== c1_y_b;

    component c2 = BabyAdd();
    c2.x1 <== c2_x_a;
    c2.y1 <== c2_y_a;
    c2.x2 <== c2_x_b;
    c2.y2 <== c2_y_b;

    c1_x_out <== c1.xout;
    c1_y_out <== c1.yout;
    c2_x_out <== c2.xout;
    c2_y_out <== c2.yout;
}

template JubJubSubCiphertext() {
    signal input c1_x_a;
    signal input c1_y_a;
    signal input c2_x_a;
    signal input c2_y_a;
    signal input c1_x_b;
    signal input c1_y_b;
    signal input c2_x_b;
    signal input c2_y_b;
    signal output c1_x_out;
    signal output c1_y_out;
    signal output c2_x_out;
    signal output c2_y_out;

    component c1 = BabyAdd();
    c1.x1 <== c1_x_a;
    c1.y1 <== c1_y_a;
    c1.x2 <== 0 - c1_x_b;
    c1.y2 <== c1_y_b;

    component c2 = BabyAdd();
    c2.x1 <== c2_x_a;
    c2.y1 <== c2_y_a;
    c2.x2 <== 0 - c2_x_b;
    c2.y2 <== c2_y_b;

    c1_x_out <== c1.xout;
    c1_y_out <== c1.yout;
    c2_x_out <== c2.xout;
    c2_y_out <== c2.yout;
}
