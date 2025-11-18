pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";

// Simplified hash for ticket commitment
template TicketCommitmentHash() {
    signal input ticket_id;
    signal input salt;
    signal output commitment;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== ticket_id;
    hasher.inputs[1] <== salt;
    commitment <== hasher.out;
}

// Nullifier computation
template NullifierHash() {
    signal input ticket_id;
    signal input draw_id;
    signal output nullifier;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== ticket_id;
    hasher.inputs[1] <== draw_id;
    nullifier <== hasher.out;
}

// Z-address hash
template ZAddressHash() {
    signal input z_address_preimage;
    signal output z_address_hash;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== z_address_preimage;
    z_address_hash <== hasher.out;
}

// Main circuit for Starknet cross-chain claims
template StarknetClaimVerifier() {
    // ============ PUBLIC INPUTS ============
    signal input winning_commitment;  // The commitment that won (from Starknet VRF)
    signal input nullifier;            // Prevents double-claiming
    signal input draw_id;              // Links to specific draw
    signal input z_address_hash;       // Hash of Zcash recipient address

    // ============ PRIVATE INPUTS ============
    signal input ticket_id;            // User's ticket identifier
    signal input salt;                 // Secret salt for commitment
    signal input z_address_preimage;   // Actual Zcash z-address (kept private)

    // ============ CONSTRAINTS ============

    // 1. Verify ticket commitment
    component commitmentHasher = TicketCommitmentHash();
    commitmentHasher.ticket_id <== ticket_id;
    commitmentHasher.salt <== salt;

    // Constraint: computed commitment must match winning commitment
    commitmentHasher.commitment === winning_commitment;

    // 2. Verify nullifier
    component nullifierHasher = NullifierHash();
    nullifierHasher.ticket_id <== ticket_id;
    nullifierHasher.draw_id <== draw_id;

    // Constraint: computed nullifier must match public nullifier
    nullifierHasher.nullifier === nullifier;

    // 3. Verify z-address hash
    component zAddressHasher = ZAddressHash();
    zAddressHasher.z_address_preimage <== z_address_preimage;

    // Constraint: computed z-address hash must match public hash
    zAddressHasher.z_address_hash === z_address_hash;

    // ============ OUTPUT (implicit via public inputs) ============
    // No explicit output signals needed
    // The proof itself validates the constraints
}

// Main component
component main {public [winning_commitment, nullifier, draw_id, z_address_hash]} = StarknetClaimVerifier();
