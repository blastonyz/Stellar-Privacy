#![no_std]
// EncryptedToken mirrors EncryptedERC using BN254 Groth16 proofs and BabyJubJub encrypted balances.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Vec};

mod events;
mod verifier_contract;

#[cfg(test)]
mod poseidon_circom;
#[cfg(test)]
mod test;

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

// BN254 scalar/base-field element encoded as a 32-byte big-endian integer.
pub type FieldBytes = BytesN<32>;

// BabyJubJub point encoded as two BN254 scalar-field coordinates.
#[derive(Clone)]
#[contracttype]
pub struct JubJubPoint {
    pub x: FieldBytes,
    pub y: FieldBytes,
}

// BN254 G1 point encoded as two base-field coordinates.
#[derive(Clone)]
#[contracttype]
pub struct BN254G1 {
    pub x: FieldBytes,
    pub y: FieldBytes,
}

// BN254 Fq2 element encoded as c0 + c1 * u.
#[derive(Clone)]
#[contracttype]
pub struct BN254Fq2 {
    pub c0: FieldBytes,
    pub c1: FieldBytes,
}

// BN254 G2 point encoded as two Fq2 coordinates.
#[derive(Clone)]
#[contracttype]
pub struct BN254G2 {
    pub x: BN254Fq2,
    pub y: BN254Fq2,
}

// Twisted-ElGamal ciphertext on BabyJubJub.
#[derive(Clone)]
#[contracttype]
pub struct EncryptedBalance {
    pub c1: JubJubPoint,
    pub c2: JubJubPoint,
}

// BN254 Groth16 proof: 3 curve points.
#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: BN254G1,
    pub b: BN254G2,
    pub c: BN254G1,
}

// Groth16 verification key stored by admin.
#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: BN254G1,
    pub beta: BN254G2,
    pub gamma: BN254G2,
    pub delta: BN254G2,
    pub ic: Vec<BN254G1>,
}

// Identifies which circuit a VK belongs to.
#[derive(Clone)]
#[contracttype]
pub enum OpType {
    Register,
    Mint,
    Transfer,
    Deposit,
    Withdraw,
}

// ═══════════════════════════════════════════════════════════════
// Storage keys
// ═══════════════════════════════════════════════════════════════

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Verifier,
    Vk(OpType),             // Verification key per circuit
    UserPk(Address),        // User's BLS12-381 G1 public key
    Balance(Address),       // User's encrypted balance ciphertext
    Registered(Address),    // bool sentinel: has user registered?
}

// ═══════════════════════════════════════════════════════════════
// Errors
// ═══════════════════════════════════════════════════════════════

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    Unauthorized       = 1,
    NotRegistered      = 2,
    AlreadyRegistered  = 3,
    InvalidProof       = 4,
    BadPublicSignals   = 5,
    MissingVk          = 8,
    BalanceMismatch    = 9,
}

// ═══════════════════════════════════════════════════════════════
// Contract
// ═══════════════════════════════════════════════════════════════

#[contract]
pub struct EncryptedToken;

#[contractimpl]
impl EncryptedToken {

    // ─── Deployment ───────────────────────────────────────────

    // Deploy the contract.
    pub fn __constructor(
        env: Env,
        admin: Address,
        verifier: Address,
    ) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Verifier, &verifier);
    }

    // ─── Admin: upload verification keys ──────────────────────

    // Store the Groth16 verification key for a given operation.
    pub fn set_vk(env: Env, op: OpType, vk: VerificationKey) {
        Self::require_admin(&env);
        env.storage().persistent().set(&DataKey::Vk(op.clone()), &vk);
        events::emit_vk_set(&env, op);
    }

    // ─── Registration ─────────────────────────────────────────

    // Register a user with their BabyJubJub public key.
    pub fn register(
        env: Env,
        user: Address,
        user_pk: JubJubPoint,
        proof: Proof,
        pub_signals: Vec<FieldBytes>,
    ) -> Result<(), Error> {
        user.require_auth();

        if env.storage().persistent().has(&DataKey::Registered(user.clone())) {
            return Err(Error::AlreadyRegistered);
        }

        let vk = Self::load_vk(&env, OpType::Register)?;
        Self::verify_proof(&env, &vk, &proof, &pub_signals)?;

        // Store user's public key and mark as registered
        env.storage().persistent().set(&DataKey::UserPk(user.clone()), &user_pk);
        env.storage().persistent().set(&DataKey::Registered(user.clone()), &true);

        // Initial balance is zero (identity point = encryption of 0 with r=0)
        let identity = Self::identity_point(&env);
        let zero_balance = EncryptedBalance { c1: identity.clone(), c2: identity };
        env.storage().persistent().set(&DataKey::Balance(user.clone()), &zero_balance);

        events::emit_registered(&env, user, user_pk);
        Ok(())
    }

    // ─── Standalone mode: admin mints encrypted tokens ────────

    // Mint encrypted tokens to a registered user (standalone mode only).
    pub fn private_mint(
        env: Env,
        to: Address,
        new_balance: EncryptedBalance,
        proof: Proof,
        pub_signals: Vec<FieldBytes>,
    ) -> Result<(), Error> {
        Self::require_admin(&env);
        Self::require_registered(&env, &to)?;

        let vk = Self::load_vk(&env, OpType::Mint)?;
        Self::verify_proof(&env, &vk, &proof, &pub_signals)?;

        env.storage().persistent().set(&DataKey::Balance(to.clone()), &new_balance);
        events::emit_private_mint(&env, to);
        Ok(())
    }

    // ─── Converter mode: public deposit → shielded balance ────

    // User deposits a public amount and updates their encrypted balance.
    pub fn deposit(
        env: Env,
        user: Address,
        amount: i128,
        new_balance: EncryptedBalance,
        proof: Proof,
        pub_signals: Vec<FieldBytes>,
    ) -> Result<(), Error> {
        user.require_auth();
        Self::require_registered(&env, &user)?;

        if amount < 1 {
            return Err(Error::BalanceMismatch);
        }

        let vk = Self::load_vk(&env, OpType::Deposit)?;
        Self::verify_proof(&env, &vk, &proof, &pub_signals)?;

        env.storage().persistent().set(&DataKey::Balance(user.clone()), &new_balance);
        events::emit_deposit(&env, user, amount);
        Ok(())
    }

    // ─── Private transfer (both modes) ────────────────────────

    // Transfer encrypted tokens between registered users.
    pub fn private_transfer(
        env: Env,
        from: Address,
        to: Address,
        new_from_balance: EncryptedBalance,
        new_to_balance:   EncryptedBalance,
        proof: Proof,
        pub_signals: Vec<FieldBytes>,
    ) -> Result<(), Error> {
        from.require_auth();
        Self::require_registered(&env, &from)?;
        Self::require_registered(&env, &to)?;

        let vk = Self::load_vk(&env, OpType::Transfer)?;
        Self::verify_proof(&env, &vk, &proof, &pub_signals)?;

        env.storage().persistent().set(&DataKey::Balance(from.clone()), &new_from_balance);
        env.storage().persistent().set(&DataKey::Balance(to.clone()),   &new_to_balance);

        events::emit_private_transfer(
            &env,
            from,
            to,
            pub_signals.get(1).ok_or(Error::BadPublicSignals)?,
            pub_signals.get(3).ok_or(Error::BadPublicSignals)?,
        );
        Ok(())
    }

    // ─── Queries ──────────────────────────────────────────────

    // Returns the user's encrypted balance.
    pub fn get_balance(env: Env, user: Address) -> Option<EncryptedBalance> {
        env.storage().persistent().get(&DataKey::Balance(user))
    }

    // Returns the user's BabyJubJub public key.
    pub fn get_user_pk(env: Env, user: Address) -> Option<JubJubPoint> {
        env.storage().persistent().get(&DataKey::UserPk(user))
    }

    // Returns true if the user has registered.
    pub fn is_registered(env: Env, user: Address) -> bool {
        env.storage().persistent().has(&DataKey::Registered(user))
    }

    // ═══════════════════════════════════════════════════════════
    // Private helpers
    // ═══════════════════════════════════════════════════════════

    fn require_admin(env: &Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }

    fn require_registered(env: &Env, user: &Address) -> Result<(), Error> {
        if env.storage().persistent().has(&DataKey::Registered(user.clone())) {
            Ok(())
        } else {
            Err(Error::NotRegistered)
        }
    }

    fn load_vk(env: &Env, op: OpType) -> Result<VerificationKey, Error> {
        env.storage().persistent().get(&DataKey::Vk(op)).ok_or(Error::MissingVk)
    }

    /// BabyJubJub identity point placeholder used for empty balances.
    fn identity_point(env: &Env) -> JubJubPoint {
        let zero = BytesN::from_array(env, &[0u8; 32]);
        JubJubPoint { x: zero.clone(), y: zero }
    }

    // ─── External Groth16 verification ────────────────────────

    /// Verify a BN254 Groth16 proof by calling the dedicated verifier contract.
    fn verify_proof(
        env: &Env,
        vk: &VerificationKey,
        proof: &Proof,
        pub_signals: &Vec<FieldBytes>,
    ) -> Result<(), Error> {
        if pub_signals.len() + 1 != vk.ic.len() {
            return Err(Error::BadPublicSignals);
        }

        let verifier: Address = env.storage().instance().get(&DataKey::Verifier).unwrap();
        let ok = verifier_contract::verify(env, &verifier, vk, proof, pub_signals);
        if ok { Ok(()) } else { Err(Error::InvalidProof) }
    }

}

