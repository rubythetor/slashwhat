/*\! © 2026 slashwhat. MIT License. */
// input-validation.js — Shared input validation styling.
// Applies real-time red/green visual feedback on form inputs based on
// validity. Extracted so both the hero animation and the forest input row
// share identical validation behavior without duplicating code.

import { parseSubnetInput } from '../core/parse.js';
import { Subnet } from '../core/subnet.js';

// Apply subnet validation styling: green when valid CIDR, red when invalid,
// neutral when empty. Used by the hero demo and the forest input row.
export function applySubnetValidation(input) {
  const val = input.value.trim();
  if (!val) {
    input.classList.remove('input-valid', 'input-invalid');
    return;
  }
  try {
    const { addr, prefix } = parseSubnetInput(val);
    new Subnet(addr, prefix);
    input.classList.add('input-valid');
    input.classList.remove('input-invalid');
  } catch {
    input.classList.add('input-invalid');
    input.classList.remove('input-valid');
  }
}

// Apply digit-only validation: green when all digits, red when non-digits
// present, neutral when empty. Used for section ID fields.
export function applyDigitValidation(input) {
  const val = input.value;
  if (!val) {
    input.classList.remove('input-valid', 'input-invalid');
    return;
  }
  if (/^\d+$/.test(val)) {
    input.classList.add('input-valid');
    input.classList.remove('input-invalid');
  } else {
    input.classList.add('input-invalid');
    input.classList.remove('input-valid');
  }
}

// Apply length-based validation: green when within limit, red when over,
// neutral when empty. Used for name fields.
export function applyLengthValidation(input, max) {
  const val = input.value;
  if (!val) {
    input.classList.remove('input-valid', 'input-invalid');
    return;
  }
  if (val.length <= max) {
    input.classList.add('input-valid');
    input.classList.remove('input-invalid');
  } else {
    input.classList.add('input-invalid');
    input.classList.remove('input-valid');
  }
}
