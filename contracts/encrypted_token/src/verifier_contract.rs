use soroban_sdk::{symbol_short, Address, Env, IntoVal, Val, Vec};

use crate::{FieldBytes, Proof, VerificationKey};

pub(crate) fn verify(
    env: &Env,
    verifier: &Address,
    vk: &VerificationKey,
    proof: &Proof,
    pub_signals: &Vec<FieldBytes>,
) -> bool {
    let args: Vec<Val> = (vk.clone(), proof.clone(), pub_signals.clone()).into_val(env);
    env.invoke_contract(verifier, &symbol_short!("verify"), args)
}
