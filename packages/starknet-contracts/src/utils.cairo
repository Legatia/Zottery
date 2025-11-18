use core::poseidon::poseidon_hash_span;

// Poseidon hash helper for commitments
pub fn compute_ticket_commitment(ticket_id: u64, salt: felt252) -> felt252 {
    let inputs = array![ticket_id.into(), salt];
    poseidon_hash_span(inputs.span())
}

// Compute nullifier
pub fn compute_nullifier(ticket_id: u64, draw_id: u64) -> felt252 {
    let inputs = array![ticket_id.into(), draw_id.into()];
    poseidon_hash_span(inputs.span())
}

// Compute z-address hash
pub fn compute_z_address_hash(z_address: felt252) -> felt252 {
    let inputs = array![z_address];
    poseidon_hash_span(inputs.span())
}
