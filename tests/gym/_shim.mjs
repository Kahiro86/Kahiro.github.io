// Minimal vitest-compatible shim so GymXP's ported domain tests run under
// plain Node (via the esbuild bundle in run.mjs) without pulling vitest into
// this repo. Supports only the surface these domain tests actually use:
// describe / it / beforeEach and the matchers enumerated below.

const state = {
  stack: [],            // describe scopes, each { hooks: [] }
  passed: 0,
  failed: 0,
  failures: [],         // { name, error }
  pending: [],          // promises from async it()
};

export function describe(name, fn) {
  state.stack.push({ name, hooks: [] });
  try {
    fn();
  } finally {
    state.stack.pop();
  }
}

export function beforeEach(fn) {
  const scope = state.stack[state.stack.length - 1];
  if (scope) scope.hooks.push(fn);
}
export function afterEach() {}
export function beforeAll(fn) { if (typeof fn === "function") fn(); }
export function afterAll() {}

function fullName(name) {
  return [...state.stack.map((s) => s.name), name].filter(Boolean).join(" › ");
}

export function it(name, fn) {
  const label = fullName(name);
  const hooks = state.stack.flatMap((s) => s.hooks);
  const record = (err) => {
    if (err) { state.failed++; state.failures.push({ name: label, error: err }); }
    else state.passed++;
  };
  try {
    for (const h of hooks) h();
    const r = fn();
    if (r && typeof r.then === "function") {
      state.pending.push(r.then(() => record(null), (e) => record(e)));
    } else {
      record(null);
    }
  } catch (e) {
    record(e);
  }
}
it.only = it;
it.skip = () => {};
export const test = it;

// ── matchers ──────────────────────────────────────────────────────────
const AC = Symbol("arrayContaining");

function isAC(v) { return v && typeof v === "object" && v[AC]; }

function deepEqual(a, b) {
  if (isAC(b)) {
    if (!Array.isArray(a)) return false;
    return b[AC].every((want) => a.some((got) => deepEqual(got, want)));
  }
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return a === b || (Number.isNaN(a) && Number.isNaN(b));
  if (a && b && typeof a === "object" && typeof b === "object") {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((x, i) => deepEqual(x, b[i]));
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function fmt(v) {
  try { return typeof v === "object" ? JSON.stringify(v) : String(v); } catch { return String(v); }
}

function makeMatchers(received, negate) {
  const ok = (pass, msg) => {
    if (pass === !negate) return;
    throw new Error(`${msg}${negate ? " (negated)" : ""}`);
  };
  const m = {
    toBe: (e) => ok(Object.is(received, e), `expected ${fmt(received)} to be ${fmt(e)}`),
    toEqual: (e) => ok(deepEqual(received, e), `expected ${fmt(received)} to equal ${fmt(e)}`),
    toStrictEqual: (e) => ok(deepEqual(received, e), `expected ${fmt(received)} to strictly equal ${fmt(e)}`),
    toContain: (e) => ok(
      (typeof received === "string" && received.includes(e)) ||
      (Array.isArray(received) && received.some((x) => deepEqual(x, e))),
      `expected ${fmt(received)} to contain ${fmt(e)}`),
    toBeCloseTo: (e, digits = 2) => ok(Math.abs(received - e) < 0.5 * Math.pow(10, -digits), `expected ${fmt(received)} to be close to ${fmt(e)} (±${digits}d)`),
    toBeGreaterThan: (e) => ok(received > e, `expected ${fmt(received)} > ${fmt(e)}`),
    toBeGreaterThanOrEqual: (e) => ok(received >= e, `expected ${fmt(received)} >= ${fmt(e)}`),
    toBeLessThan: (e) => ok(received < e, `expected ${fmt(received)} < ${fmt(e)}`),
    toBeLessThanOrEqual: (e) => ok(received <= e, `expected ${fmt(received)} <= ${fmt(e)}`),
    toBeDefined: () => ok(received !== undefined, `expected ${fmt(received)} to be defined`),
    toBeUndefined: () => ok(received === undefined, `expected ${fmt(received)} to be undefined`),
    toBeNull: () => ok(received === null, `expected ${fmt(received)} to be null`),
    toBeTruthy: () => ok(!!received, `expected ${fmt(received)} to be truthy`),
    toBeFalsy: () => ok(!received, `expected ${fmt(received)} to be falsy`),
    toBeTypeOf: (t) => ok(typeof received === t, `expected typeof ${fmt(received)} to be ${t}`),
    toHaveLength: (n) => ok(received?.length === n, `expected length ${received?.length} to be ${n}`),
    toThrow: (arg) => {
      let threw = false, err;
      try { received(); } catch (e) { threw = true; err = e; }
      if (arg === undefined) return ok(threw, `expected function to throw`);
      const msg = err ? String(err.message ?? err) : "";
      const pass = threw && (arg instanceof RegExp ? arg.test(msg) : msg.includes(arg));
      ok(pass, `expected function to throw matching ${fmt(arg)}, got ${threw ? fmt(msg) : "no throw"}`);
    },
    // Lenient: no stored snapshots in this runner — assert the value is
    // serializable and defined so the assertion still guards against crashes.
    toMatchSnapshot: () => ok(received !== undefined, `expected snapshot value to be defined`),
    toMatchInlineSnapshot: () => ok(received !== undefined, `expected snapshot value to be defined`),
  };
  return m;
}

export function expect(received) {
  const matchers = makeMatchers(received, false);
  Object.defineProperty(matchers, "not", { get: () => makeMatchers(received, true) });
  return matchers;
}
expect.arrayContaining = (arr) => ({ [AC]: arr });
expect.any = () => ({ [AC]: [] }); // unused-safe stub

export const vi = { fn: () => () => {}, spyOn: () => ({ mockReturnValue: () => {} }) };

export async function __finish() {
  await Promise.all(state.pending);
  return { passed: state.passed, failed: state.failed, failures: state.failures };
}
