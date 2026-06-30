use soroban_sdk::{contractevent, Address, Env};

use crate::{FieldBytes, JubJubPoint, OpType};

#[contractevent(topics = ["enc", "register"])]
pub struct Registered {
    #[topic]
    pub user: Address,
    pub user_pk: JubJubPoint,
}

#[contractevent(topics = ["enc", "xfer"])]
pub struct PrivateTransfer {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub new_from_hash: FieldBytes,
    pub new_to_hash: FieldBytes,
}

#[contractevent(topics = ["enc", "vk"])]
pub struct VkSet {
    #[topic]
    pub op: OpType,
}

#[contractevent(topics = ["enc", "mint"])]
pub struct PrivateMint {
    #[topic]
    pub to: Address,
}

#[contractevent(topics = ["enc", "deposit"])]
pub struct Deposit {
    #[topic]
    pub user: Address,
    pub amount: i128,
}

pub(crate) fn emit_registered(env: &Env, user: Address, user_pk: JubJubPoint) {
    Registered { user, user_pk }.publish(env);
}

pub(crate) fn emit_private_transfer(
    env: &Env,
    from: Address,
    to: Address,
    new_from_hash: FieldBytes,
    new_to_hash: FieldBytes,
) {
    PrivateTransfer {
        from,
        to,
        new_from_hash,
        new_to_hash,
    }
    .publish(env);
}

pub(crate) fn emit_vk_set(env: &Env, op: OpType) {
    VkSet { op }.publish(env);
}

pub(crate) fn emit_private_mint(env: &Env, to: Address) {
    PrivateMint { to }.publish(env);
}

pub(crate) fn emit_deposit(env: &Env, user: Address, amount: i128) {
    Deposit { user, amount }.publish(env);
}
