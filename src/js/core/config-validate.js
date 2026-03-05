/*\! © 2026 slashwhat. MIT License. */
// config-validate.js — Validation logic for slashwhat config files.
// Extracted from config.js to keep both files under the 300-line limit.

import { Subnet } from './subnet.js';

// Hex color pattern — used to validate per-node manual colors.
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// Reject configs from other apps.
const APP_ID = 'slashwhat';
// Safety limit to prevent browser freeze from maliciously large configs.
const MAX_NODES = 500;
// Maximum tree depth bounded by address space (defense-in-depth).
const MAX_DEPTH_V4 = 32;
const MAX_DEPTH_V6 = 128;

// Known column keys — reject unknown values in imported configs to
// prevent XSS or injection via crafted column names.
export const KNOWN_COLS = new Set([
  'subnet', 'name', 'desc', 'notes', 'vlan', 'netmask', 'wildcard', 'range', 'usable', 'ips', 'hosts', 'join',
]);

// Validate a single tree's flat node array. Checks structure, CIDR
// validity, children references, duplicate IDs, and tree topology
// (exactly one root, no multi-parent nodes). Returns error string or null.
function validateNodeArray(nodes, globalIdSet) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return 'Invalid config: missing or empty nodes';
  }

  const localIdSet = new Set();

  for (const n of nodes) {
    if (typeof n.id !== 'number' || typeof n.cidr !== 'string') {
      return 'Invalid node: missing id or cidr';
    }
    if (localIdSet.has(n.id)) {
      return `Duplicate node ID: ${n.id}`;
    }
    // Check cross-tree uniqueness when validating a forest
    if (globalIdSet && globalIdSet.has(n.id)) {
      return `Duplicate node ID across trees: ${n.id}`;
    }
    localIdSet.add(n.id);
    if (globalIdSet) globalIdSet.add(n.id);

    try {
      Subnet.parse(n.cidr);
    } catch {
      return `Invalid CIDR in node ${n.id}: ${n.cidr}`;
    }

    // color is optional: null or a valid hex color string.
    if (n.color != null && (typeof n.color !== 'string' || !HEX_RE.test(n.color))) {
      return `Invalid color in node ${n.id}: ${n.color}`;
    }

    if (n.children !== null) {
      if (!Array.isArray(n.children) || n.children.length !== 2) {
        return `Invalid children in node ${n.id}`;
      }
    }
  }

  // Validate children references point to existing node IDs.
  for (const n of nodes) {
    if (n.children) {
      for (const cid of n.children) {
        if (!localIdSet.has(cid)) {
          return `Node ${n.id} references missing child ${cid}`;
        }
      }
    }
  }

  // Validate tree structure: exactly one root (no parent), no multi-parent.
  const childIds = new Set();
  for (const n of nodes) {
    if (n.children) {
      for (const cid of n.children) {
        if (childIds.has(cid)) {
          return `Node ${cid} has multiple parents`;
        }
        childIds.add(cid);
      }
    }
  }
  const roots = nodes.filter(n => !childIds.has(n.id));
  if (roots.length !== 1) {
    return `Expected 1 root node, found ${roots.length}`;
  }

  // Validate subnet topology: each child must be a proper subnet of its
  // parent (prefix exactly +1, address within parent's range). Catches
  // crafted configs with structurally valid trees but impossible CIDRs.
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  for (const n of nodes) {
    if (!n.children) continue;
    const parent = Subnet.parse(n.cidr);
    for (const cid of n.children) {
      const child = Subnet.parse(nodeMap.get(cid).cidr);
      if (child.prefix !== parent.prefix + 1) {
        return `Node ${cid}: prefix /${child.prefix} is not /${parent.prefix + 1}`;
      }
      // Containment check: mask the child's address to the parent's prefix.
      // If it equals the parent's network, the child is within the parent.
      const masked = new Subnet(child.network.toString(), parent.prefix);
      if (masked.network.toString() !== parent.network.toString()) {
        return `Node ${cid} (${nodeMap.get(cid).cidr}) is not within parent ${n.cidr}`;
      }
    }
  }

  // Defense-in-depth: tree depth must not exceed address space bounds.
  const rootNode = roots[0];
  const rootSubnet = Subnet.parse(rootNode.cidr);
  const maxAllowedDepth = (rootSubnet.isIPv4 ? MAX_DEPTH_V4 : MAX_DEPTH_V6) - rootSubnet.prefix;
  const depthStack = [{ id: rootNode.id, d: 0 }];
  let maxTreeDepth = 0;
  while (depthStack.length > 0) {
    const { id, d } = depthStack.pop();
    if (d > maxTreeDepth) maxTreeDepth = d;
    const nd = nodeMap.get(id);
    if (nd.children) {
      for (const cid of nd.children) depthStack.push({ id: cid, d: d + 1 });
    }
  }
  if (maxTreeDepth > maxAllowedDepth) {
    return `Tree too deep: ${maxTreeDepth} levels (max ${maxAllowedDepth} from /${rootSubnet.prefix})`;
  }

  return null;
}

// Validate column arrays — unknown keys are silently dropped on load,
// so we only reject clearly malformed values (non-strings).
function validateColumns(json) {
  if (Array.isArray(json.colOrder)) {
    for (const k of json.colOrder) {
      if (typeof k !== 'string') return 'Invalid column key';
    }
  }
  if (Array.isArray(json.visibleCols)) {
    for (const k of json.visibleCols) {
      if (typeof k !== 'string') return 'Invalid column key';
    }
  }
  return null;
}

// Validate a v2 config (forest with multiple trees).
function validateV2(json) {
  if (!Array.isArray(json.trees) || json.trees.length === 0) {
    return 'Invalid config: missing or empty trees array';
  }

  // Total node count across all trees must stay under the safety limit.
  let totalNodes = 0;
  for (const t of json.trees) {
    if (!Array.isArray(t.nodes)) {
      return 'Invalid config: tree missing nodes array';
    }
    totalNodes += t.nodes.length;
  }
  if (totalNodes > MAX_NODES) {
    return `Config too large: ${totalNodes} nodes (max ${MAX_NODES})`;
  }

  // Validate each tree's nodes, tracking IDs globally to catch cross-tree dupes.
  const globalIdSet = new Set();
  for (const t of json.trees) {
    const nodeErr = validateNodeArray(t.nodes, globalIdSet);
    if (nodeErr) return nodeErr;
  }

  return validateColumns(json);
}

// Top-level validation entry point. Returns an error string if invalid,
// or null if the config is safe to deserialize.
export function validateConfig(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return 'Invalid config: not a JSON object';
  }
  if (json.app !== APP_ID) {
    return 'Invalid config: not a slashwhat file';
  }
  if (json.version !== 2) {
    return `Unsupported config version: ${json.version}`;
  }

  return validateV2(json);
}
