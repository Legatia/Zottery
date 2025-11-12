pragma circom 2.1.0;

include "./merkle.circom";
include "./matchCounter.circom";
include "./ticketHash.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Lottery Claim Verifier Circuit
 *
 * This circuit proves that the claimer:
 * 1. Owns a valid ticket (ticket hash is in the Merkle tree)
 * 2. The ticket has at least `minMatches` winning numbers
 * 3. Knows the claim key that derives the nullifier
 *
 * Without revealing:
 * - Which specific ticket they own
 * - Their identity
 * - The claim key itself
 *
 * Public Inputs:
 * - nullifier: Unique identifier derived from claim key (prevents double-claiming)
 * - winningNumbers[6]: The drawn winning numbers
 * - minMatches: Minimum number of matches required (3-6)
 * - ticketTreeRoot: Merkle root of all tickets in this draw
 * - drawId: The draw being claimed from
 *
 * Private Inputs:
 * - ticketNumbers[6]: The claimer's ticket numbers
 * - salt: Random salt used in ticket generation
 * - claimKey: Secret key for claiming
 * - merkleProof: Merkle proof that ticket is in the tree
 * - merklePathIndices: Path indices for Merkle proof
 */
template ClaimVerifier(merkleLevels) {
    // Public inputs
    signal input nullifier;
    signal input winningNumbers[6];
    signal input minMatches;
    signal input ticketTreeRoot;
    signal input drawId;

    // Private inputs
    signal input ticketNumbers[6];
    signal input salt;
    signal input claimKey;
    signal input merkleProof[merkleLevels];
    signal input merklePathIndices[merkleLevels];

    // ========================================================================
    // Constraint 1: Verify ticket numbers are in valid range (1-49)
    // ========================================================================

    component rangeCheckers[6];
    for (var i = 0; i < 6; i++) {
        rangeCheckers[i] = NumberInRange(1, 49);
        rangeCheckers[i].in <== ticketNumbers[i];
    }

    // ========================================================================
    // Constraint 2: Compute and verify ticket hash
    // ========================================================================

    component ticketHasher = ComputeTicketHash();
    for (var i = 0; i < 6; i++) {
        ticketHasher.numbers[i] <== ticketNumbers[i];
    }
    ticketHasher.salt <== salt;
    ticketHasher.claimKey <== claimKey;

    // ========================================================================
    // Constraint 3: Verify ticket is in Merkle tree
    // ========================================================================

    component merkleVerifier = MerkleTreeInclusionProof(merkleLevels);
    merkleVerifier.leaf <== ticketHasher.hash;
    for (var i = 0; i < merkleLevels; i++) {
        merkleVerifier.pathElements[i] <== merkleProof[i];
        merkleVerifier.pathIndices[i] <== merklePathIndices[i];
    }

    // Verify computed root matches the public root
    merkleVerifier.root === ticketTreeRoot;

    // ========================================================================
    // Constraint 4: Count matching numbers
    // ========================================================================

    component matchCounter = CountMatches(6);
    for (var i = 0; i < 6; i++) {
        matchCounter.ticketNumbers[i] <== ticketNumbers[i];
        matchCounter.winningNumbers[i] <== winningNumbers[i];
    }

    // ========================================================================
    // Constraint 5: Verify sufficient matches
    // ========================================================================

    component sufficientMatches = GreaterEqThan(3);
    sufficientMatches.in[0] <== matchCounter.matchCount;
    sufficientMatches.in[1] <== minMatches;

    // Must have at least minMatches
    sufficientMatches.out === 1;

    // ========================================================================
    // Constraint 6: Verify nullifier derivation
    // ========================================================================

    component nullifierComputer = ComputeNullifier();
    nullifierComputer.claimKey <== claimKey;

    // Verify computed nullifier matches public nullifier
    nullifierComputer.nullifier === nullifier;

    // ========================================================================
    // All constraints satisfied - proof is valid!
    // ========================================================================
}

/**
 * Number In Range Checker
 *
 * Verifies that a number is within [min, max] inclusive.
 */
template NumberInRange(min, max) {
    signal input in;

    component lowerBound = GreaterEqThan(8);
    lowerBound.in[0] <== in;
    lowerBound.in[1] <== min;
    lowerBound.out === 1;

    component upperBound = LessEqThan(8);
    upperBound.in[0] <== in;
    upperBound.in[1] <== max;
    upperBound.out === 1;
}

// Main component with 20 Merkle tree levels (supports up to 2^20 = ~1M tickets)
component main {public [nullifier, winningNumbers, minMatches, ticketTreeRoot, drawId]} = ClaimVerifier(20);
