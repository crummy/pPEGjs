/*
    pPEG in JavaScript

    See: <https://github.com/pcanz/pPEG>

    No dependencies, this is the only file you need.
*/

const pPEG_grammar = `
    Peg   = _ rule+
    rule  = id _ '=' _ alt

    alt   = seq ('/' _ seq)*
    seq   = rep+
    rep   = pre sfx? _
    pre   = pfx? term
    term  = call / sq / chs / group / extn

    id    = [a-zA-Z_] [a-zA-Z0-9_]*
    pfx   = [&!~]
    sfx   = [+?] / '*' range?
    range = num (dots num?)?
    num   = [0-9]+
    dots  = '..'

    call  = id _ !'='
    sq    = ['] ~[']* [']
    chs   = '[' ~']'* ']'
    group = '(' _ alt ')'
    extn  = '<' ~'>'* '>'
    _     = ('#' ~[\n\r]* / [ \t\n\r]*)*
`;

// biome-ignore format:
const pPEG_rules =
[["rule",[["id","Peg"],
    ["seq",[["id","_"],["rep",[["id","rule"],["sfx","+"]]],["id","_"]]]]],
["rule",[["id","rule"],
    ["seq",[["id","id"],["id","_"],["sq","'='"],["id","_"],["id","alt"]]]]],
["rule",[["id","alt"],
    ["seq",[["id","seq"],["rep",[["seq",[["sq","'/'"],["id","_"],["id","seq"]]],["sfx","*"]]]]]]],
["rule",[["id","seq"],
    ["rep",[["id","rep"],["sfx","+"]]]]],
["rule",[["id","rep"],
    ["seq",[["id","pre"],["rep",[["id","sfx"],["sfx","?"]]],["id","_"]]]]],
["rule",[["id","pre"],
    ["seq",[["rep",[["id","pfx"],["sfx","?"]]],["id","term"]]]]],
["rule",[["id","term"],
    ["alt",[["id","call"],["id","sq"],["id","chs"],["id","group"],["id","extn"]]]]],
["rule",[["id","id"],
    ["seq",[["chs","[a-zA-Z_]"],
        ["rep",[["chs","[a-zA-Z0-9_]"],["sfx","*"]]]]]]],
["rule",[["id","pfx"],
    ["chs","[&!~]"]]],
["rule",[["id","sfx"],
    ["alt",[["chs","[+?]"],["seq",[["sq","'*'"],["rep",[["id","range"],["sfx","?"]]]]]]]]],
["rule",[["id","range"],
    ["seq",[["id","num"],["rep",[["seq",[["id","dots"],["rep",[["id","num"],["sfx","?"]]]]],
        ["sfx","?"]]]]]]],
["rule",[["id","num"],
    ["rep",[["chs","[0-9]"],["sfx","+"]]]]],
["rule",[["id","dots"],
    ["sq","'..'"]]],
["rule",[["id","call"],
    ["seq",[["id","id"],["id","_"],["pre",[["pfx","!"],["sq","'='"]]]]]]],
["rule",[["id","sq"],
    ["seq",[["chs","[']"],["rep",[["pre",[["pfx","~"],["chs","[']"]]],
        ["sfx","*"]]],["chs","[']"],["rep",[["sq","'i'"],["sfx","?"]]]]]]],
["rule",[["id","chs"],
    ["seq",[["sq","'['"],["rep",[["pre",[["pfx","~"],["sq","']'"]]],
        ["sfx","*"]]],["sq","']'"]]]]],
["rule",[["id","group"],
    ["seq",[["sq","'('"],["id","_"],["id","alt"],["sq","')'"]]]]],
["rule",[["id","extn"],
    ["seq",[["sq","'<'"],["rep",[["pre",[["pfx","~"],["sq","'>'"]]],
        ["sfx","*"]]],["sq","'>'"]]]]],
["rule",[["id","_"],
    ["rep",[["alt",[["seq",[["sq","'#'"],["rep",[["pre",[["pfx","~"],["chs","[\n\r]"]]],
        ["sfx","*"]]]]],["rep",[["chs","[ \t\n\r]"],["sfx","*"]]]]],["sfx","*"]]]]]];

const pPEG_codex = compiler(pPEG_rules);

// pPEG machine instructions --------------------------------------------------

/**
 * Rule lookup - finds the appropriate rule for the given rule name and executes it
 * @param {[function, number, string]} exp The rule name to execute
 * @param {Env} env Environment configuration
 * @returns {boolean} True if the command was successfully parsed and executed
 */
function ID(exp, env) {
	const [, idx, name] = exp // [ID, idx, name]
	const start = env.pos;
	const stack = env.tree.length;
	const expr = env.code[idx];
	if (env.panic || env.depth > env.max_depth) {
		if (!env.panic)
			env.panic = `max depth of recursion exceeded in rules:\n ... ${env.rule_names.slice(-6).join(" ")}\n`;
		return false;
	}
	if (env.trace) trace_enter(name, env);
	env.depth += 1;
	env.rule_names[env.depth] = name;
	env.start[env.depth] = start;
	env.stack[env.depth] = stack;
	const result = expr[0](expr, env);
	env.depth -= 1;
	if (result === false) {
		if (env.trace) trace_result(exp, env, false);
		env.pos = start;
		env.tree.length = stack;
		return false;
	}
	if (name[0] === "_") {
		// no results required..
		if (env.tree.length > stack) {
			// nested rule results...
			env.tree = env.tree.slice(0, stack); // deleted
		}
		if (env.trace) trace_result(exp, env, true, start);
		return true;
	}
	if (env.tree.length - stack > 1 || name[0] <= "Z") { // if multiple results or first letter capital
		const result = [name, env.tree.slice(stack)]; // stack..top
		env.tree = env.tree.slice(0, stack); // delete stack..
		env.tree.push(result);
		if (env.trace) trace_result(exp, env, result);
		return true;
	}
	if (env.tree.length === stack) {
		// terminal string value..
		const result = [name, env.input.slice(start, env.pos)];
		env.tree.push(result);
		if (env.trace) trace_result(exp, env, result);
		return true;
	}
	if (env.trace) trace_result(exp, env, env.tree[env.tree.length - 1]);
	return true; //  elide this rule label
} // ID

/**
 *
 * @param {string|Command} exp
 * @param {Env} env
 * @returns {boolean}
 */
function ALT(exp, env) {
	// [ALT, [...exp], [...guards]]
	if (env.trace) trace_rep(exp, env);
	const start = env.pos;
	const stack = env.tree.length;
	const ch = env.input[start];
	for (let i = 0; i < exp[1].length; i += 1) {
		if (!env.trace && exp.length > 2) {
			const x = exp[2][i]; // guard ch
			if (x && ch !== x) continue; // forget this alt
		}
		const arg = exp[1][i];
		const result = arg[0](arg, env);
		if (result) return true;
		if (env.tree.length > stack) {
			env.tree = env.tree.slice(0, stack);
		}
		env.pos = start; // reset pos and try the next alt
	}
	return false;
} // ALT

/**
 *
 * @param {string|Command} exp
 * @param {Env} env
 * @returns {boolean}
 */
function SEQ(exp, env) {
	// [SEQ, min, max, [...exp]]
	if (env.trace) trace_rep(exp, env);
	const [_, min, max, args] = exp;
	let count = 0;
	while (true) {
		// min..max
		let i = 0;
		let start = env.pos;
		const stack = env.tree.length;
		for (i = 0; i < args.length; i += 1) {
			const arg = args[i];
			const result = arg[0](arg, env);
			if (result === false) {
				if (count >= min) {
					env.pos = start;
					if (env.tree.length > stack) {
						env.tree = env.tree.slice(0, stack);
					}
					return true;
				}
				if (env.pos > start && env.pos > env.fault_pos) {
					env.fault_pos = env.pos;
					env.fault_tree = env.tree.slice(0);
					env.fault_rule = env.rule_names[env.depth];
					env.fault_exp = exp[3][i];
				}
				return false;
			}
		}
		count += 1;
		if (count === max) break; // max 0 means any`
		if (env.pos === start) break; // no progress
		start = env.pos; // next start in min..max
	} // min..max
	return count >= min;
}

/**
 *
 * @param {string|Command} exp
 * @param {Env} env
 * @returns {boolean}
 */
function REP(exp, env) {
	// [REP, min, max, exp]
	if (env.trace) trace_rep(exp, env);
	const [_rep, min, max, expr] = exp;
	const stack = env.tree.length;
	let count = 0;
	let pos = env.pos;
	while (true) {
		// min..max
		const result = expr[0](expr, env);
		if (result === false) break;
		count += 1;
		if (pos === env.pos) break; // no progress
		if (count === max) break; // max 0 means any`
		pos = env.pos;
	}
	if (count < min) {
		if (env.tree.length > stack) {
			env.tree = env.tree.slice(0, stack);
		}
		return false;
	}
	return true;
}

/**
 *
 * @param {string|Command} exp
 * @param {Env} env
 * @returns {boolean}
 */
function PRE(exp, env) {
	// [PRE, sign, term]
	const [_pre, sign, term] = exp;
	const start = env.pos;
	const stack = env.tree.length;
	const trace = env.trace;
	const peak = env.peak;
	env.trace = false;
	const result = term[0](term, env);
	env.peak = peak;
	env.trace = trace;
	if (trace) trace_pre(exp, env, result);
	if (env.tree.length > stack) {
		env.tree = env.tree.slice(0, stack);
	}
	env.pos = start;
	if (sign === "~") {
		if (result === true || env.pos >= env.input.length) return false;
		env.pos = start + 1;
		if (env.peak < env.pos) env.peak = env.pos;
		return true;
	}
	if (sign === "!") return !result;
	return result;
}

/**
 *
 * @param {string|Command} exp
 * @param {Env} env
 * @returns {boolean}
 */
function SQ(exp, env) {
	// [SQ, icase, "..."]
	const start = env.pos;
	const input = env.input;
	const icase = exp[1]; // case insensitive
	const str = exp[2];
	const len = str.length;
	if (len === 0) return true; // '' empty str
	let pos = env.pos;
	for (let i = 0; i < len; i += 1) {
		let char = input[pos]; // undefined if pos >= input.length
		if (icase && pos < input.length) char = char.toUpperCase();
		if (str[i] !== char) {
			env.pos = start;
			if (env.trace) trace_chars_fail(exp, env);
			return false;
		}
		pos += 1;
	}
	env.pos = pos;
	if (pos > env.peak) env.peak = pos;
	if (env.trace) trace_chars_match(exp, env, start);
	return true;
}

/**
 *
 * @param {string|Command} exp
 * @param {Env} env
 * @returns {boolean}
 */
function CHS(exp, env) {
	// [CHS, neg, min, max, str]
	const input = env.input;
	const start = env.pos;
	const [_, neg, min, max, str] = exp;
	let pos = env.pos;
	let count = 0;
	while (pos < input.length) {
		// min..max
		let hit = false;
		const ch = env.input[pos];
		for (let i = 0; i < str.length; i += 1) {
			if (i + 2 < str.length && str[i + 1] === "-") {
				if (ch < str[i] || ch > str[i + 2]) {
					i += 2;
					continue;
				}
			} else {
				if (ch !== str[i]) continue;
			}
			hit = true;
			break;
		}
		if (neg) hit = !hit;
		if (!hit) break;
		count += 1;
		pos += 1;
		if (count === max) break;
	} // min..max loop
	if (count < min) {
		if (env.trace) trace_chars_fail(exp, env);
		return false;
	}
	env.pos = pos;
	if (pos > env.peak) env.peak = pos;
	if (env.trace) trace_chars_match(exp, env, start);
	return true;
}

/**
 *
 * @param {string|Command} exp
 * @param {Env} env
 * @returns {boolean}
 */
function EXTN(exp, env) {
	// [EXTN, "<xxx>"]
	const ext = exp[1].slice(1, -1).split(" ");
	const key = ext[0]; //, sigil = '';
	// for (let i=0; i<key.length; i+=1) {
	//     if (key[i] >= 'A') break; // 0..@
	//     sigil += key[i];
	// }
	// key = sigil || key;
	const fn = env.extend[key] || builtin(key);
	if (!fn) {
		if (env.pos > env.fault_pos) {
			env.fault_pos = env.pos;
			env.fault_tree = env.tree.slice(0);
			env.fault_rule = env.rule_names[env.depth];
			env.fault_exp = `missing extension: ${exp[1]}`;
		}
		return false;
	}
	try {
		const result = fn(exp, env);
		if (env.trace) trace_extn(exp, env, result);
		if (result) return true; // allow any JS truthy return
		return false;
	} catch (err) {
		// treat extn exceptions as panic failures
		env.panic = err;
		return false;
	}
}

// builtins -- predefined extension functions -------------------------------
const builtins = {
	"?": dump_trace,
	trace: trace_trigger, // deprecate trace...?
	"@": same_match, // deprecate?
	eq: same_match, // deprecate
	at: same_match, // TODO -- chk undefined extn working?
	infix, // pratt op exp
	quote,
	quoter,
	indent: ext_indent,
	inset: ext_inset,
	undent: ext_undent,
};

function builtin(key) {
	return builtins[key] || undefined;
}

// <?> dump trace -----------------------------------------

function dump_trace(exp, env) {
	let report = `<?> at line: ${line_number(env.input, env.pos)}\n`;
	for (let i = 0; i < env.tree.length; i += 1) {
		const tree = show_tree(env.tree[i]);
		report += `${tree}\n`;
	}
	report += line_report(env.input, env.pos);
	console.log(report);
	return true;
}

// <infix> -------------------------------------------------

function infix(exp, env) {
	const stack = env.stack[env.depth];
	if (env.tree.length - stack < 3) return true;
	let next = stack - 1; // tree stack index
	env.tree[stack] = pratt(0);
	env.tree.length = stack + 1;
	return true;

	function pratt(lbp) {
		next += 1;
		let result = env.tree[next];
		while (true) {
			next += 1;
			const op = env.tree[next];
			let rbp = op ? 0 : -1;
			const sfx = op ? op[0].slice(-3) : undefined;
			if (sfx && sfx[0] === "_") {
				// _xL or _xR
				const x = sfx.charCodeAt(1);
				if (sfx[2] === "L") rbp = (x << 1) + 1;
				if (sfx[2] === "R") rbp = (x + 1) << 1;
			}
			if (rbp < lbp) {
				next -= 1; // restore op
				break;
			}
			rbp = rbp % 2 === 0 ? rbp - 1 : rbp + 1;
			result = [op[1], [result, pratt(rbp)]];
		}
		return result;
	}
}

// <@name> -------------------------------------------------

function same_match(exp, env) {
	// <eq name>, deprecate <@name>
	const ext = exp[1].slice(1, -1).split(" ");
	const name = ext[1];
	const idx = env.codex.names[name];
	const code = env.code[idx];
	if (!code) throw `${exp[1]} undefined rule: ${name}`;
	let prior = ""; // previous name rule result
	for (let i = env.tree.length - 1; i >= 0; i -= 1) {
		const [rule, value] = env.tree[i];
		if (rule === name) {
			prior = value;
			break;
		}
	}
	if (prior === "") return true; // '' empty match deafult (no prior value)
	if (env.input.startsWith(prior, env.pos)) {
		env.pos += prior.length;
		return true;
	}
	return false;
}

// <quote> and <quoter> --------------------------------------

function quote(exp, env) {
	// marks <quote>
	const input = env.input;
	const start = env.start[env.depth];
	const sot = env.pos;
	const marks = input.slice(start, sot);
	const eot = input.indexOf(marks, sot);
	if (eot === -1) return false;
	env.tree.push(["quote", input.slice(sot, eot)]);
	env.pos = eot + marks.length;
	if (env.peak < env.pos) env.peak = env.pos;
	return true;
}

function quoter(exp, env) {
	// marks <quoter>
	const input = env.input;
	const start = env.start[env.depth];
	const sot = env.pos;
	let marks = ""; // reverse marks
	for (let i = sot - 1; i >= start; i -= 1) marks += input[i];
	const eot = input.indexOf(marks, sot);
	if (eot === -1) return false;
	env.tree.push(["quoter", input.slice(sot, eot)]);
	console.log(start, sot, eot, marks);
	env.pos = eot + marks.length;
	if (env.peak < env.pos) env.peak = env.pos;
	return true;
}

// <indent, <inset>, <undent> ---------------------------------

function ext_indent(exp, env) {
	const input = env.input;
	const start = env.pos;
	let i = start;
	while (input[i] === " ") i += 1;
	if (i === start) while (input[i] === "\t") i += 1;
	if (i === start) return false;
	const current = env.indent.at(-1);
	if (current && i - start <= current.length) return false;
	if (current && current[0] !== input[start]) throw "indent: mixed space & tab";
	env.indent.push(env.input.slice(start, i));
	return true;
}

function ext_inset(exp, env) {
	const input = env.input;
	const start = env.pos;
	let i = start;
	while (input[i] === " ") i += 1;
	if (i === start) while (input[i] === "\t") i += 1;
	if (i === start) return false;
	return input.slice(start, i) === env.indent.at(-1);
}

function ext_undent(exp, env) {
	env.indent.pop();
	return true;
}

// fault reporting -------------------------------------------------------

function line_report(str, pos, note = "") {
	let i = pos; // start of line..
	while (i > 0 && str[i - 1] !== "\n" && str[i - 1] !== "\r") i -= 1;
	let j = pos; // end of line..
	while (j < str.length && str[j] !== "\n" && str[j] !== "\r") j += 1;
	const { row } = line_info(str, pos); // {row, col}
	let inset = line_label(-1); //  ...inset...^
	for (let n = i; n < pos; n += 1) inset += " ";
	const before = lines_before(str, row, i, j, 3);
	const after = lines_after(str, row, j, 2);
	return `${before}${inset}^${after}${note}`;
}

function line_number(str, pos) {
	return line_info(str, pos).at;
}

function line_info(str, pos) {
	let i = 0;
	let sol = 0;
	let cr = 1;
	let lf = 1;
	while (i < pos) {
		if (str[i] === "\r") {
			cr += 1;
			i += 1;
		}
		if (str[i] === "\n") {
			lf += 1;
			i += 1;
		}
		sol = i;
		while (i < pos && str[i] !== "\n" && str[i] !== "\r") i += 1;
	}
	const row = lf >= cr ? lf : cr;
	const col = pos - sol + 1;
	const at = `${row}.${col}`;
	return { row, col, at };
}

function lines_before(str, ln, i, j, n) {
	let before = "";
	while (true) {
		const label = line_label(ln);
		before = `${label}${str.slice(i, j)}\n${before}`;
		n -= 1;
		if (i === 0 || n === 0) return before;
		ln -= 1;
		if (i > 0 && str[i - 1] === "\n") i -= 1;
		if (i > 0 && str[i - 1] === "\r") i -= 1;
		j = i;
		while (i > 0 && str[i - 1] !== "\n" && str[i - 1] !== "\r") i -= 1;
	}
}

function lines_after(str, ln, i, n) {
	let after = "";
	while (n > 0 && i < str.length) {
		ln += 1;
		let j = i;
		if (str[j] === "\n") j += 1;
		if (j < str.length && str[j] === "\r") j += 1;
		let k = j;
		while (k < str.length && str[k] !== "\n" && str[k] !== "\r") k += 1;
		after += `\n${line_label(ln)}${str.slice(j, k)}`;
		i = k;
		n -= 1;
	}
	return after;
}

/**
 * Formatting: Prints some spaces and a line number
 * @param {number} n
 * @returns {string}
 */
function line_label(n) {
	const blank = "         ";
	if (n < 0) return blank;
	let ln = ` ${n} | `;
	while (ln.length < blank.length) ln = ` ${ln}`;
	return ln;
}


/**
 * Trace
 * @param {string|Command} exp
 * @param {Env} env
 * @returns {boolean}
 */
function trace_trigger(exp, env) {
	// <?> extension
	if (env.trace) return true; // nested <?>
	env.trace = true;
	env.trace_depth = env.depth; // active enter/exit current rule
	trace_report(`        ${env.rule_names[env.trace_depth]}`);
	return true;
}

/**
 * Decides whether to print a trace report
 * @param {string} name
 * @param {Env} env
 */
function trace_enter(name, env) {
	if (env.trace_depth === -1) {
		// not active
		if (env.trace !== name) return;
		env.trace_depth = env.depth; // active enter/exit current rule
	}
	trace_report(indent(env) + name);
}

function trace_result(exp, env, result, start) {
	if (env.trace_depth === -1) return; // not active
	if (env.depth + 1 < env.trace_depth) return;
	if (result === false) {
		trace_report(`${indent(env)}${exp_show(exp)} != ${show_line(env)}`);
	} else if (result === true) {
		trace_report(
			`${indent(env)}${exp[2]} == ${show_input(env, start, env.pos)}`,
		);
	} else {
		let show = JSON.stringify(result);
		if (show.length > 70) show = `${show.slice(0, 60)} ... ]`;
		trace_report(`${indent(env)}${exp[2]} => ${show}`);
	}
}

function trace_rep(exp, env) {
	if (env.trace_depth === -1) return; // not active
	trace_report(indent(env) + exp_show(exp));
}

function trace_chars_match(exp, env, start) {
	if (env.trace_depth === -1) return; // not active
	trace_report(
		`${indent(env)}${exp_show(exp)} == ${show_input(env, start, env.pos)}`,
	);
}

function trace_chars_fail(exp, env) {
	if (env.trace_depth === -1) return; // not active
	trace_report(`${indent(env)}${exp_show(exp)} != ${show_line(env)}`);
}

function trace_pre(exp, env, result) {
	if (env.trace_depth === -1) return; // not active
	const [_pre, sign, term] = exp;
	let result2 = result;
	if (sign === "!") result2 = !result2;
	const flag = result2 ? " == " : " != ";
	trace_report(indent(env) + exp_show(term) + flag);
}

function trace_extn(exp, env) {
	if (env.trace_depth === -1) return; // not active
	trace_report(indent(env) + exp[1]);
}

function show_line(env) {
	let eol = env.pos;
	while (env.input[eol] >= " ") eol += 1;
	if (eol - env.pos > 2) return show_input(env, env.pos, eol);
	return show_input(env, env.pos, env.input.length);
}

function show_input(env, i, j) {
	let s = env.input.slice(i, j);
	if (s.length > 40) s = `${s.slice(0, 30)} ...`;
	return str_esc(s);
}

/**
 *
 * @param {Env} env
 * @returns {string}
 */
function indent(env) {
	let s = line_number(env.input, env.pos);
	while (s.length < 8) s += " ";
	for (let i = env.trace_depth; i < env.depth; i += 1) s += "|  ";
	return s;
}

/**
 * exp decode display
 * @param {string|Command} exp
 * @returns {*|string} A string, or second arg if ID, or first arg if EXTN (what are those args?)
 */
function exp_show(exp) {
	if (typeof exp === "string") return exp;
	switch (exp[0]) {
		case ID:
			return exp[2];
		case SQ:
			return `'${str_esc(exp[2])}'`;
		// case DQ: return '"'+str_esc(exp[2])+'"';
		case CHS: {
			const [_, neg, min, max, str] = exp;
			const sign = neg ? "~" : "";
			return `${sign}[${str_esc(str)}]${sfx_show(min, max)}`;
		}
		case PRE: {
			const [_pre, sign, term] = exp;
			return sign + exp_show(term);
		}
		case REP: {
			const [_rep, min, max, expr] = exp;
			return `${exp_show(expr)}${sfx_show(min, max)}`;
		}
		case ALT: {
			const xs = exp[1].map(exp_show);
			return `(${xs.join("/")})`;
		}
		case SEQ: {
			const [_, min, max, args] = exp;
			const xs = args.map(exp_show);
			return `(${xs.join(" ")})${sfx_show(min, max)}`;
		}
		case EXTN:
			return exp[1];
		default:
			return "(...)";
	}
}

function sfx_show(min, max) {
	if (min === 0 && max === 0) return "*";
	if (min === 0 && max === 1) return "?";
	if (min === 1 && max === 0) return "+";
	if (min === 1 && max === 1) return "";
	if (max === 0) return `*${min}..`;
	return `*${min}..${max}`;
}

function str_esc(s) {
	let r = "";
	for (const c of s) {
		if (c >= " ") {
			r += c;
		} else if (c === "\n") {
			r += "\\n";
		} else if (c === "\r") {
			r += "\\r";
		} else if (c === "\t") {
			r += "\\t";
		} else {
			const n = c.charCodeAt(0);
			let xxxx = n.toString(16);
			while (xxxx.length < 4) xxxx = `0${xxxx}`;
			r += `\\u${xxxx}`;
		}
	}
	return r;
}

/**
 * The compiler turns ptree rules into instruction code
 * @param {Array} rules
 * @returns {Codex}
 */
function compiler(rules) {
	const names = {};
	let first;
	for (let i = 0; i < rules.length; i += 1) {
		const [_rule, [[_id, name], _exp]] = rules[i];
		if (i === 0) first = name;
		names[name] = i;
	}
	const start = [ID, 0, first]; // start rule
	const code = [];
	for (const rule of rules) {
		const [_rule, [[_id, name], exp]] = rule;
		code.push(emit(exp));
	}
	for (let i = 0; i < code.length; i += 1) {
		optimize(code[i], code);
	}
	// let space, sp = names["_space_"];
	// if (sp) space = code[sp];
	return { rules, names, code, start };

	/**
	 * @param {Array} exp
	 * @returns {[...Command]} Tuple containing the function to execute the rule, and arguments
	 */
	function emit(exp) {
		// ptree -> [Op, args..]
		switch (exp[0]) {
			case "id": {
				const name = exp[1];
				const index = names[name];
				if (index === undefined) throw `Undefined rule: ${name}`;
				return [ID, index, name];
			}
			case "alt":
				return [ALT, exp[1].map(emit)];
			case "seq":
				return [SEQ, 1, 1, exp[1].map(emit)];
			case "rep": {
				// ['rep',[[expn],['sfx', sfx]]]
				const [expn, [suffix, sfx]] = exp[1];
				const [min, max] = min_max(suffix, sfx);
				const expr = emit(expn);
				if (expr[0] === SEQ) {
					const [_SEQ, n, m, ex] = expr;
					if (n === 1 && m === 1) {
						return [SEQ, min, max, ex];
					}
				}
				if (expr[0] === CHS) {
					const [_CHS, neg, n, m, str] = expr;
					if (n === 1 && m === 1) {
						return [CHS, neg, min, max, str];
					}
				}
				if (expr[0] === SQ) {
					const [_SQ, icase, str] = expr;
					if (str.length === 1) {
						return [CHS, false, min, max, str];
					}
				}
				return [REP, min, max, expr];
			}
			case "pre": {
				const [[_pfx, pfx], term] = exp[1];
				const expr = emit(term);
				if (pfx === "~") {
					if (expr[0] === SQ) {
						const [_SQ, icase, str] = expr;
						if (!icase) return [CHS, true, 1, 1, str];
					} else if (expr[0] === CHS) {
						const [_CHS, neg, min, max, str] = expr;
						if (!neg) return [CHS, true, min, max, str];
					}
				}
				return [PRE, pfx, expr];
			}
			// case "sq": return sq_dq(SQ, exp[1]);
			// case "dq": return sq_dq(DQ, exp[1]);

			case "sq": {
				const txt = exp[1];
				const icase = txt.slice(-1) === "i";
				let str = icase ? txt.slice(1, -2) : txt.slice(1, -1);
				str = escape_codes(str);
				if (icase) str = str.toUpperCase();
				return [SQ, icase, str];
			}

			case "chs": {
				let str = exp[1].slice(1, -1);
				str = escape_codes(str);
				return [CHS, false, 1, 1, str];
			}

			case "extn":
				return [EXTN, exp[1]];

			default:
				throw `Undefined ptree node: ${exp}`;
		}
	}

	function min_max(suffix, sfx) {
		// -> [min, max]
		// sfx   = [+?] / '*' range?
		// range = num (dots num?)?
		let min = 0;
		let max = 0; // for sfx == "*""
		if (suffix === "sfx") {
			if (sfx === "+") {
				min = 1;
			} else if (sfx === "?") {
				max = 1;
			}
		} else if (suffix === "num") {
			min = Number.parseInt(sfx, 10);
			max = min;
		} else if (suffix === "range") {
			// *N..M
			// ["range", [[num, min],["dots", ".."]]]
			if (sfx.length === 2) {
				// *N..
				min = Number.parseInt(sfx[0][1], 10);
			} else {
				// *N..M
				// ["range", [[num, min],["dots", ".."],["num", max]]]
				min = Number.parseInt(sfx[0][1], 10);
				max = Number.parseInt(sfx[2][1], 10);
			}
		} else throw `unknown suffix: ${suffix}`;
		return [min, max];
	}

	function optimize(exp, code) {
		switch (exp[0]) {
			case SEQ: {
				// [SEQ, n, m, exps]
				for (const ex of exp[3]) optimize(ex, code);
				return;
			}
			case ALT: {
				// [ALT, exps]
				const exprs = exp[1];
				const guards = [];
				for (let i = 0; i < exprs.length; i += 1) {
					guards.push(first_char(exprs[i], code));
				}
				exp.push(guards);
				// console.log("ALT-guards",exp);
				return;
			}
			default:
				return;
		}
	}

	function first_char(exp, code) {
		switch (
			exp[0] // TODO empty sq return undefined...
		) {
			case ID: {
				return first_char(code[exp[1]], code);
			}
			case SEQ:
				return first_char(exp[3][0], code);
			case SQ:
				return exp[2][0];
			default:
				return null;
		}
	}
} // compiler

const escape_code1 = {
	t: "\t",
	n: "\n",
	r: "\r",
};

function escape_codes(str) {
	let s = "";
	for (let i = 0; i < str.length; i += 1) {
		const c = str[i];
		if (c !== "\\") {
			s += c;
			continue;
		}
		const x = str[i + 1];
		const code = escape_code1[x];
		if (code) {
			i += 1;
			s += code;
			continue;
		}
		if (x === "u" && i + 5 < str.length) {
			const hex = str.slice(i + 2, i + 6);
			s += String.fromCharCode(Number.parseInt(hex, 16));
			i += 5;
			continue;
		}
		if (x === "U" && i + 9 < str.length) {
			const hex = str.slice(i + 2, i + 10);
			s += String.fromCharCode(Number.parseInt(hex, 16));
			i += 9;
			continue;
		}
		s += "\\"; // literal back-slash
	}
	return s;
}

// -- pretty print ptree ----------------------------------------------

/**
 * @param {Array} ptree
 * @param {boolean=false} json
 * @returns {string}
 */
function show_tree(ptree, json = false) {
	if (!ptree) return "";
	if (json) return show_json(ptree);
	return show_ptree(ptree, 0, 0);
}

/**
 *
 * @param {Array} ptree
 * @param {number} inset
 * @param {number} last int bit map, 1 if after last kid
 * @returns {string}
 */
function show_ptree(ptree, inset, last) {
	const res = ptree[0]; // rule name
	if (typeof ptree[1] === "string") {
		return `${res} "${str_esc(ptree[1])}"`;
	}
	let bars = "\n"; // indent bar markers
	for (let i = 0; i < inset; i += 1) {
		bars += ((last >> i) & 1) === 1 ? "  " : "\u2502 "; // "| "
	}
	const kids = ptree[1];
	let bod = "";
	let tip = "\u251C\u2500"; // |-
	let last2 = last;
	for (let i = 0; i < kids.length; i += 1) {
		if (i === kids.length - 1) {
			tip = "\u2514\u2500"; // `-
			last2 |= 1 << inset; // bit flag last kid
		}
		bod += bars + tip + show_ptree(kids[i], inset + 1, last2);
	}
	return res + bod;
}

/**
 * @param {Array} ptree
 * @param {string} inset
 * @returns {string}
 */
function show_json(ptree, inset = "") {
	if (!ptree) return "";
	const rule = ptree[0]; // rule name
	if (typeof ptree[1] === "string") {
		return `${inset}["${rule}", "${str_esc(ptree[1])}"]`;
	}
	const kids = ptree[1];
	let block = `${inset}["${rule}", [\n`;
	const inset1 = `${inset}  `;
	const n = kids.length - 1;
	for (let i = 0; i < n; i += 1) {
		const json = show_json(kids[i], inset1);
		block += `${json},\n`;
	}
	const json = show_json(kids[n], inset1);
	block += `${json}\n${inset}]]`;
	return block;
}

// ----------------------------------------------------------------------

/**
 * @param {string} report
 */
function trace_report(report) {
	console.log(report); // TODO output in env ?
}

/**
 *
 * @param codex
 * @param {string} input
 * @returns Env
 */
const defaultEnv = (codex, input) => ({
	codex, // {rules, names, code, start}
	code: codex.code,
	extend: {},
	options: {},
	input,
	pos: 0,
	peak: 0, // pos high water mark
	depth: 0, // rule recursion
	max_depth: 100,
	rule_names: [], // dynamic stack
	tree: [], // ptree construction
	// fault reporting .........
	panic: "", // crash msg
	fault_pos: -1,
	fault_tree: [],
	fault_rule: null,
	fault_exp: null,
	// trace reporting .......
	trace: false, // rule name or true
	trace_depth: -1, // active trace depth
	// trace_log: [], // trace report
	// extensions ..........
	start: [], // env.pos at start of rule
	stack: [], // env.tree.length
	indent: [], // <indent>
	result: true, // final parse result
});

/**
 * Extension functions
 * @typedef {Object<string, (any, Env) => unknown>} Extensions
 *
 */

/**
 * @param {Codex} codex
 * @param {string} input
 * @param {Extensions} extend
 * @param {Options} options
 * @return { ParseSuccess | ParseFailure }
 */
function parse(codex, input, extend, options) {
	const env = defaultEnv(codex, input);
	if (extend) env.extend = extend;
	if (options) {
		env.options = options;
		if (options.trace) env.trace = options.trace;
	}
	const start = codex.start;
	const result = start[0](start, env);

	let err = 0;
	if (env.tree.length !== 1) {
		// TODO can this happen?
		env.panic += "Bad ptree ...\n";
		err = 1;
	} else if (env.panic) {
		err = 1;
	} else if (!result) {
		err = 2;
	} else if (env.pos < input.length && !env.options.short) {
		err = 3; // fell short..
	}

	if (err > 0) {
		// returns env for show_err to sort out later
		env.result = result;
		return {
			ok: false,
			env,
			err,
			show_err: () => err_report(env),
		};
	}

	return {
		ok: true,
		ptree: env.tree[0],
		show_ptree: (json = false) => show_tree(env.tree[0], json),
	};
}

/**
 *
 * @param {Env} env
 * @returns {string}
 */
function err_report(env) {
	let report = env.panic;
	for (let i = 0; i < env.fault_tree.length; i += 1) {
		report += show_tree(env.fault_tree[i]);
		report += "\n";
	}
	if (env.result && env.pos < env.input.length) {
		const line = line_number(env.input, env.pos);
		report += `Fell short at line: ${line}\n`;
	} else {
		report += "Failed ";
		if (env.fault_pos > -1) {
			report += `in rule: ${env.fault_rule}, expected: ${exp_show(env.fault_exp)}, `;
		}
		const line = line_number(env.input, env.peak);
		report += `at line: ${line}\n`;
	}
	report += line_report(env.input, env.peak);
	return report;
}

/**
 *
 * @param {string} grammar A grammar, e.g. "number = digit+\ndigit = [0-9]"
 * @param {Object?} extend
 * @param {Object?} options
 * @returns {(CompileSuccess|CompileFailure)} A compiled parser object, or an object describing the failure to parse
 */
function compile(grammar, extend, options) {
	const peg = parse(pPEG_codex, grammar, {}, options);
	if (!peg.ok) {
		return {
			show_err: peg.show_err,
			env: peg.env,
			err: peg.err,
			ok: false,
			panic: `grammar error\n${peg.panic}`,
			parse: () => peg,
		};
	}
	try {
		peg.codex = compiler(peg.ptree[1]);
	} catch (err) {
		return {
			err: 1,
			ok: false,
			parse: () => peg,
			show_err: () => `grammar compile error\n${err}`,
		};
	}
	return {
		show_ptree: peg.show_ptree,
		ok: true,
		parse: (input, options) => parse(peg.codex, input, extend, options),
	};
}

const peg = { compile, show_tree };

export default peg;

/**
 * @typedef {Object} Codex
 * @property {Object} names
 * @property {Array} code
 * @property {((function(*, *): (boolean))|*|number)[]} start
 * @property rules
 */

/**
 * @typedef {Object} ParseSuccess
 * @property {true} ok
 * @property {(boolean?: false) => string} show_ptree
 * @property {Array} ptree
 */

/**
 * @typedef {Object} ParseFailure
 * @property {false} ok
 * @property {() => string} show_err
 * @property {number} err
 * @property {Env} env
 */

/**
 * @typedef {Object} Options
 * @property {boolean?} trace
 * @property {boolean?} short
 */

/**
 * Environment configuration object
 * @typedef {Object} Env
 * @property {boolean | string} trace
 * @property {Options} options
 * @property {string} panic
 * @property {Array} fault_tree
 * @property {boolean} result
 * @property {number} pos
 * @property {string} input
 * @property {number} fault_pos
 * @property {string | null} fault_rule
 * @property {string | null} fault_exp
 * @property {number} peak
 * @property {number} trace_depth
 * @property {Array} tree
 * @property {Array<Command>} code
 * @property {number} depth
 * @property {number} max_depth
 * @property {Array} rule_names // array of strings..?
 * @property {Array} start // array of what?
 * @property {Array} stack // array of what?
 * @property {Extensions} extend
 * @property {Options} options
 */

/**
 * @typedef {ParseSuccess} CompileSuccess
 * @property {(input: string, options?: any) => any} parse
 */

/**
 * @typedef {ParseFailure} CompileFailure
 * @param {string} panic
 * @property {(input: string, options?: any) => any} parse
 */

/**
 * A parsed grammar command
 * @typedef {Array} Command
 * @param {(start: Function, env: Env) => boolean} 0 Function to call to execute the rule
 * @param {...(number | string)} 1 Arguments to the rule
 */

/**
 * Instruction code
 * @typedef {Object} Codex
 * @param {[Command]} start
 * @param {Array} rules
 * @param code
 * @param name
 */