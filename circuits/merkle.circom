pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Merkle Tree Inclusion Proof
 *
 * Verifies that a leaf is included in a Merkle tree with a given root.
 * Uses Poseidon hash for efficiency in ZK circuits.
 */
template MerkleTreeInclusionProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    component selectors[levels];

    signal hashes[levels + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // Select left and right inputs based on path index
        selectors[i] = Selector();
        selectors[i].index <== pathIndices[i];
        selectors[i].left <== hashes[i];
        selectors[i].right <== pathElements[i];

        // Hash the pair
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== selectors[i].outLeft;
        hashers[i].inputs[1] <== selectors[i].outRight;

        hashes[i + 1] <== hashers[i].out;
    }

    root <== hashes[levels];
}

/**
 * Selector Component
 *
 * Based on index (0 or 1), selects which input goes left and which goes right.
 * index = 0: left = left, right = right
 * index = 1: left = right, right = left
 */
template Selector() {
    signal input index;
    signal input left;
    signal input right;
    signal output outLeft;
    signal output outRight;

    // Ensure index is binary
    index * (1 - index) === 0;

    outLeft <== left + index * (right - left);
    outRight <== right + index * (left - right);
}
