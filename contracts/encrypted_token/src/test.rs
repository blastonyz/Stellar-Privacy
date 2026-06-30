#![cfg(test)]
extern crate std;

use soroban_sdk::{
    contract,
    contractimpl,
    symbol_short,
    testutils::Address as _,
    vec,
    Address,
    BytesN,
    Env,
    IntoVal,
    Map,
    Symbol,
    TryFromVal,
    Val,
    xdr,
};

use crate::{events, poseidon_circom, JubJubPoint};

#[contract]
struct EventHarness;

#[contractimpl]
impl EventHarness {
    pub fn registered(env: Env, user: Address, user_pk: JubJubPoint) {
        events::emit_registered(&env, user, user_pk);
    }

    pub fn private_transfer(
        env: Env,
        from: Address,
        to: Address,
        new_from_hash: BytesN<32>,
        new_to_hash: BytesN<32>,
    ) {
        events::emit_private_transfer(&env, from, to, new_from_hash, new_to_hash);
    }
}

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

#[test]
fn registered_event_contains_user_topic() {
    let env = Env::default();
    let user = Address::generate(&env);
    let zero = BytesN::from_array(&env, &[0u8; 32]);
    let user_pk = JubJubPoint {
        x: zero.clone(),
        y: zero,
    };
    let contract_id = env.register(EventHarness, ());
    let client = EventHarnessClient::new(&env, &contract_id);

    client.registered(&user, &user_pk);

    let all = soroban_sdk::testutils::Events::all(&env.events()).filter_by_contract(&contract_id);
    assert_eq!(all.events().len(), 1);

    let event = &all.events()[0];
    let xdr::ContractEventBody::V0(body) = &event.body;
    assert_eq!(
        body.topics,
        vec![
            &env,
            to_sc_val(&env, symbol_short!("enc")),
            to_sc_val(&env, symbol_short!("register")),
            to_sc_val(&env, user),
        ].into(),
    );
    let mut expected_data: Map<Symbol, Val> = Map::new(&env);
    expected_data.set(Symbol::new(&env, "user_pk"), user_pk.into_val(&env));
    assert_eq!(body.data, to_sc_val(&env, expected_data));
}

#[test]
fn private_transfer_event_contains_participants_and_hashes() {
    let env = Env::default();
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let new_from_hash = BytesN::from_array(&env, &[1u8; 32]);
    let new_to_hash = BytesN::from_array(&env, &[2u8; 32]);
    let contract_id = env.register(EventHarness, ());
    let client = EventHarnessClient::new(&env, &contract_id);

    client.private_transfer(&from, &to, &new_from_hash, &new_to_hash);

    let all = soroban_sdk::testutils::Events::all(&env.events()).filter_by_contract(&contract_id);
    assert_eq!(all.events().len(), 1);

    let event = &all.events()[0];
    let xdr::ContractEventBody::V0(body) = &event.body;
    assert_eq!(
        body.topics,
        vec![
            &env,
            to_sc_val(&env, symbol_short!("enc")),
            to_sc_val(&env, symbol_short!("xfer")),
            to_sc_val(&env, from),
            to_sc_val(&env, to),
        ].into(),
    );
    let mut expected_data: Map<Symbol, Val> = Map::new(&env);
    expected_data.set(Symbol::new(&env, "new_from_hash"), new_from_hash.into_val(&env));
    expected_data.set(Symbol::new(&env, "new_to_hash"), new_to_hash.into_val(&env));
    assert_eq!(body.data, to_sc_val(&env, expected_data));
}

fn to_sc_val<T>(env: &Env, value: T) -> xdr::ScVal
where
    T: IntoVal<Env, Val>,
{
    let val: Val = value.into_val(env);
    xdr::ScVal::try_from_val(env, &val).unwrap()
}
