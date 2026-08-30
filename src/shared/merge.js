// ── Merging two versions of a store ──────────────────────────────────
// Sync is last-write-wins per KEY, and a key is a whole collection. That is
// fine for a config blob and wrong for a list: add a habit on the laptop,
// change anything on the phone before it pulls, and the phone's copy of
// `ht_habits` — which has never seen the new habit — wins wholesale. The
// addition is gone from both devices, with no error and nothing to undo.
//
// This resolves the two versions item by item instead.
//
// The hard part is not merging, it is telling a DELETE from an ADD. An item
// on one side only is either something that side just added, or something the
// other side just deleted, and the two look identical. Answering it needs the
// common ancestor: the version both devices last agreed on. `base.ids` is
// that answer — the set of ids in the last cloud version this device
// reconciled with:
//
//   in the ancestor, missing now  →  DELETED. Honour it.
//   not in the ancestor           →  ADDED.   Keep it.
//   no ancestor recorded          →  keep everything. A device that has never
//                                    reconciled cannot claim anything was
//                                    deleted, and resurrecting an item is a
//                                    tap to undo where losing one is not.
//
// I tried to do this with timestamps first — "an item changed after the
// ancestor's timestamp is an addition" — and it is wrong in an ordinary case:
// a habit added on the phone on Monday, still unpushed on Friday, is older
// than the ancestor blob and absent from it. The heuristic reads that as a
// delete and eats it. The id set has no such gap.
//
// Two strategies remain, and they now differ only in how they resolve an item
// BOTH sides changed:
//
//   TIMED  items carry updatedAt, so the newer item wins. ht_habits /
//          ht_entries / ht_routines — the stores the problem was reported
//          against.
//
//   UNION  items have ids but no per-item timestamp, so the newer blob decides
//          any id present on both sides — the same answer last-write-wins
//          would give for that one item, without touching the rest.
//
//   LWW    everything else. Config, scalars, single objects — where "the whole
//          value is one fact" is true and merging would be nonsense.
//
// Nothing merges by accident: a store not named in STRATEGY keeps today's
// behaviour exactly.

const at = (x) => {
  const t = Date.parse(x?.updatedAt || x?.createdAt || "");
  return Number.isFinite(t) ? t : -Infinity;
};

export const TIMED = "timed";
export const UNION = "union";
export const LWW = "lww";

/**
 * Which stores may be merged, and how. Deliberately a short, explicit list —
 * the default is LWW, so a store added tomorrow behaves exactly as it does
 * today until somebody decides otherwise here.
 */
export const STRATEGY = {
  // Every item carries updatedAt (localDb.js normHabit/normEntry/normRoutine).
  ht_habits: TIMED,
  ht_entries: TIMED,
  ht_routines: TIMED,

  // Ids, no per-item timestamp. Append-mostly records.
  gym_sessions: UNION,
  gym_routines: UNION,
  athlete_workouts: UNION,
  athlete_measurements: UNION,
  journal_entries: UNION,
  faith_church: UNION,
  faith_scripture: UNION,
  faith_notes: UNION,
  mind_notes: UNION,
  mind_decisions: UNION,
  mind_library: UNION,
  ict_trades: UNION,
  ti_trades: UNION,
  ti_lessons: UNION,
  missions: UNION,
  purity_urges: UNION,
};

const isList = (v) => Array.isArray(v);
const ident = (x) => (x && typeof x === "object" ? x.id : undefined);

/** The recorded ancestor as a lookup, or null when there isn't a usable one.
 *  Null is the safe answer: it means "keep everything", never "drop". */
const ancestor = (base) => (Array.isArray(base?.ids) ? new Set(base.ids) : null);

/**
 * Merge two versions of one store.
 *
 * @param key       the store name
 * @param local     the value on this device
 * @param remote    the value from the cloud
 * @param localTs   when this device last wrote the whole store (ISO)
 * @param remoteTs  when the cloud copy was written (ISO)
 * @param base      the last cloud version this device reconciled with,
 *                  `{ ts, ids }` — see the note above. Absent, or without an
 *                  id list, means nothing is treated as deleted.
 * @returns { value, changed, matchesRemote, strategy, kept }
 *          `changed` is false when the result equals `local`, so a no-op merge
 *          never re-pushes and the two devices converge instead of trading
 *          writes. `matchesRemote` is true when the result is exactly what the
 *          cloud already holds — the caller may only record a new ancestor
 *          then, because until it is true the two sides have not agreed on
 *          anything to be the ancestor OF.
 */
export function mergeStore(key, local, remote, localTs, remoteTs, base = null) {
  const strategy = STRATEGY[key] || LWW;
  const remoteNewer = (Date.parse(remoteTs || "") || 0) > (Date.parse(localTs || "") || 0);

  // A merge needs two lists of identified items. Anything else — a config
  // object, a scalar, a list of bare values — falls back to LWW, which is the
  // correct answer for those and the safe answer for a shape we did not expect.
  const mergeable = strategy !== LWW
    && isList(local) && isList(remote)
    && local.every((x) => ident(x) !== undefined)
    && remote.every((x) => ident(x) !== undefined);

  if (!mergeable) {
    const value = remoteNewer ? remote : local;
    return {
      value,
      changed: remoteNewer,
      matchesRemote: JSON.stringify(value) === JSON.stringify(remote),
      strategy: LWW,
      kept: { fromLocal: 0, fromRemote: 0, dropped: 0 },
    };
  }

  const wasAgreed = ancestor(base);
  const deletedElsewhere = (id) => wasAgreed !== null && wasAgreed.has(id);

  const byId = new Map();
  const kept = { fromLocal: 0, fromRemote: 0, dropped: 0 };
  const remoteIds = new Set(remote.map(ident));

  for (const item of local) byId.set(ident(item), { item, side: "local" });

  for (const item of remote) {
    const id = ident(item);
    const mine = byId.get(id);
    if (!mine) {
      // Only in the cloud: an addition there, unless it was in the version we
      // both agreed on — in which case this device deleted it.
      if (deletedElsewhere(id)) { kept.dropped++; continue; }
      byId.set(id, { item, side: "remote" });
      continue;
    }
    // In both: TIMED takes the newer item, UNION lets the newer blob decide.
    const takeRemote = strategy === TIMED ? at(item) > at(mine.item) : remoteNewer;
    if (takeRemote) byId.set(id, { item, side: "remote" });
  }

  // The mirror of the rule above, for items only on this device.
  for (const [id, entry] of [...byId]) {
    if (entry.side !== "local" || remoteIds.has(id)) continue;
    if (deletedElsewhere(id)) { byId.delete(id); kept.dropped++; }
  }

  const value = [...byId.values()].map((x) => x.item);
  for (const x of byId.values()) (x.side === "local" ? kept.fromLocal++ : kept.fromRemote++);

  // Order is not meaningful in these stores (every reader sorts), so equality
  // is by id set plus each item's content — not by position.
  const same = (other) => other.length === value.length
    && other.every((x) => {
      const m = byId.get(ident(x));
      return m && JSON.stringify(m.item) === JSON.stringify(x);
    });

  return { value, changed: !same(local), matchesRemote: same(remote), strategy, kept };
}

/** True when merging this store could produce something neither side had. */
export const isMergeable = (key) => (STRATEGY[key] || LWW) !== LWW;

/** The ancestor record to store once a version is genuinely agreed on.
 *  Beyond the cap the id list is dropped rather than truncated: a partial
 *  ancestor would report real items as never-agreed, and the merge would
 *  resurrect deletions rather than lose data. */
const MAX_ANCESTOR_IDS = 20000;
export function ancestorOf(value, ts) {
  if (!isList(value)) return { ts, ids: null };
  const ids = value.map(ident);
  if (ids.length > MAX_ANCESTOR_IDS || ids.some((id) => id === undefined)) return { ts, ids: null };
  return { ts, ids };
}
