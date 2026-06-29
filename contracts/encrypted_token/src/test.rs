#![cfg(test)]
extern crate std;

use soroban_sdk::Env;

use crate::poseidon_circom;

#[test]
fn crypto_hazmat_poseidon2_matches_circomlib() {
    let env = Env::default();
    let (inputs, expected) = poseidon_circom::test_vector2(&env);

    let actual = poseidon_circom::poseidon2(
        &env,
        &inputs[0],
        &inputs[1],
    );

    assert_eq!(actual, expected);
}

#[test]
fn crypto_hazmat_poseidon4_matches_circomlib() {
    let env = Env::default();
    let (inputs, expected) = poseidon_circom::test_vector4(&env);

    let actual = poseidon_circom::poseidon4(
        &env,
        &inputs[0],
        &inputs[1],
        &inputs[2],
        &inputs[3],
    );

    assert_eq!(actual, expected);
}
