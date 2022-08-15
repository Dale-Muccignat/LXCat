import { aql } from "arangojs";
import { ArrayCursor } from "arangojs/cursor";
import { CrossSectionSetHeading, CrossSectionSetItem } from "../public";
import { VersionInfo } from "../../shared/types/version_info";
import { db } from "../../db";
import {
  StateSelected,
  generateStateFilterAql,
  ParticleLessStateChoice,
} from "../../shared/queries/state";

export interface FilterOptions {
  contributor: string[];
  state: StateSelected;
}

export interface SortOptions {
  field: "name" | "contributor";
  dir: "ASC" | "DESC";
}

export interface PagingOptions {
  offset: number;
  count: number;
}

export async function search(
  filter: FilterOptions,
  sort: SortOptions,
  paging: PagingOptions
) {
  let contributor_aql = aql``;
  if (filter.contributor.length > 0) {
    contributor_aql = aql`FILTER ${filter.contributor} ANY == contributor`;
  }
  let stateAql = aql``;
  if (Object.keys(filter.state).length > 0) {
    const stateFilter = generateStateFilterAql(filter.state);
    stateAql = aql`
      LET states = (
        FOR m IN IsPartOf
          FILTER m._to == css._id
          FOR cs IN CrossSection
            FILTER cs._id == m._from
            FOR r in Reaction
              FILTER r._id == cs.reaction
              FOR c IN Consumes
                FILTER c._from == r._id
                FOR s IN State
                  FILTER s._id == c._to
                  FILTER s.particle != 'e'
                  LET e = s.electronic[0] // TODO is there always 0 or 1 electronic array item?
                  FILTER ${stateFilter}
                  RETURN s.id
      )
      FILTER LENGTH(states) > 0
    `;
  }
  let sort_aql = aql``;
  if (sort.field === "name") {
    sort_aql = aql`SORT css.name ${sort.dir}`;
  } else if (sort.field === "contributor") {
    sort_aql = aql`SORT contributor ${sort.dir}`;
  }
  const limit_aql = aql`LIMIT ${paging.offset}, ${paging.count}`;
  const q = aql`
      FOR css IN CrossSectionSet
          FILTER css.versionInfo.status == 'published' // Public API can only search on published sets
          ${stateAql}
          LET contributor = FIRST(
              FOR o IN Organization
                  FILTER o._id == css.organization
                  RETURN o.name
          )
          ${contributor_aql}
          ${sort_aql}
          ${limit_aql}
          RETURN MERGE({'id': css._key, contributor}, UNSET(css, ["_key", "_rev", "_id"]))
      `;
  const cursor: ArrayCursor<CrossSectionSetHeading> = await db().query(q);
  return await cursor.all();
}

export interface StateChoice extends ParticleLessStateChoice {
  particle: string;
}

export interface Facets {
  contributor: string[];
  state: StateChoice[];
}

export async function searchFacets(): Promise<Facets> {
  return {
    contributor: await searchContributors(),
    state: await stateChoices(),
  };
}

async function searchContributors() {
  const cursor: ArrayCursor<string> = await db().query(aql`
      FOR css IN CrossSectionSet
          FOR o IN Organization
              FILTER o._id == css.organization
              RETURN DISTINCT o.name
      `);
  return await cursor.all();
}

export async function stateChoices(): Promise<StateChoice[]> {
  const cursor: ArrayCursor<StateChoice> = await db().query(aql`
    FOR css IN CrossSectionSet
        FILTER css.versionInfo.status == 'published'
        FOR p IN IsPartOf
            FILTER p._to == css._id
            FOR cs IN CrossSection
                FILTER cs._id == p._from
                FOR r in Reaction
                    FILTER r._id == cs.reaction
                    FOR c IN Consumes
                        FILTER c._from == r._id
                        FOR s IN State
                            FILTER s._id == c._to
                            FILTER s.particle != 'e' // TODO should e be filtered out?
                            COLLECT particle = s.particle INTO groups
                            LET electronic = UNION(
                              (
                              // TODO for each type collect the choices
                              FOR type IN SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'HomonuclearDiatom'].s.type)
                                RETURN {
                                    type,
                                    e: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'HomonuclearDiatom'].s.electronic[*].e)),
                                    Lambda: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'HomonuclearDiatom'].s.electronic[*].Lambda)),
                                    S: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'HomonuclearDiatom'].s.electronic[*].S)),
                                    parity: FLATTEN(SORTED_UNIQUE(groups[*].s.electronic[*].parity)),
                                    reflection: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'HomonuclearDiatom'].s.electronic[*].reflection)),
                                    // TODO collect vibrational
                                  }
                              ), (
                              FOR type IN SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'AtomLS'].s.type)
                                RETURN {
                                    type,
                                    term: {
                                      L: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'AtomLS'].s.electronic[*].term.L)),
                                      S: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'AtomLS'].s.electronic[*].term.S)),
                                      P: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'AtomLS'].s.electronic[*].term.P)),
                                      J: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'AtomLS'].s.electronic[*].term.J)),
                                    }
                                }
                              ), (
                              FOR type IN SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'LinearTriatomInversionCenter'].s.type)
                                RETURN {
                                    type,
                                    e: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'LinearTriatomInversionCenter'].s.electronic[*].e)),
                                    Lambda: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'LinearTriatomInversionCenter'].s.electronic[*].Lambda)),
                                    S: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'LinearTriatomInversionCenter'].s.electronic[*].S)),
                                    parity: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'LinearTriatomInversionCenter'].s.electronic[*].parity)),
                                    reflection: FLATTEN(SORTED_UNIQUE(groups[* FILTER CURRENT.s.type == 'LinearTriatomInversionCenter'].s.electronic[*].parity)),
                                }
                              )
                            )
                            RETURN MERGE({
                              particle,
                              charge: SORTED_UNIQUE(groups[*].s.charge),
                            }, LENGTH(electronic) > 0 ? {electronic} : {})
    `);
    // TODO when there is one choice then there is no choices and choice should be removed
  return await cursor.all();
}

export async function byId(id: string) {
  const cursor: ArrayCursor<CrossSectionSetItem> = await db().query(aql`
      FOR css IN CrossSectionSet
          FILTER css._key == ${id}
          FILTER ['published' ,'retracted', 'archived'] ANY == css.versionInfo.status
          LET processes = (
              FOR m IN IsPartOf
                  FILTER m._to == css._id
                  FOR cs IN CrossSection
                      FILTER cs._id == m._from
                      LET refs = (
                          FOR rs IN References
                              FILTER rs._from == cs._id
                              FOR r IN Reference
                                  FILTER r._id == rs._to
                                  RETURN UNSET(r, ["_key", "_rev", "_id"])
                          )
                      LET reaction = FIRST(
                          FOR r in Reaction
                              FILTER r._id == cs.reaction
                              LET consumes = (
                                  FOR c IN Consumes
                                  FILTER c._from == r._id
                                      FOR c2s IN State
                                      FILTER c2s._id == c._to
                                      RETURN {state: UNSET(c2s, ["_key", "_rev", "_id"]), count: c.count}
                              )
                              LET produces = (
                                  FOR p IN Produces
                                  FILTER p._from == r._id
                                      FOR p2s IN State
                                      FILTER p2s._id == p._to
                                      RETURN {state: UNSET(p2s, ["_key", "_rev", "_id"]), count: p.count}
                              )
                              RETURN MERGE(UNSET(r, ["_key", "_rev", "_id"]), {"lhs":consumes}, {"rhs": produces})
                      )
                      RETURN MERGE(
                          UNSET(cs, ["_key", "_rev", "_id", "organization"]),
                          { "id": cs._key, reaction, "reference": refs}
                      )
              )
          LET contributor = FIRST(
              FOR o IN Organization
                  FILTER o._id == css.organization
                  RETURN o.name
          )
          RETURN MERGE({'id': css._key, processes, contributor}, UNSET(css, ["_key", "_rev", "_id", "organization"]))
      `);

  return await cursor.next();
}

export interface KeyedVersionInfo extends VersionInfo {
  _key: string;
  name: string;
}

/**
 * Finds all previous versions of set with key
 */
export async function historyOfSet(key: string) {
  const id = `CrossSectionSet/${key}`;
  const cursor: ArrayCursor<KeyedVersionInfo> = await db().query(aql`
    FOR h
      IN 0..9999999
      ANY ${id}
      CrossSectionSetHistory
      FILTER h.versionInfo.status != 'draft'
      SORT h.versionInfo.version DESC
      RETURN MERGE({_key: h._key, name: h.name}, h.versionInfo)
  `);
  return await cursor.all();
}

/**
 * Find published/retracted css of archived version
 */
export async function activeSetOfArchivedSet(key: string) {
  // TODO use query on some page
  const id = `CrossSectionSet/${key}`;
  const cursor: ArrayCursor<string> = await db().query(aql`
    FOR h
      IN 0..9999999
      ANY ${id}
      CrossSectionSetHistory
      FILTER ['published' ,'retracted'] ANY == h.versionInfo.status
      RETURN MERGE({_key: h._key, name: h.name}, h.versionInfo)
  `);
  return await cursor.next();
}
