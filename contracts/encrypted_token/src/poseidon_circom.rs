use soroban_poseidon::poseidon_hash;
use soroban_sdk::{crypto::BnScalar, Bytes, BytesN, Env, U256, Vec};

fn u256_from_field(env: &Env, field: &BytesN<32>) -> U256 {
    U256::from_be_bytes(env, &Bytes::from_array(env, &field.to_array()))
}

fn field_from_u256(env: &Env, value: U256) -> BytesN<32> {
    let bytes = value.to_be_bytes();
    let mut out = [0u8; 32];
    let mut i = 0u32;
    while i < 32 {
        out[i as usize] = bytes.get_unchecked(i);
        i += 1;
    }
    BytesN::from_array(env, &out)
}

#[cfg(test)]
fn field_from_hex(env: &Env, hex: &str) -> BytesN<32> {
    BytesN::from_array(env, &hex_to_array(hex))
}

#[cfg(test)]
fn hex_to_array(hex: &str) -> [u8; 32] {
    let bytes = hex.as_bytes();
    let offset = if bytes.len() >= 2 && bytes[0] == b'0' && (bytes[1] == b'x' || bytes[1] == b'X') {
        2
    } else {
        0
    };
    let mut out = [0u8; 32];
    let mut out_i = 0usize;
    let mut i = offset;
    while i + 1 < bytes.len() && out_i < 32 {
        out[out_i] = (hex_nibble(bytes[i]) << 4) | hex_nibble(bytes[i + 1]);
        out_i += 1;
        i += 2;
    }
    out
}

#[cfg(test)]
fn hex_nibble(b: u8) -> u8 {
    match b {
        b'0'..=b'9' => b - b'0',
        b'a'..=b'f' => b - b'a' + 10,
        b'A'..=b'F' => b - b'A' + 10,
        _ => panic!("invalid hex constant"),
    }
}

pub(crate) fn poseidon2(env: &Env, a: &BytesN<32>, b: &BytesN<32>) -> BytesN<32> {
    let mut input = Vec::new(env);
    input.push_back(u256_from_field(env, a));
    input.push_back(u256_from_field(env, b));
    field_from_u256(env, poseidon_hash::<3, BnScalar>(env, &input))
}

pub(crate) fn poseidon4(
    env: &Env,
    a: &BytesN<32>,
    b: &BytesN<32>,
    c: &BytesN<32>,
    d: &BytesN<32>,
) -> BytesN<32> {
    let mut input = Vec::new(env);
    input.push_back(u256_from_field(env, a));
    input.push_back(u256_from_field(env, b));
    input.push_back(u256_from_field(env, c));
    input.push_back(u256_from_field(env, d));
    field_from_u256(env, poseidon_hash::<5, BnScalar>(env, &input))
}

#[cfg(test)]
pub(crate) fn test_vector2(env: &Env) -> ([BytesN<32>; 2], BytesN<32>) {
    (
        [
            field_from_hex(env, "0x0000000000000000000000000000000000000000000000000000000000000001"),
            field_from_hex(env, "0x0000000000000000000000000000000000000000000000000000000000000002"),
        ],
        field_from_hex(env, "0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a"),
    )
}

#[cfg(test)]
pub(crate) fn test_vector4(env: &Env) -> ([BytesN<32>; 4], BytesN<32>) {
    (
        [
            field_from_hex(env, "0x0000000000000000000000000000000000000000000000000000000000000001"),
            field_from_hex(env, "0x0000000000000000000000000000000000000000000000000000000000000002"),
            field_from_hex(env, "0x0000000000000000000000000000000000000000000000000000000000000003"),
            field_from_hex(env, "0x0000000000000000000000000000000000000000000000000000000000000004"),
        ],
        field_from_hex(env, "0x299c867db6c1fdd79dcefa40e4510b9837e60ebb1ce0663dbaa525df65250465"),
    )
}
