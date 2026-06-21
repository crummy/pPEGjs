// pPEGpy -- JavaScript translation of peg.py (ES2020+)

/**
 * @typedef {0 | 1 | 2 | 3} RuleDef
 * Encoded rule definition kind: "=", ":", ":=", or "=:".
 */

/**
 * @typedef {["id", number]} IdOp
 * @typedef {["alt", RuntimeExpr[]]} AltOp
 * @typedef {["seq", RuntimeExpr[]]} SeqOp
 * @typedef {["rept", number, number, RuntimeExpr]} ReptOp
 * @typedef {["pred", "!" | "&", RuntimeExpr]} PredOp
 * @typedef {["neg", RuntimeExpr]} NegOp
 * @typedef {["quote", string, boolean]} QuoteOp
 * @typedef {["class", string]} ClassOp
 * @typedef {["dot"]} DotOp
 * @typedef {["noop"]} NoopOp
 * @typedef {["ext", ExtensionFn, string[]]} ExtOp
 * @typedef {["err", string]} ErrOp
 * @typedef {IdOp | AltOp | SeqOp | ReptOp | PredOp | NegOp | QuoteOp | ClassOp | DotOp | NoopOp | ExtOp | ErrOp} RuntimeExpr
 */

/**
 * Parsed grammar expression node.
 *
 * The compiler consumes the pPEG parse tree directly, so this intentionally
 * stays broad enough for all grammar node payloads.
 *
 * @typedef {[string, any]} GrammarExpr
 */

/**
 * A parse tree node returned by {@link Parse#ptree}.
 *
 * Leaves are `[name, text]`; branches are `[name, children]`. The compiler
 * also consumes bootstrap grammar arrays with this same broad tuple shape.
 *
 * @typedef {[string, any]} PtreeNode
 */

/** @typedef {[PtreeNode[], number]} PtreeWalk */
/** @typedef {[unknown[], number]} TransformWalk */
/** @typedef {[boolean, unknown]} TransformResult */
/** @typedef {(value: unknown) => unknown} TransformFn */
/** @typedef {(parse: Parse, args: string[]) => boolean} ExtensionFn */
/** @typedef {Record<string, TransformFn>} TransformMap */
/** @typedef {Record<string, ExtensionFn>} ExtensionMap */

/**
 * @typedef {object} CodeOptions
 * @property {PtreeNode | null} [boot] Bootstrap parse tree used before the PEG grammar can parse itself.
 * @property {TransformMap} [transforms] Transform callbacks keyed by rule name, or `rule:` for named wrapping.
 * @property {ExtensionMap} [extras] Extension callbacks keyed by extension command name.
 */

// -- pPEG grammar -------------------------------------------------------

const peg_grammar = `
Peg   = _ rule+
rule  = id _ def _ alt
def   = '=' ':'? / ':' '='?
alt   = seq ('/' _ seq)*
seq   = rep+
rep   = pre sfx? _
pre   = pfx? term
term  = call / quote / class / dot / group / extn
group = '(' _ alt ')'
call  = id _ !def
id    = [a-zA-Z_] [a-zA-Z0-9_-]*
pfx   = [~!&]
sfx   = [+?] / '*' nums?
nums  = min ('..' max)?
min   = [0-9]+
max   = [0-9]*
quote = ['] ~[']* ['] 'i'?
class = '[' ~']'* ']'
dot   = '.'
extn  = '<' ~'>'* '>'
_     = ([ \\t\\n\\r]+ / '#' ~[\\n\\r]*)*
`;

// -- rule type ----------------------------------------------------------

const DEFS = ["=", ":", ":=", "=:"];
const EQ = 0; // =    dynamic children: 0 => TERM, 1 => redundant, 2.. => HEAD
const ANON = 1; // :    rule name and results not in the parse tree
const HEAD = 2; // :=   parent node with any number of children
const TERM = 3; // =:   terminal leaf node text match

// -- parse tree nodes ---------------------------------------------------

const FAULT = 0xf000; // any flag bit (top nibble in 16 bit id)
const FAIL = 0x2000; // rule failed to match
const DROP = 0x1000; // back-track seq failed
const ID_VAL = 0x0fff; // 12 bit id mask (only expect to need 10 bits)

export class Node {
	/**
	 * @param {number} id Rule id with optional FAIL/DROP flag bits.
	 * @param {number} depth Nesting depth in the trace/tree.
	 * @param {number} start Inclusive input offset.
	 * @param {number} end Exclusive input offset.
	 */
	constructor(id, depth, start, end) {
		/** @type {number} */
		this.id = id;
		/** @type {number} */
		this.depth = depth;
		/** @type {number} */
		this.start = start;
		/** @type {number} */
		this.end = end;
	}
	/** @returns {number} Rule id without trace flags. */
	idx() {
		return this.id & ID_VAL;
	}
	/** @returns {boolean} True when the node carries a FAIL or DROP flag. */
	fault() {
		return (this.id & FAULT) !== 0;
	}
	/** @returns {Node} */
	clone() {
		return new Node(this.id, this.depth, this.start, this.end);
	}
	/** @returns {string} */
	toString() {
		const id = this.id & ID_VAL;
		const fail = (this.id & FAIL) > 0 ? "!" : " ";
		const drop = (this.id & DROP) > 0 ? "-" : " ";
		return `${this.start}..${this.end} ${this.depth} ${fail}${drop} ${id}`;
	}
}

// -- Parse context for parser run function ------------------------------

export class Parse {
	/**
	 * @param {Code} code Compiled parser code.
	 * @param {string} input Input text to parse.
	 * @param {number} [start=-1] Inclusive input offset; negative means start at 0.
	 * @param {number} [end=-1] Exclusive input offset; negative means parse through input length.
	 */
	constructor(code, input, start = -1, end = -1) {
		/** @type {boolean} */
		this.ok = true;
		/** @type {Code} */
		this.code = code;
		/** @type {string} */
		this.input = input;
		/** @type {number} */
		this.pos = start < 0 ? 0 : start;
		/** @type {number} */
		this.end = end < 0 ? input.length : end;

		/** @type {Node[]} Trace nodes for parse record, debugging, and error reporting. */
		this.trace = []; // trace nodes parse record, debug and error reporting
		/** @type {Node[] | null} Trace pruned into a parse tree. */
		this.tree = null; // tree is trace pruned of redundant nodes

		// Run state.
		/** @type {boolean} */
		this.anon = false; // true when running anon rules
		/** @type {number} */
		this.rule = 0; // current rule idx
		/** @type {number} */
		this.deep = 0; // tree depth, named deep to avoid depth() conflicts
		/** @type {number} */
		this.max_deep = 255; // catch left recursion

		// Faults.
		/** @type {number} */
		this.index = 0; // parse tree length, for fall-back resets
		/** @type {number} */
		this.max_pos = 0; // peak fail pos
		/** @type {number} */
		this.max_trace = 0; // peak fail trace index
		/** @type {number} */
		this.max_tree = 0; // peak fail tree index (adjusted in prune)

		// Expected seq fail candidates.
		/** @type {number} */
		this.max_seq_pos = 0; // seq fail pos
		/** @type {RuntimeExpr | null} */
		this.max_seq_op = null; // seq fail op code
		/** @type {RuntimeExpr | null} */
		this.expected = null; // max_seq_op at max_pos

		// Special case faults.
		/** @type {boolean} */
		this.fell_short = false; // fell short end pos
		/** @type {[RuntimeExpr[], number] | null} */
		this.empty_alt = null; // [alt, index]

		// State for extensions.
		/** @type {Record<string, unknown>} */
		this.extra_state = {};
	}

	/** @returns {string} */
	toString() {
		return this.ok ? show_tree(this) : err_report(this);
	}

	/** @param {number} i @returns {string} */
	name(i) {
		const tree = /** @type {Node[]} */ (this.tree);
		return this.code.names[tree[i].id & ID_VAL];
	} // parse tree node name
	/** @param {number} i @returns {string} */
	text(i) {
		const tree = /** @type {Node[]} */ (this.tree);
		return this.input.slice(tree[i].start, tree[i].end);
	} // matched text

	/** @param {number} i @returns {boolean} True if the parse tree node is terminal. */
	leaf(i) {
		const tree = /** @type {Node[]} */ (this.tree);
		if (this.code.defs[tree[i].id & ID_VAL] === HEAD) return false;
		if (i + 1 >= tree.length) return true;
		return tree[i + 1].depth <= tree[i].depth;
	}

	/** @returns {PtreeNode | []} */
	ptree() {
		const [pt] = p_tree(this, 0, 0);
		if (!pt || pt.length === 0) return [];
		return pt[0];
	}

	/** @returns {TransformResult} */
	transform() {
		if (!(this.ok && this.tree)) return [false, this];
		const [result] = transformer(this, 0, 0);
		if (result.length === 1) return [true, result[0]];
		return [true, result];
	}

	/** @returns {void} */
	print_trace() {
		dump_trace(this);
	}
	/** @returns {void} */
	print_tree() {
		dump_tree(this);
	}

	/** @param {number} id @returns {boolean} */
	run(id) {
		return run(this, ["id", id]);
	}

	/**
	 * Run a rule against the exact span covered by an existing node.
	 *
	 * @param {number} id Rule id to run.
	 * @param {Node} node Node whose span should be matched.
	 * @returns {boolean}
	 */
	match(id, node) {
		const pos = this.pos;
		const end = this.end;
		this.end = this.pos;
		this.pos = node.start;
		const result = this.run(id);
		const pos1 = this.pos;
		this.end = end;
		this.pos = pos;
		return result && pos1 === pos;
	}
}

// -- the parser function itself -----------------------------------------

/**
 * Parse input with compiled code.
 *
 * @param {Code} code
 * @param {string} input
 * @param {number} [start=-1]
 * @param {number} [end=-1]
 * @returns {Parse}
 */
function parser(code, input, start = -1, end = -1) {
	const parse = new Parse(code, input, start, end);
	if (!code.ok) {
		// bad code..
		parse.ok = false;
		return parse;
	}
	let ok = run(parse, ["id", 0]);
	if (!ok) parse.trace[0].id |= FAIL;
	if (ok && parse.pos < parse.end) {
		parse.fell_short = true;
		ok = false;
	}
	parse.ok = ok;
	if (ok) {
		// delete trace faults and redundant nodes
		parse.tree = prune_tree(parse); // good tree
	} else {
		// keeps faults but deletes redundant nodes
		parse.tree = prune_trace(parse); // bad tree
	}
	return parse;
}

// -- the run engine that does all the work ------------------------------

/**
 * Execute one runtime expression against the mutable parse context.
 *
 * @param {Parse} parse
 * @param {RuntimeExpr} expr
 * @returns {boolean}
 */
function run(parse, expr) {
	const op = expr[0];

	if (op === "id") {
		const idx = expr[1];
		// Execute anon ids.
		if (parse.anon) {
			return run(parse, parse.code.codes[idx]);
		}

		const defx = parse.code.defs[idx];
		if (defx === ANON) {
			parse.anon = true;
			const ok = run(parse, parse.code.codes[idx]);
			parse.anon = false;
			return ok;
		}

		// All other ids.
		parse.rule = idx;
		const pos = parse.pos;
		const depth = parse.deep;
		parse.deep++;
		if (parse.deep > parse.max_deep) {
			throw new Error(`*** run away recursion, in: ${parse.code.names[idx]}`);
		}

		// Parse tree array: enter node.
		const index = parse.index; // this node == trace.length
		parse.index++;
		parse.trace.push(new Node(idx, depth, pos, 0));

		// Run.
		if (defx === TERM) parse.anon = true;
		let ok = run(parse, parse.code.codes[idx]); // ok = true | false
		if (defx === TERM) parse.anon = false;

		// Parse trace.
		parse.trace[index].end = parse.pos;
		if (!ok) {
			parse.trace[index].id |= FAIL;
			if (parse.pos > pos && parse.pos > parse.max_pos) {
				// first non-empty max hit
				parse.max_pos = parse.pos;
				parse.max_trace = index;
				parse.expected = null;
				if (parse.max_seq_pos === parse.pos) {
					parse.expected = parse.max_seq_op;
				}
			}
		}

		parse.deep--;
		return ok;
	}

	if (op === "alt") {
		const list = expr[1];
		let pos = parse.pos;
		let max = pos;
		for (let i = 0; i < list.length; i++) {
			if (run(parse, list[i])) {
				if (pos === parse.pos && i !== list.length - 1) {
					// for err report
					parse.empty_alt = [list, i];
				}
				return true;
			}
			if (parse.pos > pos) max = parse.pos;
			parse.pos = pos; // reset (essential)
		}
		parse.pos = max; // to be caught in id
		return false;
	}

	if (op === "seq") {
		const list = expr[1];
		const pos = parse.pos;
		let index = parse.index;
		const depth = parse.deep;
		for (let i = 0; i < list.length; i++) {
			if (!run(parse, list[i])) {
				if (i > 0 && parse.pos >= parse.max_pos) {
					parse.max_seq_pos = parse.pos;
					parse.max_seq_op = list[i]; // candidate for "expected"
				}
				while (index < parse.index) {
					const node = parse.trace[index];
					if (node.depth === depth) node.id |= DROP; // required for inline back-track
					index++;
				}
				return false;
			}
		}
		return true;
	}

	if (op === "rept") {
		const min = expr[1],
			max = expr[2],
			exp = expr[3];
		let pos = parse.pos;
		if (!run(parse, exp)) {
			if (min === 0) {
				parse.pos = pos;
				return true;
			} // * ?
			return false; // +
		}
		if (max === 1) return true; // ?
		let count = 1;
		while (true) {
			pos = parse.pos;
			const result = run(parse, exp);
			if (parse.pos === pos) break;
			if (!result) {
				parse.pos = pos;
				break;
			} // reset loop last try
			count++;
			if (count === max) break;
		}
		if (min > 0 && count < min) return false;
		return true;
	}

	if (op === "pred") {
		// !x &x
		const oper = expr[1],
			term = expr[2];
		let index = parse.index;
		const pos = parse.pos;
		const result = run(parse, term);
		parse.pos = pos; // reset
		while (index < parse.index) {
			parse.trace[index].id |= DROP;
			index++;
		} // parse tree fall-back
		return oper === "!" ? !result : result;
	}

	if (op === "neg") {
		// ~x
		const term = expr[1];
		if (parse.pos >= parse.end) return false;
		let index = parse.index;
		const pos = parse.pos;
		const result = run(parse, term);
		parse.pos = pos; // reset
		while (index < parse.index) {
			parse.trace[index].id |= DROP;
			index++;
		} // parse tree fall-back
		if (result) return false;
		parse.pos++;
		return true;
	}

	if (op === "quote") {
		const str = expr[1],
			ci = expr[2];
		for (let k = 0; k < str.length; k++) {
			// 'abc' compiler strips quotes
			if (parse.pos >= parse.end) return false;
			let char = parse.input[parse.pos];
			if (ci) char = char.toUpperCase();
			if (char !== str[k]) return false;
			parse.pos++;
		}
		return true;
	}

	if (op === "class") {
		const chars = expr[1];
		if (parse.pos >= parse.end) return false;
		const char = parse.input[parse.pos];
		const max = chars.length - 1; // eg [a-z0-9_]
		let i = 1;
		while (i < max) {
			const a = chars[i];
			if (i + 2 < max && chars[i + 1] === "-") {
				if (char >= a && char <= chars[i + 2]) {
					parse.pos++;
					return true;
				}
				i += 3;
			} else {
				if (char === a) {
					parse.pos++;
					return true;
				}
				i++;
			}
		}
		return false;
	}

	if (op === "dot") {
		if (parse.pos >= parse.end) return false;
		parse.pos++;
		return true;
	}

	if (op === "noop") return true;

	if (op === "ext") {
		// compiled from <some extension>
		const fn = expr[1];
		const args = expr[2];
		// Trust fn to reset fall-back on failure.
		return fn(parse, args);
	}

	throw new Error(
		`*** crash: run: undefined expression: ${JSON.stringify(expr)}`,
	);
}

// -- prune parse tree -- removes failures and redundant nodes -----------

/**
 * Remove failed/backtracked trace nodes and redundant wrapper nodes.
 *
 * @param {Parse} parse
 * @returns {Node[]}
 */
function prune_tree(parse) {
	/** @type {Node[]} */
	const tree = [];
	prune(parse, 0, 0, 0, tree);
	return tree;
}

/**
 * Recursive worker for {@link prune_tree}.
 *
 * @param {Parse} p Parse containing the trace array.
 * @param {number} i Trace index for the next candidate node.
 * @param {number} d Parent depth.
 * @param {number} n Depth reduction from deleted ancestor trace nodes.
 * @param {Node[]} tree Output parse tree.
 * @returns {number} Next trace index to process.
 */
function prune(p, i, d, n, tree) {
	const j = p.trace.length;
	while (i < j) {
		const dep = p.trace[i].depth;
		if (dep < d) break;
		const id = p.trace[i].id;
		if (id & FAULT) {
			// skip over FAIL or DROP trace nodes
			i++;
			while (i < j && p.trace[i].depth > dep) i++;
			continue;
		}
		const count = child_count(p, i + 1, dep + 1);
		if (count === 1 && p.code.defs[id & ID_VAL] !== HEAD) {
			// single child => skip redundant node
			i = prune(p, i + 1, dep + 1, n + 1, tree);
			continue;
		}
		const node = p.trace[i].clone();
		node.depth = dep - n;
		tree.push(node);
		i++;
	}
	return i;
}

/**
 * Count non-fault children at a specific depth, stopping after two.
 *
 * @param {Parse} p
 * @param {number} i First trace index to inspect.
 * @param {number} d Child depth to count.
 * @returns {number}
 */
function child_count(p, i, d) {
	let count = 0;
	const j = p.trace.length;
	while (i < j) {
		const dep = p.trace[i].depth;
		if (dep < d) break; // no more children at this depth
		if (dep === d) {
			// but don't count faults..
			if (p.trace[i].id & FAULT) {
				i++;
				while (i < j && p.trace[i].depth > dep) i++;
				continue;
			}
			count++;
			if (count > 1) return count; // second child
		}
		i++;
	}
	return count;
}

// -- prune trace for failed parse -- keeps failures but removes redundant nodes -------

// The full trace is too much for a fault report, so prune to a partial (failed) tree.
// Failed nodes (other than empty or re-parsed) are left in the incomplete parse tree.
// Redundant nodes are removed to simplify the parse tree for easier reading.

/**
 * Prune a failed parse trace for error reporting while preserving useful faults.
 *
 * @param {Parse} parse
 * @returns {Node[]}
 */
function prune_trace(parse) {
	/** @type {Node[]} */
	const tree = [];
	tidy(parse, 0, 0, 0, tree);
	return tree;
}

/**
 * Recursive worker for {@link prune_trace}.
 *
 * @param {Parse} p Parse containing the trace array.
 * @param {number} i Trace index for the next candidate node.
 * @param {number} d Parent depth.
 * @param {number} n Depth reduction from deleted ancestor trace nodes.
 * @param {Node[]} tree Output parse tree.
 * @returns {number} Next trace index to process.
 */
function tidy(p, i, d, n, tree) {
	const j = p.trace.length;
	while (i < j) {
		const dep = p.trace[i].depth;
		if (dep < d) break;
		const node = p.trace[i];
		const id = node.id;
		const k = can_be_skipped(p, i, node);
		if (k > i) {
			i = k;
			continue;
		}
		const count = child_trim_count(p, i + 1, dep + 1);
		if (count === 1 && p.code.defs[id & ID_VAL] !== HEAD) {
			// single child => skip redundant node
			i = tidy(p, i + 1, dep + 1, n + 1, tree);
			continue;
		}
		const clone = p.trace[i].clone();
		clone.depth = dep - n;
		if (i === p.max_trace) p.max_tree = tree.length;
		tree.push(clone);
		i++;
	}
	return i;
}

/**
 * Decide whether a failed trace node can be skipped in a failed parse tree.
 *
 * @param {Parse} p
 * @param {number} i Trace index for `node`.
 * @param {Node} node
 * @returns {number} Next trace index when skippable, otherwise -1.
 */
function can_be_skipped(p, i, node) {
	if ((node.id & FAULT) === 0) return -1;
	if (node.depth === 0) return -1; // don't skip failed root
	let j = i + 1; // next node
	while (j < p.trace.length && p.trace[j].depth > node.depth) {
		j++; // skip over any children...
	}
	if (!(j < p.trace.length)) return -1;
	if (node.start === node.end) return j; // skip empty faults
	if (p.trace[j].start === node.start) {
		return j; // skip: failed and re-parsed
	}
	return -1;
}

/**
 * Count children after applying failed-trace skip rules, stopping after two.
 *
 * @param {Parse} p
 * @param {number} i First trace index to inspect.
 * @param {number} d Child depth to count.
 * @returns {number}
 */
function child_trim_count(p, i, d) {
	let count = 0;
	const j = p.trace.length;
	while (i < j) {
		const dep = p.trace[i].depth;
		if (dep < d) break; // no more children at this depth
		if (dep === d) {
			const node = p.trace[i];
			const k = can_be_skipped(p, i, node);
			if (k > i) {
				i = k;
				continue;
			}
			count++;
			if (count > 1) return count; // second child
		}
		i++;
	}
	return count;
}

// -- ptree json ---------------------------------------------------------

/**
 * Convert a pruned tree into nested `[name, value]` arrays.
 *
 * @param {Parse} parse
 * @param {number} i Parse tree index to start at.
 * @param {number} d Depth to consume.
 * @returns {PtreeWalk}
 */
function p_tree(parse, i, d) {
	/** @type {PtreeNode[]} */
	const arr = [];
	const tree = /** @type {Node[]} */ (parse.tree);
	while (i < tree.length) {
		const dep = tree[i].depth;
		if (dep < d) break; // no more children at this depth
		if (parse.leaf(i)) {
			arr.push([parse.name(i), parse.text(i)]);
			i++;
		} else {
			const [children, i1] = p_tree(parse, i + 1, dep + 1);
			arr.push([parse.name(i), children]);
			i = i1;
		}
	}
	return [arr, i];
}

// -- ptree line diagram -------------------------------------------------

/**
 * Render a successful parse tree as an indented line diagram.
 *
 * @param {Parse} parse
 * @returns {string}
 */
function show_tree(parse) {
	const lines = [];
	const tree = /** @type {Node[]} */ (parse.tree);
	for (let i = 0; i < tree.length; i++) {
		const value = parse.leaf(i) ? ` ${JSON.stringify(parse.text(i))}` : "";
		lines.push(`${indent_bars(tree[i].depth)}${parse.name(i)}${value}`);
	}
	return lines.join("\n");
}

// -- print debug dump of trace nodes ------------------------------------

/**
 * Print the raw trace with failure/backtrack markers.
 *
 * @param {Parse} parse
 * @returns {void}
 */
function dump_trace(parse) {
	console.log("   Span    Trace...");
	let pos = 0; // input index last displayed
	let i = 0; // trace node index
	while (i < parse.trace.length) {
		const start = parse.trace[i].start;
		const end = parse.trace[i].end;
		let depth = parse.trace[i].depth;
		const next_depth = depth_of(parse, i + 1);
		if (pos < start) {
			const value = format_span(parse.input, pos, start);
			console.log(
				`${String(pos).padStart(4)}..${String(start).padEnd(4)} ${indent_bars(depth)}${value}`,
			);
			pos = start;
		}
		dump_node(parse, i, start, end, depth);
		if (pos < end && depth >= next_depth) pos = end;
		while (depth > next_depth) {
			// fill in text gap
			const parent = parent_of(parse, i, depth);
			const parent_end = parse.trace[parent].end;
			if (pos < parent_end) {
				const value = format_span(parse.input, pos, parent_end);
				console.log(
					`${String(pos).padStart(4)}..${String(parent_end).padEnd(4)} ${indent_bars(depth)}${value}`,
				);
				pos = parent_end;
			}
			depth--;
		}
		i++;
	}
	const eot = parse.end;
	if (pos < eot) {
		// show end text after pos: !'...end-text...'
		const max_node = parse.trace[parse.max_trace];
		const depth = max_node.depth;
		const value = `\x1b[1;41m!${format_span(parse.input, pos, eot)}\x1b[0m`;
		console.log(
			`${String(pos).padStart(4)}..${String(eot).padEnd(4)} ${indent_bars(depth)}${value}`,
		);
	}
}

/**
 * Print one raw trace node.
 *
 * @param {Parse} parse
 * @param {number} i Trace index.
 * @param {number} start Inclusive input offset.
 * @param {number} end Exclusive input offset.
 * @param {number} depth Trace depth.
 * @returns {void}
 */
function dump_node(parse, i, start, end, depth) {
	const id = parse.trace[i].id;
	let name;
	if (id & FAIL) {
		if (start === end) return;
		name = "\x1b[1;31m!" + parse.code.names[id & ID_VAL] + "\x1b[0m";
	} else if (id & DROP) {
		name = "\x1b[1;31m-" + parse.code.names[id & ID_VAL] + "\x1b[0m";
	} else {
		name = parse.code.names[id];
	}
	let value = format_span(parse.input, start, end);
	if (i + 1 < parse.trace.length && parse.trace[i + 1].depth > depth) {
		value = "\x1b[2;38;5;253m" + value + "\x1b[0m";
	}
	console.log(
		`${String(start).padStart(4)}..${String(end).padEnd(4)} ${indent_bars(depth)}${name} ${value}`,
	);
}

/**
 * Format a matched input span for debug/error output.
 *
 * @param {string} input
 * @param {number} start Inclusive input offset.
 * @param {number} end Exclusive input offset.
 * @returns {string}
 */
function format_span(input, start, end) {
	if (end - start < 50) return JSON.stringify(input.slice(start, end));
	return (
		JSON.stringify(input.slice(start, start + 30)) +
		" ... " +
		JSON.stringify(input.slice(start + 30, end))
	);
}

/**
 * Find the nearest preceding trace node shallower than depth `d`.
 *
 * @param {Parse} parse
 * @param {number} i Trace index to walk backward from.
 * @param {number} d Current depth.
 * @returns {number}
 */
function parent_of(parse, i, d) {
	while (i > 0) {
		i--;
		if (parse.trace[i].depth < d) return i;
	}
	return 0;
}

/**
 * Return a trace node depth, or 0 past the end of the trace.
 *
 * @param {Parse} parse
 * @param {number} i Trace index.
 * @returns {number}
 */
function depth_of(parse, i) {
	return i < parse.trace.length ? parse.trace[i].depth : 0;
}

// -- dump tree ----------------------------------------------------------

/**
 * Print the pruned parse tree with any remaining unparsed input highlighted.
 *
 * @param {Parse} parse
 * @returns {void}
 */
function dump_tree(parse) {
	const tree = /** @type {Node[]} */ (parse.tree);
	for (let i = 0; i < tree.length; i++) dump_tree_node(parse, i);
	// Print any remaining unparsed input.
	const eot = parse.end;
	const pos = Math.max(parse.pos, parse.max_pos);
	if (pos < eot) {
		let depth = 0;
		if (parse.max_tree < tree.length) {
			const max_node = tree[parse.max_tree];
			depth = max_node.depth;
		}
		const value = format_span(parse.input, pos, eot);
		console.log(`${indent_bars(depth)}\x1b[1;41m${value.slice(1, -1)}\x1b[0m`);
	}
}

/**
 * Print one pruned parse tree node.
 *
 * @param {Parse} parse
 * @param {number} i Parse tree index.
 * @returns {void}
 */
function dump_tree_node(parse, i) {
	const tree = /** @type {Node[]} */ (parse.tree);
	const node = tree[i];
	const id = node.id;
	if (id & FAULT && node.start === node.end) return;
	let name;
	if (id & FAIL) {
		name = "\x1b[1;31m!" + parse.code.names[id & ID_VAL] + "\x1b[0m";
	} else if (id & DROP) {
		name = "\x1b[1;31m-" + parse.code.names[id & ID_VAL] + "\x1b[0m";
	} else {
		name = parse.code.names[id];
	}
	name = parse.code.names[id & ID_VAL];
	const value =
		i + 1 === tree.length || tree[i + 1].depth <= node.depth
			? format_span(parse.input, node.start, node.end)
			: "";
	console.log(`${indent_bars(node.depth)}${name} ${value}`);
}

// -- Parse error reporting ----------------------------------------------

/**
 * Render a caret diagnostic at the furthest parse position.
 *
 * @param {Parse} parse
 * @param {string} [info=""] Additional diagnostic text after the caret.
 * @returns {string}
 */
function show_pos(parse, info = "") {
	const pos = Math.max(parse.pos, parse.max_pos);
	const sol = line_start(parse, pos - 1);
	const eol = line_end(parse, pos);
	const ln = line_number(parse.input, sol);
	const text = clean_chars(parse.input.slice(sol + 1, pos));
	const left = `line ${ln} | ${text}`;
	let prior = ""; // show previous line
	if (sol > 0) {
		const sol1 = line_start(parse, sol - 1);
		const text2 = clean_chars(parse.input.slice(sol1 + 1, sol));
		prior = `line ${ln - 1} | ${text2}\n`;
	}
	if (pos === parse.end) {
		return `${prior}${left}\n${" ".repeat(left.length)}^ ${info}`;
	}
	return `${prior}${left}${parse.input.slice(pos, eol)}\n${" ".repeat(left.length)}^ ${info}`;
}

/**
 * Replace control characters with spaces for stable caret positioning.
 *
 * @param {string} txt
 * @returns {string}
 */
function clean_chars(txt) {
	const cs = []; // tabs or ctl can throw off pos length count
	for (const c of txt) cs.push(c < " " ? " " : c);
	return cs.join("");
}

/**
 * Find the index before the start of the current line.
 *
 * @param {Parse} parse
 * @param {number} sol Starting input offset.
 * @returns {number}
 */
function line_start(parse, sol) {
	while (sol >= 0 && parse.input[sol] !== "\n") sol--;
	return sol;
}

/**
 * Find the end index of the current line.
 *
 * @param {Parse} parse
 * @param {number} eol Starting input offset.
 * @returns {number}
 */
function line_end(parse, eol) {
	while (eol < parse.end && parse.input[eol] !== "\n") eol++;
	return eol;
}

/**
 * Build a colored indentation prefix for tree diagrams.
 *
 * @param {number} size
 * @returns {string}
 */
function indent_bars(size) {
	return "\x1b[38;5;253m" + "│ ".repeat(size) + "\x1b[0m";
}

/**
 * Compute a 1-based line number for an input offset.
 *
 * @param {string} input
 * @param {number} i Input offset.
 * @returns {number}
 */
function line_number(input, i) {
	if (i < 0) return 1;
	if (i >= input.length) i = input.length - 1;
	let n = 1;
	while (i >= 0) {
		while (i >= 0 && input[i] !== "\n") i--;
		n++;
		i--;
	}
	return n;
}

/**
 * Explain the rule responsible for the furthest parse failure.
 *
 * @param {Parse} parse
 * @returns {string}
 */
function rule_info(parse) {
	// parse.fell_short means parsing succeeded before unexpected trailing input.
	if (parse.fell_short)
		return "unexpected input, parse ok on input before this";
	let note = " failed";
	if (parse.expected) {
		note = ` failed, expected: ${code_show(parse, parse.expected)}`;
	}
	return note;
}

/**
 * Convert a runtime expression to user-facing expected-token text.
 *
 * @param {Parse} parse
 * @param {RuntimeExpr} op
 * @returns {string | RuntimeExpr}
 */
function code_show(parse, op) {
	if (op[0] === "quote") {
		const quo = "'" + op[1] + "'";
		return op[2] ? quo + "i" : quo;
	}
	if (op[0] === "id") return parse.code.names[op[1]];
	return op;
}

/**
 * Map a compiled rule name back to its grammar source line when available.
 *
 * @param {Parse} parse
 * @param {string} name
 * @param {string} [note=""]
 * @returns {string}
 */
function src_map(parse, name, note = "") {
	const peg_parse = parse.code.peg_parse;
	if (!peg_parse || !peg_parse.tree) return name + note + " in boot-code...";
	const lines = [name + note];
	// Show grammar rule.
	for (let i = 0; i < peg_parse.tree.length - 1; i++) {
		if (peg_parse.name(i) !== "rule") continue;
		if (peg_parse.text(i + 1) === name) {
			lines.push(peg_parse.text(i).trim());
			break;
		}
	}
	return lines.join("\n");
}

/**
 * Report a suspicious empty alternative match, if one was observed.
 *
 * @param {Parse} parse
 * @returns {string}
 */
function empty_alt_report(parse) {
	if (parse.empty_alt === null) return "";
	const [list, i] = parse.empty_alt;
	const opt = list[i];
	const msg = `\n*** in: ${JSON.stringify(list)}`;
	if (opt[0] === "id") {
		return `${msg}\n    alternative '${parse.name(opt[1])}' was an empty '' match!`;
	}
	return `${msg}\n    alternative ${i} was an empty '' match!`;
}

/**
 * Render a complete grammar or parse failure report.
 *
 * @param {Parse} parse
 * @returns {string}
 */
function err_report(parse) {
	const at_pos = `at: ${Math.max(parse.pos, parse.max_pos)} of: ${parse.end}`;
	if (parse.code.err.length > 0) {
		const title = `*** grammar failed ${at_pos}`;
		const errs = parse.code.err.join("\n");
		return `${title}\n${errs}\n${show_pos(parse)}`;
	}
	parse.print_tree();
	const title = `*** parse failed ${at_pos}` + empty_alt_report(parse);
	return `${title}\n${show_pos(parse, rule_info(parse))}`;
}

// == pPEG ptree is compiled into a Code object with instructions for parser ======================

export class Code {
	/**
	 * @param {Parse | null} peg_parse Parse of the PEG grammar, or null for bootstrapping.
	 * @param {CodeOptions} [options]
	 */
	constructor(peg_parse, { boot = null, transforms = {}, extras = {} } = {}) {
		/** @type {Parse | null} */
		this.peg_parse = peg_parse; // Parse of Peg grammar (null for boot)
		this.ptree = /** @type {PtreeNode | []} */ (
			peg_parse ? peg_parse.ptree() : boot
		);
		/** @type {string[]} */
		this.names = []; // rule name
		/** @type {GrammarExpr[]} */
		this.rules = []; // rule body expr
		/** @type {RuntimeExpr[]} */
		this.codes = []; // compiled expr
		/** @type {RuleDef[]} */
		this.defs = []; // rule defn -> defx: EQ|ANON|HEAD|TERM
		/** @type {ExtensionMap} */
		this.extras = extras; // extension functions
		/** @type {TransformMap} */
		this.transforms = transforms; // transform fns 'rule':fn, or 'rule:':fn
		/** @type {string[]} */
		this.err = [];
		/** @type {boolean} */
		this.ok = true;
		this.compose();
	}

	/** @returns {void} */
	compose() {
		define_rules(this);
		for (const expr of this.rules) {
			// NOT map(), extensions need codes.length
			this.codes.push(emit(this, expr));
		}
		if (this.err.length > 0) this.ok = false;
	}

	/** @returns {string} */
	toString() {
		if (!this.ok) return `code error: ${this.err}`;
		const lines = [];
		for (let i = 0; i < this.names.length; i++) {
			lines.push(
				`${String(i).padStart(2)}: ${this.names[i]} ${DEFS[this.defs[i]]} ${JSON.stringify(this.codes[i])}`,
			);
		}
		return lines.join("\n");
	}

	/** @param {string} input @param {number} [start=-1] @param {number} [end=-1] @returns {Parse} */
	parse(input, start = -1, end = -1) {
		return parser(this, input, start, end);
	}
	/** @returns {string} */
	errors() {
		return this.err.join("\n");
	}
	/** @param {number} id @returns {string} */
	id_name(id) {
		return this.names[id];
	}
	/** @param {string} input @returns {TransformResult} */
	read(input) {
		return this.parse(input).transform();
	}

	/** @param {string} name @returns {number} */
	name_id(name) {
		const idx = this.names.indexOf(name);
		if (idx >= 0) return idx;
		this.err.push(`undefined rule: ${name}`);
		code_rule_defs(this, name, "=", ["extn", "<undefined>"]);
		return this.names.length - 1;
	}
}

// -- compile Parse into Code parser instructions ------------------------

/**
 * Populate rule names, source expressions, and definition kinds from a PEG ptree.
 *
 * @param {Code} code
 * @returns {void}
 */
function define_rules(code) {
	for (const rule of code.ptree[1]) {
		if (rule[0] !== "rule") {
			code.err.push(
				`Expected 'rule', is this a Peg ptree?\n ${JSON.stringify(rule)}`,
			);
			break;
		}
		const body = rule[1];
		if (body.length === 3 && body[0][0] === "id" && body[1][0] === "def") {
			code_rule_defs(code, body[0][1], body[1][1], body[2]);
		} else if (body.length === 2 && body[0][0] === "id") {
			// core peg grammar bootstrap
			code_rule_defs(code, body[0][1], "=", body[1]);
		} else {
			code.err.push(
				`Expected 'rule', is this a Peg ptree?\n ${JSON.stringify(rule)}`,
			);
			break;
		}
	}
}

/**
 * Register one grammar rule in the code object.
 *
 * @param {Code} code
 * @param {string} name
 * @param {string} defn Grammar definition token.
 * @param {GrammarExpr} expr Rule body expression.
 * @returns {void}
 */
function code_rule_defs(code, name, defn, expr) {
	if (code.names.includes(name)) code.err.push(`duplicate rule name: ${name}`);
	code.names.push(name);
	code.rules.push(expr);
	let defx = DEFS.indexOf(defn);
	if (defx < 0) {
		defx = EQ;
		code.err.push(`undefined: ${name} ${defn}`);
	}
	if (defx === EQ) {
		if (name[0] === "_") {
			defx = ANON;
		} else if (name[0] >= "A" && name[0] <= "Z") {
			defx = HEAD;
		}
	}
	code.defs.push(/** @type {RuleDef} */ (defx));
}

/**
 * Compile one parsed grammar expression into one runtime expression.
 *
 * @param {Code} code
 * @param {GrammarExpr} expr
 * @returns {RuntimeExpr}
 */
function emit(code, expr) {
	const op = expr[0];

	if (op === "id") {
		return ["id", code.name_id(expr[1])];
	}
	if (op === "alt") {
		return [
			"alt",
			expr[1].map(/** @param {GrammarExpr} x */ (x) => emit(code, x)),
		];
	}
	if (op === "seq") {
		return [
			"seq",
			expr[1].map(/** @param {GrammarExpr} x */ (x) => emit(code, x)),
		];
	}
	if (op === "rep") {
		const [exp, suffix] = expr[1];
		const sfxOp = suffix[0];
		if (sfxOp === "sfx") {
			let min = 0,
				max = 0;
			if (suffix[1] === "+") min = 1;
			else if (suffix[1] === "?") max = 1;
			return ["rept", min, max, emit(code, exp)];
		}
		if (sfxOp === "min") {
			const min = parseInt(suffix[1], 10);
			return ["rept", min, min, emit(code, exp)];
		}
		if (sfxOp === "nums") {
			const [minNode, maxNode] = suffix[1];
			const min = parseInt(minNode[1], 10);
			const max = maxNode && maxNode[1] ? parseInt(maxNode[1], 10) : 0;
			return ["rept", min, max, emit(code, exp)];
		}
	}
	if (op === "pre") {
		const [pfxNode, exp] = expr[1];
		const pfx = pfxNode[1];
		if (pfx === "~") return ["neg", emit(code, exp)];
		return ["pred", /** @type {"!" | "&"} */ (pfx), emit(code, exp)];
	}
	if (op === "quote") {
		const str = expr[1];
		if (str[str.length - 1] !== "i") {
			return ["quote", escape(str.slice(1, -1), code), false];
		}
		return ["quote", escape(str.slice(1, -2).toUpperCase(), code), true];
	}
	if (op === "class") {
		return ["class", escape(expr[1], code)];
	}
	if (op === "dot") {
		return ["dot"];
	}
	if (op === "extn") {
		return extension_op(code, expr[1]);
	}
	throw new Error(
		`*** crash: emit: undefined expression: ${JSON.stringify(expr)}`,
	);
}

// -- compile extensions -------------------------------------------------

/**
 * Compile a `<...>` grammar extension.
 *
 * @param {Code} code
 * @param {string} extend Extension source including angle brackets.
 * @returns {RuntimeExpr}
 */
function extension_op(code, extend) {
	const args = extend.slice(1, -1).split(/\s+/); // <command args...>
	const fn = code.extras[args[0]];
	if (fn) return ["ext", fn, args];
	if (args[0] === "to") return transform_ext(code, args); // <to JSON> builtin transforms
	const e = `*** Undefined extension: ${extend}`;
	code.err.push(e);
	return ["err", e];
}

/**
 * Convert a string to an integer when possible, otherwise a float.
 *
 * @param {unknown} s
 * @returns {number}
 */
function to_number(s) {
	const text = String(s);
	const n = parseInt(text, 10);
	if (!isNaN(n) && String(n) === text.trim()) return n;
	return parseFloat(text);
}

/** @type {TransformMap} */
const builtin_transforms = {
	Object: (x) => {
		if (Array.isArray(x)) {
			/** @type {Record<string, unknown>} */
			const obj = {};
			for (const [k, v] of x) obj[k] = v;
			return obj;
		}
		return {};
	},
	Array: (x) => (Array.isArray(x) ? x : []),
	String: (x) => String(x),
	Number: to_number,
};

/**
 * Register a built-in transform from a `<to ...>` extension.
 *
 * @param {Code} code
 * @param {string[]} args Extension command and arguments.
 * @returns {RuntimeExpr}
 */
function transform_ext(code, args) {
	let name = code.names[code.codes.length]; // current rule
	let fname = args.length > 1 ? args[1] : "$none";
	if (fname[0] === ":") {
		// <to type> or <to :type>
		name += ":";
		fname = fname.slice(1);
	}
	const fn = builtin_transforms[fname];
	if (fn) {
		code.transforms[name] = fn; // { 'name': fn, or 'name:': fn }
	} else {
		code.err.push(`*** Undefined transform: ${fname}`);
	}
	return ["noop"];
}

// -- escape codes -------------------------------------------------------

/**
 * Decode pPEG string/class escape sequences.
 *
 * @param {string} s
 * @param {Code} code
 * @returns {string}
 */
function escape(s, code) {
	let r = "";
	let i = 0;
	while (i < s.length) {
		/** @type {string | null} */
		let c = s[i];
		i++;
		if (c === "\\" && i < s.length) {
			const k = s[i];
			i++;
			if (k === "n") {
				c = "\n";
			} else if (k === "r") {
				c = "\r";
			} else if (k === "t") {
				c = "\t";
			} else if (k === "x") {
				const [v, j] = hex_value(2, s, i);
				c = v;
				i = j;
			} else if (k === "u") {
				const [v, j] = hex_value(4, s, i);
				c = v;
				i = j;
			} else if (k === "U") {
				const [v, j] = hex_value(8, s, i);
				c = v;
				i = j;
			} else {
				i--;
			}
			if (c === null) {
				code.err.push(`bad escape code: ${s}`);
				return s;
			}
		}
		r += c;
	}
	return r;
}

/**
 * Decode a fixed-width hexadecimal Unicode escape.
 *
 * @param {number} n Number of hex digits.
 * @param {string} s Source string.
 * @param {number} i Offset of first hex digit.
 * @returns {[string | null, number]}
 */
function hex_value(n, s, i) {
	if (i + n > s.length) return [null, i];
	const hex = s.slice(i, i + n);
	const cp = parseInt(hex, 16);
	if (isNaN(cp)) return [null, i];
	return [String.fromCodePoint(cp), i + n];
}

// -- parse.transform ----------------------------------------------------

/**
 * Walk a parse tree and apply registered transforms bottom-up.
 *
 * @param {Parse} p
 * @param {number} i Parse tree index to start at.
 * @param {number} d Depth to consume.
 * @returns {TransformWalk}
 */
function transformer(p, i, d) {
	const vals = [];
	const tree = /** @type {Node[]} */ (p.tree);
	while (i < tree.length) {
		const dep = tree[i].depth;
		if (dep < d) break;
		if (p.leaf(i)) {
			vals.push(apply_type(p, i, p.text(i)));
			i++;
		} else {
			const [result, j] = transformer(p, i + 1, dep + 1);
			vals.push(apply_type(p, i, result));
			i = j;
		}
	}
	return [vals, i];
}

/**
 * Apply the transform configured for one parse tree node.
 *
 * @param {Parse} p
 * @param {number} i Parse tree index.
 * @param {unknown} val Leaf text or child transform values.
 * @returns {unknown}
 */
function apply_type(p, i, val) {
	try {
		const name = p.name(i);
		const [fn, con] = transform_fn(p, name);
		if (!fn) return [name, val]; // default, no transform
		const result = fn(val);
		if (con === ":") return [name, result];
		return result;
	} catch (err) {
		const name = p.name(i);
		throw new Error(`*** transform failed: ${name}(${val})\n${err}`);
	}
}

/**
 * Look up the transform for a rule.
 *
 * @param {Parse} p
 * @param {string} name Rule name.
 * @returns {[TransformFn, "." | ":"] | [null, "."]}
 */
function transform_fn(p, name) {
	let fn = p.code.transforms[name];
	if (fn) return [fn, "."];
	fn = p.code.transforms[name + ":"];
	if (fn) return [fn, ":"];
	return [null, "."];
}

// -- peg_grammar ptree -- bootstrap generated ---------------------------

/** @type {PtreeNode} */
// biome-ignore format: readability
const peg_ptree = ["Peg", [
	["rule", [["id", "Peg"], ["def", "="], ["seq", [["id", "_"], ["rep", [["id", "rule"], ["sfx", "+"]]]]]]]  ,
	["rule", [["id", "rule"], ["def", "="], ["seq", [["id", "id"], ["id", "_"], ["id", "def"], ["id", "_"], ["id", "alt"]]]]]  ,
	["rule", [["id", "def"], ["def", "="], ["rep", [["class", "[:=]"], ["sfx", "+"]]]]]  ,
	["rule", [["id", "alt"], ["def", "="], ["seq", [["id", "seq"], ["rep", [["seq", [["quote", "'/'"], ["id", "_"], ["id", "seq"]]], ["sfx", "*"]]]]]]]  ,
	["rule", [["id", "seq"], ["def", "="], ["rep", [["id", "rep"], ["sfx", "+"]]]]]  ,
	["rule", [["id", "rep"], ["def", "="], ["seq", [["id", "pre"], ["rep", [["id", "sfx"], ["sfx", "?"]]], ["id", "_"]]]]]  ,
	["rule", [["id", "pre"], ["def", "="], ["seq", [["rep", [["id", "pfx"], ["sfx", "?"]]], ["id", "term"]]]]]  ,
	["rule", [["id", "term"], ["def", "="], ["alt", [["id", "call"], ["id", "quote"], ["id", "class"], ["id", "dot"], ["id", "group"], ["id", "extn"]]]]]  ,
	["rule", [["id", "group"], ["def", "="], ["seq", [["quote", "'('"], ["id", "_"], ["id", "alt"], ["quote", "')'"]]]]]  ,
	["rule", [["id", "call"], ["def", "="], ["seq", [["id", "id"], ["id", "_"], ["pre", [["pfx", "!"], ["id", "def"]]]]]]]  ,
	["rule", [["id", "id"], ["def", "="], ["seq", [["class", "[a-zA-Z_]"], ["rep", [["class", "[a-zA-Z0-9_]"], ["sfx", "*"]]]]]]]  ,
	["rule", [["id", "pfx"], ["def", "="], ["class", "[~!&]"]]]  ,
	["rule", [["id", "sfx"], ["def", "="], ["alt", [["class", "[+?]"], ["seq", [["quote", "'*'"], ["rep", [["id", "nums"], ["sfx", "?"]]]]]]]]]  ,
	["rule", [["id", "nums"], ["def", "="], ["seq", [["id", "min"], ["rep", [["seq", [["quote", "'..'"], ["id", "max"]]], ["sfx", "?"]]]]]]]  ,
	["rule", [["id", "min"], ["def", "="], ["rep", [["class", "[0-9]"], ["sfx", "+"]]]]]  ,
	["rule", [["id", "max"], ["def", "="], ["rep", [["class", "[0-9]"], ["sfx", "*"]]]]]  ,
	["rule", [["id", "quote"], ["def", "="], ["seq", [["class", "[']"], ["rep", [["pre", [["pfx", "~"], ["class", "[']"]]], ["sfx", "*"]]], ["class", "[']"], ["rep", [["quote", "'i'"], ["sfx", "?"]]]]]]]  ,
	["rule", [["id", "class"], ["def", "="], ["seq", [["quote", "'['"], ["rep", [["pre", [["pfx", "~"], ["quote", "']'"]]], ["sfx", "*"]]], ["quote", "']'"]]]]]  ,
	["rule", [["id", "dot"], ["def", "="], ["seq", [["quote", "'.'"], ["id", "_"]]]]]  ,
	["rule", [["id", "extn"], ["def", "="], ["seq", [["quote", "'<'"], ["rep", [["pre", [["pfx", "~"], ["quote", "'>'"]]], ["sfx", "*"]]], ["quote", "'>'"]]]]]  ,
	["rule", [["id", "_"], ["def", "="], ["rep", [["alt", [["rep", [["class", "[ \\t\\n\\r]"], ["sfx", "+"]]], ["seq", [["quote", "'#'"], ["rep", [["pre", [["pfx", "~"], ["class", "[\\n\\r]"]]], ["sfx", "*"]]]]]]], ["sfx", "*"]]]]]
]];

// == pPEG compile API ===================================================

/** @type {Code} */
let peg_code = new Code(null, { boot: peg_ptree }); // peg boot grammar

/**
 * Compile a pPEG grammar string into reusable parser code.
 *
 * @param {string} grammar Grammar source.
 * @param {TransformMap} [transforms={}] Transform callbacks keyed by rule name.
 * @param {ExtensionMap} [extras={}] Extension callbacks keyed by extension command name.
 * @returns {Code}
 */
export function compile(grammar, transforms = {}, extras = {}) {
	const parse = parser(peg_code, grammar);
	if (!parse.ok) throw new Error("*** grammar fault...\n" + err_report(parse));
	const code = new Code(parse, { transforms, extras });
	if (!code.ok) throw new Error("*** grammar errors...\n" + code.errors());
	return code;
}

peg_code = compile(peg_grammar); // bootstrap full grammar
