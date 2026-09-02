// ── Sync conflict resolution ─────────────────────────────────────────
// The whole point of merge.js is that two devices editing while offline
// end up with both sets of trades rather than one of them. These tests
// are that claim, stated as arithmetic on record ids.
//
// Run: node tests/merge.test.mjs
import {
  mergeCollection, mergeTombstones, mergeValue, removedIds, recordTime,
  isCollection, TOMBSTONE_TTL_DAYS,
} from "../src/sync/merge.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n          got  ${g}\n          want ${w}`); }
};

const t = (id, createdAt, extra = {}) => ({ id, createdAt, ...extra });
const ids = (list) => list.map((r) => r.id);

// ── The case the whole design exists for ─────────────────────────────
// Phone logs t2 offline. Laptop logs t3 offline. Neither has seen the
// other. A whole-value last-write-wins would keep one array and silently
// drop the other's trade.
{
  const phone = [t("t1", "2026-09-01T09:00:00Z"), t("t2", "2026-09-02T10:00:00Z")];
  const laptop = [t("t1", "2026-09-01T09:00:00Z"), t("t3", "2026-09-02T11:00:00Z")];
  const merged = mergeCollection(phone, laptop, "2026-09-02T10:00:00Z", "2026-09-02T11:00:00Z");
  eq("two devices logging offline keep both trades", ids(merged), ["t1", "t2", "t3"]);
}

// ── Per-record recency ───────────────────────────────────────────────
{
  const local = [t("t1", "2026-09-01T09:00:00Z", { note: "local", editedAt: "2026-09-03T08:00:00Z" })];
  const remote = [t("t1", "2026-09-01T09:00:00Z", { note: "remote", editedAt: "2026-09-03T09:00:00Z" })];
  eq("the more recently edited copy of a record wins",
    mergeCollection(local, remote)[0].note, "remote");
  eq("and the older one loses even when it is the local side",
    mergeCollection(remote, local)[0].note, "remote");
}
{
  // editedAt beats createdAt as the record's time: an old trade edited
  // today is newer than one created yesterday and never touched.
  const local = [t("t1", "2026-01-01T00:00:00Z", { note: "edited today", editedAt: "2026-09-03T00:00:00Z" })];
  const remote = [t("t1", "2026-09-02T00:00:00Z", { note: "created later" })];
  eq("editedAt outranks createdAt", mergeCollection(local, remote)[0].note, "edited today");
  eq("recordTime prefers editedAt", recordTime({ createdAt: "a", editedAt: "b" }), "b");
  eq("recordTime falls back to createdAt", recordTime({ createdAt: "a" }), "a");
  eq("recordTime of a timeless record is empty", recordTime({ id: "x" }), "");
}
{
  // Records with no time of their own — phases, accounts — fall back to
  // when their whole key was last written.
  const local = [{ id: "ph_a1", start: 540 }];
  const remote = [{ id: "ph_a1", start: 600 }];
  eq("timeless records fall back to the key timestamp (remote newer)",
    mergeCollection(local, remote, "2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z")[0].start, 600);
  eq("timeless records fall back to the key timestamp (local newer)",
    mergeCollection(local, remote, "2026-09-03T00:00:00Z", "2026-09-02T00:00:00Z")[0].start, 540);
  eq("an exact tie keeps local, so a sync round rewrites nothing",
    mergeCollection(local, remote, "2026-09-02T00:00:00Z", "2026-09-02T00:00:00Z")[0].start, 540);
}

// ── Deletion ─────────────────────────────────────────────────────────
{
  const local = [t("t1", "2026-09-01T00:00:00Z")];
  const remote = [t("t1", "2026-09-01T00:00:00Z"), t("t2", "2026-09-01T00:00:00Z")];
  eq("without a tombstone an absent record is treated as not-yet-arrived",
    ids(mergeCollection(local, remote)), ["t1", "t2"]);
  eq("a tombstone newer than the record deletes it",
    ids(mergeCollection(local, remote, "", "", { t2: "2026-09-02T00:00:00Z" })), ["t1"]);
  eq("a tombstone older than the record does not — the id was re-used",
    ids(mergeCollection(local, remote, "", "", { t2: "2026-08-01T00:00:00Z" })), ["t1", "t2"]);
}
{
  // A delete on one device must survive the other device pushing its own
  // copy back up. This is the round that used to resurrect trades.
  const deleted = [t("t1", "2026-09-01T00:00:00Z")];
  const stale = [t("t1", "2026-09-01T00:00:00Z"), t("t2", "2026-09-01T00:00:00Z")];
  const tombs = { trades: { t2: "2026-09-02T00:00:00Z" } };
  const merged = mergeValue("trades", deleted, stale, "2026-09-02T00:00:00Z", "2026-09-01T00:00:00Z", tombs);
  eq("a deletion survives the other device pushing its copy back", ids(merged), ["t1"]);
}

// mergeValue is what sync actually calls, and the routing inside it is a
// separate thing to get wrong: if it sent collections down the
// whole-value path, every test above would still pass while the app lost
// trades. So assert the two paths disagree, through the real entry point.
{
  const phone = [t("t1", "2026-09-01T00:00:00Z"), t("t2", "2026-09-02T00:00:00Z")];
  const laptop = [t("t1", "2026-09-01T00:00:00Z"), t("t3", "2026-09-02T00:00:00Z")];
  // Local is newer by key time, so whole-value LWW would return [t1,t2]
  // and drop t3 — a result that looks perfectly plausible.
  eq("mergeValue merges a collection rather than picking a side",
    ids(mergeValue("trades", phone, laptop, "2026-09-03T00:00:00Z", "2026-09-02T00:00:00Z")),
    ["t1", "t2", "t3"]);
  eq("and the same holds when the remote side is the newer one",
    ids(mergeValue("trades", phone, laptop, "2026-09-02T00:00:00Z", "2026-09-03T00:00:00Z")),
    ["t1", "t2", "t3"]);
  eq("reviews merge too, not just trades",
    ids(mergeValue("reviews", [t("r1", "2026-09-01")], [t("r2", "2026-09-01")], "2026-09-02T00:00:00Z", "")),
    ["r1", "r2"]);
}

// ── Ordering ─────────────────────────────────────────────────────────
{
  const local = [t("b", "2026-09-01T00:00:00Z"), t("z", "2026-09-01T00:00:00Z")];
  const remote = [t("a", "2026-09-01T00:00:00Z"), t("z", "2026-09-01T00:00:00Z")];
  // "a" exists only in the cloud and sorts first alphabetically; it must
  // still land last, or the list a user is looking at jumps mid-sync.
  eq("local order is preserved, cloud-only records append",
    ids(mergeCollection(local, remote)), ["b", "z", "a"]);
}

// ── Shapes that are not collections ──────────────────────────────────
{
  eq("a settings object is whole-value last-write-wins",
    mergeValue("gates", { cap: 3 }, { cap: 5 }, "2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z"), { cap: 5 });
  eq("and keeps local when local is newer",
    mergeValue("gates", { cap: 3 }, { cap: 5 }, "2026-09-03T00:00:00Z", "2026-09-02T00:00:00Z"), { cap: 3 });
  eq("a boolean flag merges the same way",
    mergeValue("seeded", false, true, "", "2026-09-02T00:00:00Z"), true);
  eq("trades is a collection", isCollection("trades"), true);
  eq("gates is not", isCollection("gates"), false);
}

// ── Junk in ──────────────────────────────────────────────────────────
{
  eq("a missing remote side leaves local intact",
    ids(mergeCollection([t("t1", "x")], undefined)), ["t1"]);
  eq("a non-array remote side is ignored, not crashed on",
    ids(mergeCollection([t("t1", "x")], { nope: true })), ["t1"]);
  eq("records without an id are dropped rather than colliding",
    mergeCollection([{ no: "id" }], [t("t1", "x")]).length, 1);
  eq("null entries are skipped",
    ids(mergeCollection([null, t("t1", "x")], [])), ["t1"]);
}

// ── Tombstone housekeeping ───────────────────────────────────────────
{
  const now = Date.UTC(2026, 8, 2);
  const fresh = new Date(now - 5 * 86400000).toISOString();
  const old = new Date(now - (TOMBSTONE_TTL_DAYS + 5) * 86400000).toISOString();
  const merged = mergeTombstones(
    { trades: { a: fresh, b: old } },
    { trades: { a: "2026-09-01T00:00:00Z" }, reviews: { r1: fresh } },
    now,
  );
  eq("the later removal time wins", merged.trades.a, "2026-09-01T00:00:00Z");
  eq("tombstones past the TTL are forgotten", merged.trades.b, undefined);
  eq("other collections merge alongside", merged.reviews.r1, fresh);
  eq("mergeValue routes the tombstones key to its own rule",
    mergeValue("tombstones", { trades: { a: "2026-09-01T00:00:00Z" } }, { trades: { a: "2026-09-02T00:00:00Z" } }).trades.a,
    "2026-09-02T00:00:00Z");
  eq("junk tombstone entries are dropped", mergeTombstones({ trades: { a: 42 } }, null, now), {});
}

// ── removedIds: what write() uses to notice a delete ─────────────────
{
  eq("removedIds names the ids that disappeared",
    removedIds([t("a", "x"), t("b", "x"), t("c", "x")], [t("a", "x"), t("c", "x")]), ["b"]);
  eq("an unchanged array removes nothing",
    removedIds([t("a", "x")], [t("a", "x")]), []);
  eq("an addition removes nothing",
    removedIds([t("a", "x")], [t("a", "x"), t("b", "x")]), []);
  eq("clearing everything removes everything",
    removedIds([t("a", "x"), t("b", "x")], []), ["a", "b"]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
