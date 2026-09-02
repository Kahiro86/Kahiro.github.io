// ── Conflict resolution ──────────────────────────────────────────────
// The naive answer to "the same key changed on two devices" is
// last-write-wins on the whole value. For a settings object that is
// right. For `trades` it is data loss: log a trade on your phone and
// another on your laptop while both are offline, and whichever syncs
// second replaces the other's entire array. One of those trades is gone
// and nothing tells you.
//
// So collections merge per record instead, keyed by the stable `id` every
// record already carries:
//
//   · present on both sides  → the copy edited more recently wins
//   · present on one side    → kept, unless it was deleted (below)
//
// Deletion is the reason a union is not enough on its own. If a record is
// simply absent from one side, the union cannot tell "deleted here" from
// "never arrived here", and a deleted trade would reappear on every sync.
// So deletes leave a tombstone — the id and when it was removed — and a
// record is dropped when a tombstone for it is newer than the record
// itself. Re-logging an id later still wins, because its edit time is
// then newer than the tombstone.
//
// Tombstones are pruned after TOMBSTONE_TTL_DAYS. The consequence is
// worth stating plainly: a device that has been offline longer than that,
// holding a record deleted elsewhere, will bring it back. Deleting it
// again is the fix, and the alternative — keeping every tombstone
// forever — is a store that only ever grows.

/** Keys whose value is an array of records with an `id`. */
export const COLLECTIONS = ["trades", "reviews", "accounts", "phases"];
export const isCollection = (key) => COLLECTIONS.includes(key);

export const TOMBSTONE_TTL_DAYS = 90;

/** When this record was last touched. Trades keep `editedAt`; the rest
 *  only have a creation stamp, which still separates "created before the
 *  other side's copy" from "created after". Records with neither fall
 *  back to the key-level timestamp, which is what the caller passes in. */
export const recordTime = (r) => (r && (r.editedAt || r.updatedAt || r.createdAt)) || "";

const byId = (list) => {
  const m = new Map();
  for (const r of Array.isArray(list) ? list : []) {
    if (r && typeof r === "object" && r.id != null) m.set(String(r.id), r);
  }
  return m;
};

/**
 * Union two record arrays by id.
 * @param localTs/remoteTs  key-level edit times, used only to break ties
 *                          between records that carry no time of their own.
 * @param tombs             { [id]: isoTime } for this collection.
 */
export function mergeCollection(local, remote, localTs = "", remoteTs = "", tombs = {}) {
  const L = byId(local);
  const R = byId(remote);

  const chosen = new Map();
  for (const [id, l] of L) {
    const r = R.get(id);
    if (!r) { chosen.set(id, l); continue; }
    const lt = recordTime(l) || localTs;
    const rt = recordTime(r) || remoteTs;
    chosen.set(id, rt > lt ? r : l); // ties keep local: no pointless rewrite
  }
  for (const [id, r] of R) if (!L.has(id)) chosen.set(id, r);

  // Drop anything a newer tombstone says was deleted.
  for (const [id, rec] of chosen) {
    const t = tombs?.[id];
    if (t && t > (recordTime(rec) || "")) chosen.delete(id);
  }

  // Order falls out of how `chosen` was filled: local ids in their own
  // order first, then whatever only the cloud had. That is the order we
  // want — an open list must not reshuffle under the user mid-sync — so
  // this is a property to keep in mind when editing above, not a step.
  return [...chosen.values()];
}

/** Union two tombstone maps, keeping the later removal time, and forget
 *  anything past the TTL. Shape: { collection: { id: isoTime } }. */
export function mergeTombstones(local, remote, now = Date.now()) {
  const cutoff = new Date(now - TOMBSTONE_TTL_DAYS * 86400000).toISOString();
  const out = {};
  for (const src of [local, remote]) {
    if (!src || typeof src !== "object") continue;
    for (const [coll, ids] of Object.entries(src)) {
      if (!ids || typeof ids !== "object") continue;
      for (const [id, t] of Object.entries(ids)) {
        const ts = typeof t === "string" ? t : "";
        if (!ts || ts < cutoff) continue;
        (out[coll] ||= {});
        if (ts > (out[coll][id] || "")) out[coll][id] = ts;
      }
    }
  }
  return out;
}

/**
 * The one entry point sync uses. Returns the value to store for `key`.
 * Everything that is not a collection stays whole-value last-write-wins:
 * a settings object has no records to merge, and half of one device's
 * settings crossed with half of another's is worse than either.
 */
export function mergeValue(key, local, remote, localTs = "", remoteTs = "", tombstones = {}) {
  if (key === "tombstones") return mergeTombstones(local, remote);
  if (isCollection(key) && (Array.isArray(local) || Array.isArray(remote))) {
    return mergeCollection(local, remote, localTs, remoteTs, tombstones?.[key] || {});
  }
  return remoteTs > localTs ? remote : local;
}

/** Ids that vanished between two versions of a collection — the deletions
 *  a write performed. Computed from the arrays themselves, so every delete
 *  path in the app is covered without any of them having to remember. */
export function removedIds(prev, next) {
  const stillThere = byId(next);
  const gone = [];
  for (const id of byId(prev).keys()) if (!stillThere.has(id)) gone.push(id);
  return gone;
}
