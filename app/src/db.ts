import { Database } from "arangojs";
import { parse_state } from "./shared/parse";
import { CSL } from "./shared/types/csl";
import { AtomicGenerator, MolecularGenerator } from "./shared/types/generators";
import { Reaction } from "./shared/types/reaction";
import { DBState, InState } from "./shared/types/state";
import { Dict } from "./shared/types/util";

export const db = new Database({
    url: process.env.ARANGO_URL ?? 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB ?? 'lxcat',
    auth: {
        username: process.env.ARANGO_USERNAME ?? 'root',
        password: process.env.ARANGO_PASSWORD
    }
})

export async function insert_document(
	collection: string,
	object: any
): Promise<string> {
	const result = await db.query(
		"INSERT @object INTO @@collection LET r = NEW return r._id",
		{ object, "@collection": collection }
	);

	return result.next();
	/* return result.toArray()[0]; */
}

export async function upsert_document(
	collection: string,
	object: any
): Promise<{ id: string; new: boolean }> {
	if (typeof object === "string") object = { string: object };
	const result = await db.query(
		"UPSERT @object INSERT @object UPDATE {} IN @@collection LET ret = NEW RETURN { id: ret._id, new: OLD ? false : true }",
		{ object, "@collection": collection }
	);

	return result.next();
}

export async function insert_edge(
	collection: string,
	from: string,
	to: string,
	properties: any = {}
): Promise<string> {
	const edge_object = { _from: from, _to: to };

	const result = await db.query(
		"UPSERT @from_to INSERT @edge UPDATE {} IN @@collection LET ret = NEW RETURN ret._id",
		{
			"@collection": collection,
			from_to: edge_object,
			edge: { ...edge_object, ...properties },
		}
	);

	return result.next();
}

export async function insert_state_dict(
	states: Dict<InState<any>>
): Promise<Dict<string>> {
	const id_dict: Dict<string> = {};

	for (const [id, state] of Object.entries(states)) {
		// FIXME: Newer TS is pickier, see https://github.com/microsoft/TypeScript/wiki/Breaking-Changes#generic-type-parameters-are-implicitly-constrained-to-unknown
		// id_dict[id] = await insert_state_tree(state);
	}

	return id_dict;
}

async function insert_state<T>(
	state: DBState<T>
): Promise<{ id: string; new: boolean }> {
	return upsert_document('State', state);
}

// FIXME: Newer TS is pickier, see https://github.com/microsoft/TypeScript/wiki/Breaking-Changes#generic-type-parameters-are-implicitly-constrained-to-unknown
// async function insert_state_tree<T extends AtomicGenerator<E, any>, E>(
// 	state: InState<T>
// ): Promise<string>;
// async function insert_state_tree<
// 	T extends MolecularGenerator<E, V, R, any>,
// 	E,
// 	V,
// 	R
// >(state: InState<T>): Promise<string> {
// 	// FIXME: This function assumes that compound states on multiple levels
// 	// are not supported.
// 	/* Strategy Add states in a top down fashion.  Compound levels should
// 	 * be treated differently from singular levels.
// 	 */
// 	const in_compound: Array<string> = [];
// 	let ret_id = "";

// 	let tmp_state = { ...state };
// 	delete tmp_state.type;
// 	delete tmp_state.electronic;

// 	// FIXME: Link top level states to particle.
// 	const t_ret = await insert_state(parse_state(tmp_state));
// 	ret_id = t_ret.id;

// 	if (state.electronic) {
// 		tmp_state = { ...state };

// 		for (const elec of state.electronic) {
// 			tmp_state.electronic = [{ ...elec }];
// 			delete tmp_state.electronic[0].vibrational;

// 			/* console.log(state_to_string(tmp_state)); */
// 			const e_ret = await insert_state(parse_state(tmp_state));
// 			if (e_ret.new)
// 				await insert_edge('HasDirectSubstate', t_ret.id, e_ret.id);

// 			if (elec.vibrational) {
// 				for (const vib of elec.vibrational) {
// 					tmp_state.electronic[0].vibrational = [{ ...vib }];
// 					delete tmp_state.electronic[0].vibrational[0].rotational;

// 					/* console.log(state_to_string(tmp_state)); */
// 					const v_ret = await insert_state(parse_state(tmp_state));
// 					if (v_ret.new)
// 						await insert_edge('HasDirectSubstate', e_ret.id, v_ret.id);

// 					if (vib.rotational) {
// 						for (const rot of vib.rotational) {
// 							tmp_state.electronic[0].vibrational[0].rotational = [{ ...rot }];
// 							/* console.log(state_to_string(tmp_state)); */
// 							const r_ret = await insert_state(parse_state(tmp_state));
// 							if (r_ret.new)
// 								await insert_edge(
// 									'HasDirectSubstate',
// 									v_ret.id,
// 									r_ret.id
// 								);

// 							in_compound.push(r_ret.id);
// 							ret_id = r_ret.id;
// 						}
// 					} else {
// 						in_compound.push(v_ret.id);
// 						ret_id = v_ret.id;
// 					}
// 				}
// 			} else {
// 				in_compound.push(e_ret.id);
// 				ret_id = e_ret.id;
// 			}
// 		}

// 		if (in_compound.length > 1) {
// 			const c_ret = await insert_state(parse_state(state));
// 			if (c_ret.new) {
// 				for (const sub_id of in_compound) {
// 					await insert_edge('InCompound', sub_id, c_ret.id);
// 				}
// 			}
// 			return c_ret.id;
// 		}
// 	}

// 	return ret_id;
// }

// TODO: Check what happens when adding a string instead of a 'Reference' object.
export async function insert_reference_dict(
	references: Dict<CSL.Data | string>
): Promise<Dict<string>> {
	const id_dict: Dict<string> = {};

	for (const [id, reference] of Object.entries(references)) {
		id_dict[id] = (await upsert_document('Reference', reference)).id;
	}

	return id_dict;
}

export async function insert_reaction_with_dict(
	dict: Dict<string>,
	reaction: Reaction<string>
): Promise<string> {
	// Insert all states.
	// Insert the reaction and connect all states using 'Consumes'
	// and 'Produces' edges. Annotate them with the count.

	// FIXME: Check whether a reaction already exists.
	const r_id = await insert_document('Reaction', {
		reversible: reaction.reversible,
		type_tags: reaction.type_tags,
	});

	for (const entry of reaction.lhs) {
		await insert_edge('Consumes', r_id, dict[entry.state], {
			count: entry.count,
		});
	}
	for (const entry of reaction.rhs) {
		await insert_edge('Produces', r_id, dict[entry.state], {
			count: entry.count,
		});
	}

	return r_id;
}