use soroban_sdk::{bytesn, vec, Env, Symbol, U256};
use soroban_sdk::crypto::CryptoHazmat;

let env = Env::default();

// Define MDS matrix (2x2 for t=2)
let mds = vec![
    &env,
    vec![&env,
        U256::from_be_bytes(&env, &bytesn!(&env, 0x066f6f85d6f68a85ec10345351a23a3aaf07f38af8c952a7bceca70bd2af7ad5).into()),
        U256::from_be_bytes(&env, &bytesn!(&env, 0x2b9d4b4110c9ae997782e1509b1d0fdb20a7c02bbd8bea7305462b9f8125b1e8).into()),
    ],
    vec![&env,
        U256::from_be_bytes(&env, &bytesn!(&env, 0x0cc57cdbb08507d62bf67a4493cc262fb6c09d557013fff1f573f431221f8ff9).into()),
        U256::from_be_bytes(&env, &bytesn!(&env, 0x1274e649a32ed355a31a6ed69724e1adade857e86eb5c3a121bcd147943203c8).into()),
    ],
];

// Define round constants
let rc = vec![
    &env,
    vec![&env, U256::from_u32(&env, 1), U256::from_u32(&env, 2)],
    vec![&env, U256::from_u32(&env, 3), U256::from_u32(&env, 4)],
    vec![&env, U256::from_u32(&env, 5), U256::from_u32(&env, 6)],
];

let input = vec![&env, U256::from_u32(&env, 0), U256::from_u32(&env, 1)];

let hazmat = CryptoHazmat::new(&env);
let result = hazmat.poseidon_permutation(
    &input,
    Symbol::new(&env, "BN254"),
    2,  // t: state width
    5,  // d: s-box exponent
    2,  // rounds_f: full rounds
    1,  // rounds_p: partial rounds
    &mds,
    &rc,
);

assert_eq!(result.len(), 2);