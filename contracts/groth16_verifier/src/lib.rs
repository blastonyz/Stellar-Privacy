#![no_std]
// BN254 Groth16 verifier contract compatible with Circom/snarkjs artifacts.
use soroban_sdk::{
    contract, contractimpl, contracttype,
    crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr},
    BytesN, Env, Vec,
};

pub type FieldBytes = BytesN<32>;

#[derive(Clone)]
#[contracttype]
pub struct BN254G1 {
    pub x: FieldBytes,
    pub y: FieldBytes,
}

#[derive(Clone)]
#[contracttype]
pub struct BN254Fq2 {
    pub c0: FieldBytes,
    pub c1: FieldBytes,
}

#[derive(Clone)]
#[contracttype]
pub struct BN254G2 {
    pub x: BN254Fq2,
    pub y: BN254Fq2,
}

#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: BN254G1,
    pub beta: BN254G2,
    pub gamma: BN254G2,
    pub delta: BN254G2,
    pub ic: Vec<BN254G1>,
}

#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: BN254G1,
    pub b: BN254G2,
    pub c: BN254G1,
}

#[contract]
pub struct Groth16Verifier;

#[contractimpl]
impl Groth16Verifier {
    // Verify a Groth16 proof.
    pub fn verify(
        env: Env,
        vk: VerificationKey,
        proof: Proof,
        pub_signals: Vec<FieldBytes>,
    ) -> bool {
        if pub_signals.len() + 1 != vk.ic.len() {
            return false;
        }

        let bn254 = env.crypto().bn254();
        let mut vk_x = Self::to_native_g1(&env, &vk.ic.get(0).unwrap());

        let mut i = 0u32;
        while i < pub_signals.len() {
            let ic = Self::to_native_g1(&env, &vk.ic.get(i + 1).unwrap());
            let input = Fr::from_bytes(pub_signals.get(i).unwrap());
            let term = bn254.g1_mul(&ic, &input);
            vk_x = bn254.g1_add(&vk_x, &term);
            i += 1;
        }

        let mut g1_points = Vec::new(&env);
        g1_points.push_back(Self::to_native_g1(&env, &proof.a));
        g1_points.push_back(-Self::to_native_g1(&env, &vk.alpha));
        g1_points.push_back(-vk_x);
        g1_points.push_back(-Self::to_native_g1(&env, &proof.c));

        let mut g2_points = Vec::new(&env);
        g2_points.push_back(Self::to_native_g2(&env, &proof.b));
        g2_points.push_back(Self::to_native_g2(&env, &vk.beta));
        g2_points.push_back(Self::to_native_g2(&env, &vk.gamma));
        g2_points.push_back(Self::to_native_g2(&env, &vk.delta));

        bn254.pairing_check(g1_points, g2_points)
    }

    fn to_native_g1(env: &Env, point: &BN254G1) -> Bn254G1Affine {
        let mut bytes = [0u8; 64];
        bytes[0..32].copy_from_slice(&point.x.to_array());
        bytes[32..64].copy_from_slice(&point.y.to_array());
        Bn254G1Affine::from_bytes(BytesN::from_array(env, &bytes))
    }

    fn to_native_g2(env: &Env, point: &BN254G2) -> Bn254G2Affine {
        let mut bytes = [0u8; 128];

        // Soroban's BN254 G2 encoding uses c1 || c0 for each Fp2 coordinate.
        bytes[0..32].copy_from_slice(&point.x.c1.to_array());
        bytes[32..64].copy_from_slice(&point.x.c0.to_array());
        bytes[64..96].copy_from_slice(&point.y.c1.to_array());
        bytes[96..128].copy_from_slice(&point.y.c0.to_array());

        Bn254G2Affine::from_bytes(BytesN::from_array(env, &bytes))
    }
}
