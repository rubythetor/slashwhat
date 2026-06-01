/*\! © 2026 slashwhat. MIT License. */
// vlan-macro.js — Parser and evaluator for VLAN Macro Language (VML).
// Pure logic, no DOM. VML expressions let users define VLAN IDs from
// subnet properties: octets, prefix length, section ID, and sequences.
//
// Token types:
//   {o1}–{o4}        IPv4 octets from the subnet's network address
//   {mask}            CIDR prefix length
//   {id}              Section ID parsed as integer
//   {seq Start:Step}  Sequential generator: Start + Step * leafIndex
// Operators: * (multiply), + (add), - (subtract)
// Adjacent tokens with no operator are concatenated as strings.
// Literals: bare integers

// Reserved VLAN IDs (FDDI/Token Ring) — produce warnings, not errors.
const RESERVED_VLANS = new Set([1002, 1003, 1004, 1005]);

// Check if a value is a valid VLAN ID (integer 1–4094, excluding reserved).
export function isValidVlan(n) {
  if (!Number.isInteger(n)) return false;
  if (n < 1 || n > 4094) return false;
  if (RESERVED_VLANS.has(n)) return false;
  return true;
}

// Preset macros covering common VLAN assignment patterns.
export const VLAN_PRESETS = [
  { name: 'Third Octet',    template: '{o3}',              description: '{o3}' },
  { name: 'Site + Octet',   template: '{id}*100+{o3}',    description: '{id}*100+{o3}' },
  { name: 'Site Offset',    template: '{id}+{o3}',        description: '{id}+{o3}' },
  { name: 'Sequential',     template: '{seq 100:1}',      description: '{seq 100:1}' },
  { name: 'Octet Base 100', template: '{o3}+100',          description: '{o3}+100' },
  { name: 'Fourth Octet',   template: '{o4}+{mask}',      description: '{o4}+{mask}' },
];

// --- Tokenizer ---

// Regex to match VML tokens: variables, generators, operators, literals.
// Octet variables support optional digit-slicing modifiers (l, ll, r, rr).
const TOKEN_RE = /\{(o[1-4])(?:\s*(l{1,2}|r{1,2}))?\}|\{(mask|id)\}|\{seq\s+(\d+):(\d+)\}|([*+\-])|(\d+)/g;

// Parse a VML template string into an array of token objects.
// Returns [{type, value, ...}] where type is 'var'|'gen'|'op'|'lit'.
// Sets .hasGap = true if any non-whitespace characters were skipped by the
// regex — indicates malformed input like `{o3` or `o3}`.
export function parseVlanMacro(template) {
  if (!template || typeof template !== 'string') return [];

  const tokens = [];
  let match;
  let lastEnd = 0;
  let hasGap = false;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(template)) !== null) {
    // Characters between lastEnd and this match were skipped by the regex.
    if (match.index > lastEnd) {
      const skipped = template.slice(lastEnd, match.index);
      if (/\S/.test(skipped)) hasGap = true;
    }
    lastEnd = match.index + match[0].length;

    if (match[1]) {
      // Octet variable with optional digit-slice modifier (l, ll, r, rr).
      tokens.push({ type: 'var', value: match[1], modifier: match[2] || null });
    } else if (match[3]) {
      // Non-octet variable: {mask}, {id}
      tokens.push({ type: 'var', value: match[3] });
    } else if (match[4] !== undefined) {
      // Generator: {seq Start:Step}
      tokens.push({ type: 'gen', value: 'seq', start: parseInt(match[4], 10), step: parseInt(match[5], 10) });
    } else if (match[6]) {
      // Operator: * + -
      tokens.push({ type: 'op', value: match[6] });
    } else if (match[7] !== undefined) {
      // Literal integer — raw preserves leading zeros for concat.
      tokens.push({ type: 'lit', value: parseInt(match[7], 10), raw: match[7] });
    }
  }

  // Trailing characters after the last match were also skipped.
  if (lastEnd < template.length) {
    const trailing = template.slice(lastEnd);
    if (/\S/.test(trailing)) hasGap = true;
  }

  if (hasGap) tokens.hasGap = true;
  return tokens;
}

// --- Evaluator ---

// Human-readable labels for error messages when a variable is NaN.
const VAR_ERROR = {
  o1: '{o1}: no octets (IPv6?)', o2: '{o2}: no octets (IPv6?)',
  o3: '{o3}: no octets (IPv6?)', o4: '{o4}: no octets (IPv6?)',
  id: '{id}: set a section ID in the # field', mask: '{mask}: no prefix',
};

// Extract a subset of digits from a number (for octet digit-slicing modifiers).
function sliceDigits(value, modifier) {
  const s = String(value);
  switch (modifier) {
    case 'r':  return parseInt(s.slice(-1), 10);
    case 'rr': return parseInt(s.slice(-2), 10);
    case 'l':  return parseInt(s.slice(0, 1), 10);
    case 'll': return parseInt(s.slice(0, 2), 10);
    default:   return value;
  }
}

// Resolve a single token to its numeric value given a context.
// Returns { val, str, err } — str is the raw text for concat, err on failure.
function resolveToken(token, ctx) {
  switch (token.type) {
    case 'var': {
      const map = { o1: ctx.o1, o2: ctx.o2, o3: ctx.o3, o4: ctx.o4, mask: ctx.mask, id: ctx.id };
      const v = map[token.value];
      if (typeof v === 'number' && isNaN(v)) return { val: NaN, err: VAR_ERROR[token.value] || `{${token.value}} is not set` };
      const final = token.modifier ? sliceDigits(v, token.modifier) : v;
      return { val: final, str: String(final) };
    }
    case 'gen': {
      const v = token.start + token.step * (ctx.leafIndex || 0);
      return { val: v, str: String(v) };
    }
    case 'lit':
      return { val: token.value, str: token.raw || String(token.value) };
    default:
      return { val: NaN, err: 'Unknown token' };
  }
}

// Evaluate a parsed token array with a context object.
// Left-to-right accumulator: adjacent tokens concat, explicit * / + / -.
export function evaluateVlan(tokens, ctx) {
  if (!tokens || tokens.length === 0) return { value: null, valid: false, error: 'Empty template' };

  // Filter to value tokens (skip leading operators)
  const valueTokens = [];
  const operators = [];

  let expectValue = true;
  for (const t of tokens) {
    if (t.type === 'op') {
      if (expectValue) continue; // skip leading/consecutive operators
      operators.push(t.value);
      expectValue = true;
    } else {
      valueTokens.push(t);
      expectValue = false;
    }
  }

  if (valueTokens.length === 0) return { value: null, valid: false, error: 'No values in template' };

  // Evaluate left-to-right with accumulator.
  // Each resolveToken returns {val, err}; bail immediately on error
  // so NaN doesn't silently propagate through arithmetic.
  const first = resolveToken(valueTokens[0], ctx);
  if (first.err) return { value: null, valid: false, error: first.err };
  let acc = first.val;
  let accStr = first.str;

  for (let i = 1; i < valueTokens.length; i++) {
    const op = operators[i - 1];
    const resolved = resolveToken(valueTokens[i], ctx);
    if (resolved.err) return { value: null, valid: false, error: resolved.err };

    if (!op) {
      // Adjacent tokens with no operator — string join preserving raw text.
      accStr = accStr + resolved.str;
      acc = accStr;
    } else if (op === '*') {
      acc = Number(acc) * Number(resolved.val);
      accStr = String(acc);
    } else if (op === '+') {
      acc = Number(acc) + Number(resolved.val);
      accStr = String(acc);
    } else if (op === '-') {
      acc = Number(acc) - Number(resolved.val);
      accStr = String(acc);
    }
  }

  // Convert final result to number for validation
  const num = Number(acc);

  if (isNaN(num)) {
    return { value: String(acc), valid: false, error: 'Result is not a number' };
  }

  if (!Number.isInteger(num)) {
    return { value: num, valid: false, error: 'Result is not an integer' };
  }

  // Range check
  if (num < 1 || num > 4094) {
    return { value: num, valid: false, error: `VLAN ${num} out of range (1–4094)` };
  }

  // Reserved VLAN warning (valid but flagged)
  if (RESERVED_VLANS.has(num)) {
    return { value: num, valid: true, warning: true, error: `VLAN ${num} is reserved (FDDI/Token Ring)` };
  }

  return { value: num, valid: true };
}

// Build context from subnet data and evaluate a template in one call.
// Extracts IPv4 octets via network.toArray(), handles IPv6 gracefully.
export function computeVlan(template, subnet, sectionId, leafIndex) {
  const parsed = parseVlanMacro(template);
  if (parsed.length === 0) return { value: null, valid: false, error: 'Empty template' };

  // Malformed input — the tokenizer skipped unrecognized characters.
  if (parsed.hasGap) return { value: null, valid: false, error: 'Invalid syntax' };

  let o1 = NaN, o2 = NaN, o3 = NaN, o4 = NaN;
  if (subnet.isIPv4) {
    const octets = subnet.network.toArray();
    [o1, o2, o3, o4] = octets;
  }

  const ctx = {
    o1, o2, o3, o4,
    mask: subnet.prefix,
    id: sectionId ? parseInt(sectionId, 10) : NaN,
    leafIndex: leafIndex || 0,
  };

  const result = evaluateVlan(parsed, ctx);
  result.template = template;
  return result;
}
