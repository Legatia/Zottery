pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Compute Ticket Hash
 *
 * Computes the hash of a ticket: hash(numbers || salt || claimKey)
 * Uses Poseidon hash for efficiency in ZK circuits.
 */
template ComputeTicketHash() {
    signal input numbers[6];
    signal input salt;
    signal input claimKey;
    signal output hash;

    // Hash all inputs together (6 numbers + salt + claimKey = 8 inputs)
    component hasher = Poseidon(8);

    for (var i = 0; i < 6; i++) {
        hasher.inputs[i] <== numbers[i];
    }
    hasher.inputs[6] <== salt;
    hasher.inputs[7] <== claimKey;

    hash <== hasher.out;
}

/**
 * Compute Nullifier
 *
 * Computes the nullifier: hash(claimKey)
 * This prevents double-claiming without revealing the claim key.
 */
template ComputeNullifier() {
    signal input claimKey;
    signal output nullifier;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== claimKey;

    nullifier <== hasher.out;
}
