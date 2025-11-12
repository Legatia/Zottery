pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Count Matches Between Two Number Arrays
 *
 * Counts how many numbers from ticketNumbers appear in winningNumbers.
 * Both arrays should contain 6 numbers each.
 */
template CountMatches(n) {
    signal input ticketNumbers[n];
    signal input winningNumbers[n];
    signal output matchCount;

    component equalCheckers[n][n];
    signal isMatch[n];
    signal partialSums[n + 1];

    partialSums[0] <== 0;

    // For each ticket number, check if it matches any winning number
    for (var i = 0; i < n; i++) {
        signal matches[n];

        for (var j = 0; j < n; j++) {
            equalCheckers[i][j] = IsEqual();
            equalCheckers[i][j].in[0] <== ticketNumbers[i];
            equalCheckers[i][j].in[1] <== winningNumbers[j];
            matches[j] <== equalCheckers[i][j].out;
        }

        // Check if there's at least one match for this ticket number
        // matches[0] + matches[1] + ... + matches[n-1] >= 1
        // We use a MultiOR component
        component multiOr = MultiOR(n);
        for (var j = 0; j < n; j++) {
            multiOr.in[j] <== matches[j];
        }
        isMatch[i] <== multiOr.out;

        // Accumulate matches
        partialSums[i + 1] <== partialSums[i] + isMatch[i];
    }

    matchCount <== partialSums[n];
}

/**
 * Multi-input OR Gate
 *
 * Returns 1 if any input is 1, otherwise 0.
 */
template MultiOR(n) {
    signal input in[n];
    signal output out;

    signal sums[n + 1];
    sums[0] <== 0;

    for (var i = 0; i < n; i++) {
        sums[i + 1] <== sums[i] + in[i];
    }

    // If sum > 0, then at least one input was 1
    component isZero = IsZero();
    isZero.in <== sums[n];

    out <== 1 - isZero.out;
}
