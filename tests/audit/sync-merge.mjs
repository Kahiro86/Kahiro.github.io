// Sync is last-write-wins per KEY, and a key is a whole collection — so a
// habit added on the laptop is destroyed by the phone's next write of
// `ht_habits`, which has never seen it. No error, nothing to undo.
//
// These are the cases that fix has to get right, and the ones it must not
// break: a merge that resurrects everything you ever deleted is not a fix.
import { readFileSync } from "node:fs";
import { mergeStore, ancestorOf, isMergeable, STRATEGY, TIMED, UNION, LWW } from "../../src/shared/merge.js";

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const T = (h, m = 0) => `2026-08-30T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
const habit = (id, name, updatedAt) => ({ id, name, type: "boolean", archivedAt: null, createdAt: updatedAt, updatedAt });
const ids = (r) => r.value.map((x) => x.id).sort().join(",");
/** The version both devices last agreed on: what it held, and when. */
const agreed = (list, ts) => ({ ts, ids: list.map((x) => x.id) });

console.log("\n1. The reported bug: an addition on one device survives the other's write");
{
  // Laptop at 10:00 adds h3. Phone's copy is from 09:00 and has never seen it.
  const before = [habit("h1", "Deep work", T(9)), habit("h2", "Read", T(9))];
  const laptop = [...before, habit("h3", "Stretch", T(10))];
  const phone = [...before];
  const base = agreed(before, T(9)); // both were last in step at 09:00

  const onPhone = mergeStore("ht_habits", phone, laptop, T(9), T(10), base);
  ok(`the phone gains the new habit (${ids(onPhone)})`, ids(onPhone) === "h1,h2,h3");

  // And the reverse, which is where the data used to die: the phone wrote
  // something at 10:30, so its blob is newer and would have won outright.
  const phoneLater = [habit("h1", "Deep work", T(10, 30)), habit("h2", "Read", T(9))];
  const onLaptop = mergeStore("ht_habits", laptop, phoneLater, T(10), T(10, 30), base);
  ok(`the newer phone blob no longer erases h3 (${ids(onLaptop)})`, ids(onLaptop) === "h1,h2,h3");
  ok("and the phone's newer edit of h1 wins", onLaptop.value.find((x) => x.id === "h1").updatedAt === T(10, 30));
}

console.log("\n2. A delete is still a delete");
{
  // h2 was in the version both sides agreed on. The phone does not have it
  // now, so leaving it out was a decision, not ignorance.
  const laptop = [habit("h1", "a", T(9)), habit("h2", "b", T(9))];
  const phone = [habit("h1", "a", T(9))];
  const base = agreed(laptop, T(9));

  const merged = mergeStore("ht_habits", laptop, phone, T(9), T(11), base);
  ok(`h2 stays deleted (${ids(merged) || "empty"})`, ids(merged) === "h1");
  ok("and the drop is counted", merged.kept.dropped === 1);

  // The mirror: this device deleted it, the cloud still has it.
  const back = mergeStore("ht_habits", phone, laptop, T(11), T(9), base);
  ok("a delete here is not undone by a stale cloud copy", ids(back) === "h1");
  ok("and the result is not what the cloud holds, so it has to be pushed", back.matchesRemote === false);
}

console.log("\n3. Delete and add are told apart by the ancestor, not by a clock");
{
  // The case the first attempt at this got wrong. h9 was added on the laptop
  // last Monday and has sat there unpushed all week: it is OLDER than the
  // ancestor blob, and absent from it. A timestamp rule reads that as a
  // delete and eats a week-old habit. The recorded id set does not.
  const stale = [habit("h1", "a", T(9)), habit("h9", "added Monday, never pushed", T(9))];
  const cloud = [habit("h1", "a", T(9))];
  const neverHadIt = agreed(cloud, T(11)); // the ancestor is newer than h9 is

  ok("an old item the ancestor never held is an ADD",
    ids(mergeStore("ht_habits", stale, cloud, T(9), T(11), neverHadIt)) === "h1,h9");

  // Same shapes, same clocks — only the ancestor differs.
  const hadIt = agreed(stale, T(11));
  ok("the same item, when the ancestor DID hold it, is a DELETE",
    ids(mergeStore("ht_habits", stale, cloud, T(9), T(11), hadIt)) === "h1");

  ok("and with no ancestor at all, nothing is treated as deleted",
    ids(mergeStore("ht_habits", stale, cloud, T(9), T(11), null)) === "h1,h9");
  ok("nor with an ancestor that has no id list (too large, or from an older build)",
    ids(mergeStore("ht_habits", stale, cloud, T(9), T(11), { ts: T(11), ids: null })) === "h1,h9");
}

console.log("\n4. It converges — two devices must not trade writes forever");
{
  const a = [habit("h1", "a", T(9)), habit("h2", "b", T(10))];
  const b = [habit("h1", "a", T(9)), habit("h2", "b", T(10))];
  const base = agreed(a, T(10));
  const first = mergeStore("ht_habits", a, b, T(10), T(10), base);
  ok("merging identical sets reports no change", first.changed === false);
  ok("and reports that the cloud already has it", first.matchesRemote === true);
  const second = mergeStore("ht_habits", first.value, b, T(10), T(10), base);
  ok("merging again is still a no-op", second.changed === false);
  ok("so nothing is re-pushed", ids(first) === ids(second));
}

console.log("\n5. Union stores: ids but no per-item timestamps");
{
  const s = (id, note = "") => ({ id, date: "2026-08-01", note });
  const laptop = [s("s1"), s("s2")];
  const phone = [s("s1"), s("s3")];
  const merged = mergeStore("gym_sessions", laptop, phone, T(9), T(10), agreed([s("s1")], T(9)));
  ok(`both devices' sessions are kept (${ids(merged)})`, ids(merged) === "s1,s2,s3");

  // Deletes work here too — the ancestor answers it without needing a
  // per-item timestamp, which is the whole reason UNION used to have to
  // resurrect them.
  ok("a delete the ancestor witnessed is honoured",
    ids(mergeStore("gym_sessions", [s("s1"), s("s2")], [s("s1")], T(9), T(11), agreed([s("s1"), s("s2")], T(9)))) === "s1");
  ok("and without an ancestor a session is never dropped",
    ids(mergeStore("gym_sessions", [s("s1"), s("s2")], [s("s1")], T(9), T(11), null)) === "s1,s2");

  // What UNION still cannot do: decide which of two edits to the SAME record
  // is newer. The newer blob wins that one, exactly as LWW would.
  const edited = mergeStore("gym_sessions", [s("s1", "mine")], [s("s1", "theirs")], T(9), T(10), agreed([s("s1")], T(9)));
  ok("a record edited on both sides goes to the newer blob", edited.value[0].note === "theirs");
}

console.log("\n6. Nothing merges by accident");
{
  ok("an unlisted store keeps today's behaviour", !isMergeable("finance_state"));
  ok("and resolves by last-write-wins", mergeStore("finance_state", { a: 1 }, { a: 2 }, T(9), T(10)).value.a === 2);
  ok("with the older side losing", mergeStore("finance_state", { a: 1 }, { a: 2 }, T(11), T(10)).value.a === 1);

  // A store on the list whose value is not a list of identified items must
  // fall back rather than mangle it.
  ok("a mergeable key holding an unexpected shape falls back to LWW",
    mergeStore("ht_habits", { nope: true }, { nope: false }, T(9), T(10)).strategy === LWW);
  ok("as does a list of bare values", mergeStore("ht_habits", [1, 2], [3], T(9), T(10)).strategy === LWW);
  ok("and one whose items have no id", mergeStore("ht_habits", [{ name: "x" }], [], T(9), T(10)).strategy === LWW);
}

console.log("\n7. The strategy table is deliberate");
{
  const timed = Object.entries(STRATEGY).filter(([, v]) => v === TIMED).map(([k]) => k);
  ok(`only the timestamped stores get full resolution (${timed.join(", ")})`,
    timed.every((k) => k.startsWith("ht_")) && timed.length === 3);
  ok("every entry names a real strategy", Object.values(STRATEGY).every((v) => v === TIMED || v === UNION));
  ok("and the default for anything unlisted is LWW", (STRATEGY.some_new_store || LWW) === LWW);
}

// ── The protocol, not just the function ──────────────────────────────
// Everything above tests mergeStore in isolation. That is not the thing that
// broke: the bug lived in WHEN sync.js merges and what it does with the
// result. So this runs the actual protocol — two devices, one cloud, edits
// interleaved — and asserts on the state both devices end up in.
//
// A simulation can drift away from the code it claims to model, so §9 reads
// sync.js and refuses to pass if the real pull and push paths stop calling
// mergeStore. The two halves are only meaningful together.

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
let clock = Date.parse(T(9));
const now = () => new Date((clock += 60000)).toISOString();

const cloudNew = () => ({});                      // key → { value, updated_at }
const device = (name) => ({ name, store: {}, meta: {}, base: {}, dirty: new Set() });

/** Put both devices and the cloud in one already-agreed state. */
function seed(cloud, devices, key, value, ts) {
  cloud[key] = { value: clone(value), updated_at: ts };
  for (const d of devices) {
    d.store[key] = clone(value);
    d.meta[key] = ts;
    d.base[key] = ancestorOf(clone(value), ts);
  }
}

/** A local edit: writes the store, stamps it, queues the push. */
function edit(dev, key, fn) {
  dev.store[key] = fn(clone(dev.store[key]));
  dev.meta[key] = now();
  dev.dirty.add(key);
}

/** sync.js applyRow(), for every row the cloud holds. Returns rows written. */
function pull(dev, cloud) {
  for (const [key, row] of Object.entries(cloud)) {
    const localTs = dev.meta[key] || "";
    const remoteTs = row.updated_at || "";
    const lt = Date.parse(localTs) || 0;
    const rt = Date.parse(remoteTs) || 0;
    const merged = mergeStore(key, dev.store[key], clone(row.value), localTs, remoteTs, dev.base[key] || null);
    if (merged.changed) {
      dev.store[key] = merged.value;
      dev.meta[key] = rt > lt ? remoteTs : now();
    }
    if (merged.matchesRemote) dev.base[key] = ancestorOf(clone(row.value), remoteTs);
    if (lt > rt || !merged.matchesRemote) dev.dirty.add(key);
  }
  for (const key of Object.keys(dev.store)) if (!(key in cloud)) dev.dirty.add(key);
}

/** sync.js flush(). Returns the number of rows it actually wrote. */
function push(dev, cloud) {
  let wrote = 0;
  for (const key of [...dev.dirty]) {
    const localTs = dev.meta[key] || "";
    const rt = cloud[key];
    let value = clone(dev.store[key]);
    let stamp = localTs || now();
    if (value == null) { dev.dirty.delete(key); continue; }
    if (rt) {
      const merged = mergeStore(key, value, clone(rt.value), localTs, rt.updated_at, dev.base[key] || null);
      if (merged.changed) {
        stamp = now();
        value = merged.value;
        dev.store[key] = clone(value);
        dev.meta[key] = stamp;
      } else if (merged.strategy === LWW && (Date.parse(rt.updated_at) || 0) > (Date.parse(localTs) || 0)) {
        dev.store[key] = clone(rt.value);
        dev.meta[key] = rt.updated_at;
        dev.base[key] = ancestorOf(clone(rt.value), rt.updated_at);
        dev.dirty.delete(key);
        continue;
      }
    }
    cloud[key] = { value: clone(value), updated_at: stamp };
    dev.base[key] = ancestorOf(clone(value), stamp);
    dev.dirty.delete(key);
    wrote++;
  }
  return wrote;
}

/** Let the devices talk until the cloud stops changing. Returns the number of
 *  rounds it took — the point of which is that it is FINITE. Two devices that
 *  each think the other is behind will push at each other forever, and that
 *  failure looks like working sync until the battery dies. */
function settle(devices, cloud, max = 8) {
  for (let round = 1; round <= max; round++) {
    let wrote = 0;
    for (const d of devices) { pull(d, cloud); wrote += push(d, cloud); }
    if (!wrote) return round;
  }
  return Infinity;
}

const list = (dev, key) => (dev.store[key] || []).map((x) => x.id).sort().join(",");

console.log("\n8. Two devices, one cloud: the whole protocol");
{
  console.log("   the reported bug, end to end");
  const cloud = cloudNew();
  const laptop = device("laptop"), phone = device("phone");
  seed(cloud, [laptop, phone], "ht_habits", [habit("h1", "Deep work", T(9)), habit("h2", "Read", T(9))], T(9));

  // Laptop adds a habit and syncs it up.
  edit(laptop, "ht_habits", (v) => [...v, habit("h3", "Stretch", now())]);
  push(laptop, cloud);

  // The phone has been asleep and has never seen h3. It renames h1 and
  // pushes — the exact sequence that used to delete h3 from both devices.
  edit(phone, "ht_habits", (v) => v.map((x) => (x.id === "h1" ? { ...x, name: "Deep work 90m", updatedAt: now() } : x)));
  push(phone, cloud);

  ok(`the cloud still has the laptop's habit (${cloud.ht_habits.value.map((x) => x.id).sort().join(",")})`,
    cloud.ht_habits.value.map((x) => x.id).sort().join(",") === "h1,h2,h3");

  const rounds = settle([laptop, phone], cloud);
  ok(`both devices agree, in ${rounds} round(s)`, list(laptop, "ht_habits") === "h1,h2,h3" && list(phone, "ht_habits") === "h1,h2,h3");
  ok("and the phone's rename survived on the laptop",
    laptop.store.ht_habits.find((x) => x.id === "h1").name === "Deep work 90m");

  console.log("   and it converges rather than trading writes");
  ok("a settled pair is quiet", Number.isFinite(rounds));
  ok("nothing is left queued", laptop.dirty.size === 0 && phone.dirty.size === 0);
  const stamp = cloud.ht_habits.updated_at;
  settle([laptop, phone], cloud);
  ok("another full round writes nothing", cloud.ht_habits.updated_at === stamp);
  ok("and both stores are byte-identical",
    JSON.stringify(laptop.store.ht_habits.map((x) => x.id).sort()) === JSON.stringify(phone.store.ht_habits.map((x) => x.id).sort()));
}

{
  console.log("   a delete still reaches the other device");
  const cloud = cloudNew();
  const laptop = device("laptop"), phone = device("phone");
  seed(cloud, [laptop, phone], "ht_habits",
    [habit("h1", "a", T(9)), habit("h2", "b", T(9)), habit("h3", "c", T(9))], T(9));

  edit(phone, "ht_habits", (v) => v.filter((x) => x.id !== "h2"));
  push(phone, cloud);
  settle([laptop, phone], cloud);

  ok(`the laptop drops it too (${list(laptop, "ht_habits")})`, list(laptop, "ht_habits") === "h1,h3");
  ok("and it does not come back on the next round", (settle([laptop, phone], cloud), list(laptop, "ht_habits") === "h1,h3"));
  ok("nor in the cloud", cloud.ht_habits.value.map((x) => x.id).sort().join(",") === "h1,h3");
}

{
  console.log("   a device edited offline while the other one moved on");
  const cloud = cloudNew();
  const laptop = device("laptop"), phone = device("phone");
  seed(cloud, [laptop, phone], "ht_habits", [habit("h1", "a", T(9))], T(9));

  // Phone goes offline and adds two habits over the week.
  edit(phone, "ht_habits", (v) => [...v, habit("p1", "phone one", now())]);
  edit(phone, "ht_habits", (v) => [...v, habit("p2", "phone two", now())]);
  // Meanwhile the laptop adds one and syncs normally.
  edit(laptop, "ht_habits", (v) => [...v, habit("l1", "laptop one", now())]);
  push(laptop, cloud);
  // Phone reconnects: sync.js pulls before it flushes.
  settle([phone, laptop], cloud);

  ok(`every habit from both devices is present (${list(phone, "ht_habits")})`, list(phone, "ht_habits") === "h1,l1,p1,p2");
  ok("on the laptop as well", list(laptop, "ht_habits") === "h1,l1,p1,p2");
}

{
  console.log("   untimestamped logs: Body routines and sessions");
  const cloud = cloudNew();
  const a = device("a"), b = device("b");
  seed(cloud, [a, b], "gym_routines", [{ id: "r1", name: "Push" }], T(9));

  edit(a, "gym_routines", (v) => [...v, { id: "r2", name: "Pull" }]);
  edit(b, "gym_routines", (v) => [...v, { id: "r3", name: "Legs" }]);
  settle([a, b], cloud);

  ok(`both routines survive (${list(a, "gym_routines")})`, list(a, "gym_routines") === "r1,r2,r3");
  ok("and the two devices match", list(a, "gym_routines") === list(b, "gym_routines"));
}

{
  console.log("   a config blob is still last-write-wins, not merged");
  const cloud = cloudNew();
  const a = device("a"), b = device("b");
  seed(cloud, [a, b], "finance_state", { emergencyTarget: 10000 }, T(9));

  edit(a, "finance_state", () => ({ emergencyTarget: 12000 }));
  push(a, cloud);
  edit(b, "finance_state", () => ({ emergencyTarget: 15000 }));
  settle([b, a], cloud);

  ok("the later edit wins outright", cloud.finance_state.value.emergencyTarget === 15000);
  ok("with no trace of the earlier one", !("mergedFrom" in cloud.finance_state.value));
  ok("and both devices hold it", a.store.finance_state.emergencyTarget === 15000 && b.store.finance_state.emergencyTarget === 15000);
}

console.log("\n9. The real sync.js does what the simulation above assumes");
{
  const src = readFileSync(new URL("../../src/shared/sync.js", import.meta.url), "utf8");
  // The body of one top-level function: its signature through the next
  // closing brace in column 1.
  const body = (sig) => {
    const i = src.indexOf(sig);
    if (i < 0) return "";
    const j = src.indexOf("\n}", i);
    return j < 0 ? src.slice(i) : src.slice(i, j);
  };
  const pullPath = body("function applyRow(");
  const pushPath = body("export async function flush(");

  ok("sync.js imports the merge layer", /import \{[^}]*\bmergeStore\b[^}]*\} from "\.\/merge\.js"/.test(src));
  ok("the pull path exists and merges", pullPath.length > 0 && /mergeStore\(/.test(pullPath));
  ok("the push path exists and merges BEFORE upserting",
    pushPath.length > 0 && pushPath.indexOf("mergeStore(") > -1
    && pushPath.indexOf("mergeStore(") < pushPath.indexOf(".upsert("));
  ok("both paths record the common ancestor", /stampBase\(/.test(pullPath) && /stampBase\(/.test(pushPath));
  ok("the ancestor is read back when merging", /readBase\(\)/.test(pullPath) && /readBase\(\)/.test(pushPath));
  ok("and it is recorded as a version, not a bare timestamp",
    [...src.matchAll(/stampBase\(([^)]*)\)/g)].every((m) => /ancestorOf\(/.test(m[1])));
  // The regression that produced the "offline device loses its edits" case:
  // the pull path must not call the cloud's version the ancestor while it is
  // still holding items the cloud has never seen.
  ok("the pull path only records an ancestor the cloud actually holds",
    /matchesRemote\)?\s*stampBase\(|if \(merged\.matchesRemote\) stampBase\(/.test(pullPath));

  // applyExternal is also the path that writes a MERGED value the cloud has
  // never seen. It used to record the ancestor itself, which is precisely how
  // an offline device's unpushed edits came to look like deletions.
  const store = readFileSync(new URL("../../src/shared/useStorageState.js", import.meta.url), "utf8");
  const applyExternal = (() => {
    const i = store.indexOf("export function applyExternal(");
    const j = store.indexOf("\n}", i);
    return i < 0 ? "" : store.slice(i, j < 0 ? store.length : j);
  })();
  ok("applyExternal records no ancestor of its own",
    applyExternal.length > 0 && !/stampBase\(/.test(applyExternal));

  // The other half of the original diagnosis: a local stamp ends in "Z" and
  // Postgres returns "+00:00", so comparing the strings gets the same instant
  // wrong. Every comparison has to go through Date.parse.
  const stringCompare = src
    .split("\n")
    .filter((l) => /(localTs|remoteTs|updated_at|updatedAt)\s*[<>]|[<>]\s*(localTs|remoteTs|row\.updated_at)/.test(l))
    .filter((l) => !/Date\.parse/.test(l));
  ok(`no timestamp is compared as a string${stringCompare.length ? ` — found: ${stringCompare[0].trim()}` : ""}`,
    stringCompare.length === 0);
}

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Sync merge: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
