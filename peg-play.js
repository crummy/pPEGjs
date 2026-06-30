#!/usr/bin/env node

const doco = `
# Peg Play

This is a little command line tool to play and test pPEG grammars.

It reads a text (.txt) file starting with a pPEG grammar, followed by
one or more input text tests, each separated by a line starting
with four or more dashes ----  (see: format below)

If successful the parse tree is printed, if not errors are reported.

This makes it easy to play with a pPEG grammar.

To give it a try run it with node.js:

    > node peg-play.js play/date.txt

Or to print the parse tree in json format:

    > node peg-play.js -j play/date.txt

This assumes peg-play.js is in the same directory as pPEG.js,
if not then read how to install as a command below.

Multiple grammars with tests can be combined into a single file.

Also used for regression testing of multiple files in a tests directory.

    > node peg-play.js tests

## Test format

The test file stars with a pPEG grammar, 
followed by a separator line:<br>
-----------------------<br>
with at least 4 ---- dashes.

Multiple input tests are separated in the same way.

The separator before an input test that should fail can be negated:<br>
------------------- not 

Multiple grammars with their tests can be separated with:<br>
========================<br>
a line with at least 4 ==== chars.

WHen reading a grammar any initial comment lines (starting with #)
will be stripped off, and if there are no grammar rules then this
grammar block is skipped over as comments in the test file. 

##  To install as a command

1. Edit this peg-play.js file to import your local copy of pPEG.js 

        import { compile } from './pPEG.js' // <== EDIT.ME to relocate

2. This command line tool can be used with node:

        > node peg-play.js my-test.txt

    But this requires the peg-play.js file to be in the same directory as
    the my-test.txt file(s), or the use of absolute path name(s).

3. Optional: to make peg-play.js into a command that can be used directly.

    Copy this file into: <your-command-path>/peg-play.js

    For example: /usr/local/bin/peg-play.js (or similar on your $PATH)

        > chmod +x /usr/local/bin/peg-play.js
    
    Usage:

        > peg-play.js my-test.txt

`; // doco

import { compile } from "./pPEG.js"; // <== EDIT.ME to relocate

import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import process from "node:process";

/** @type {import("./pPEG.js").ExtensionMap} */
const testExtensions = {
	"?": dumpTrace,
	at: sameMatch,
	eq: sameMatch,
	infix: () => true,
};

// check command line args ----------------------------

let json = false; // -j json, default pretty print ptree
let bad_opt = false; // if -x undefined

let path_arg = 2; // argv first cmd arg

const args = process.argv.length - 2;

if (args > 0) {
	// check for option...
	const arg1 = process.argv[2];
	if (arg1.startsWith("-")) {
		path_arg += 1;
		if (arg1.startsWith("-h")) {
			// -help doco ....
			console.log(doco);
			process.exit(1);
		}
		if (arg1.startsWith("-j")) json = true;
		else bad_opt = true;
	}
}

if (args < 1 || bad_opt) {
	console.log(
		"Usage: -option? path-name (file or directory)\n" +
			"  option:\n" +
			"     -j, -json for json format ptree\n" +
			"     -h, -help for more info.\n",
	);
	process.exit(1);
}

// OK run tests ---------------------------------------

let failure = 0;
for (
	let path = process.argv[path_arg];
	path_arg < process.argv.length;
	path_arg += 1
) {
	if (!existsSync(path)) {
		console.log(`**** Can't find: '${path}' in ${process.cwd()}`);
		continue;
	}
	const ptype = lstatSync(path);
	if (ptype.isDirectory()) {
		const files = readdirSync(path, "utf8");
		for (const file of files) {
			test_file(`${path}/${file}`, json, true); // silent
		}
	} else if (ptype.isFile()) {
		test_file(path, json);
	}
} // all args done..

// read and compile the grammar -----------------------------------------

/**
 *
 * @param {string} file
 * @param {boolean} json
 * @param {boolean} silent
 * @returns {void}
 */
function test_file(file, json, silent = false) {
	if (!file.endsWith(".txt")) {
		say(`**** Skip '${file}' this is not a .txt file...`);
		return;
	}
	let f1 = readFileSync(file, "utf8");

	if (f1.startsWith("====")) f1 = `\n${f1}`; // skips empty grammar

	const grammars = f1.split(/[\n\r]*====+[ \t]*([^ \t\n\r]*)[^\n\r]*\r?\n/);

	let peg_ok = 0;
	let peg_err = 0; // pPEG grammars

	let test_ok = 0;
	let test_err = 0; // input tests

	for (let i = 0; i < grammars.length; i += 2) {
		const tests = grammars[i].split(
			/\r?\n----+[ \t]*([^ \t\n\r]*)[^\n\r]*\r?\n/,
		);

		const px = tests[0]; // pPEG grammar source

		const ps = strip_leading_comments(px); // # lines prior to rules

		if (ps === "") continue; // skip grammar that is all comment lines

		let peg_not = false;
		if (grammars[i - 1] === "not") {
			peg_not = true;
			say("==================================================== not");
		} else {
			say("========================================================");
		}

		say(px); // pPEG grammar text

		let pp;
		try {
			pp = compile(ps, {}, testExtensions);
		} catch (error) {
			// bad grammar
			say(String(error));
			say("********************* grammar failed, skip tests....");
			peg_err += peg_not ? 0 : 1; // don't count if expected to fail
			continue;
		}
		if (peg_not) {
			// was expected to fail, but didn't
			say("********************* grammar was expected to fail ...");
			peg_err += 1;
		}

		if (tests[1] === "not") {
			say("---------------------------------------------------- not");
		} else {
			say("--------------------------------------------------------");
		}

		// parse the input tests -------------------------------------------

		let ok = 0;
		let err = 0;

		for (let i = 2; i < tests.length; i += 2) {
			const neg = tests[i - 1] === "not";
			const s = tests[i];
			say(s);
			if (neg) {
				say(">>>> not");
			} else {
				say(">>>>");
			}
			let tp;
			try {
				tp = pp.parse(s);
			} catch (error) {
				say(String(error));
				err += neg ? 0 : 1;
				ok += neg ? 1 : 0;
				continue;
			}
			if (tp.ok) {
				say(String(tp));
			} else {
				// parse failed ...
				say(String(tp));
			}
			if ((tp.ok && !neg) || (!tp.ok && neg)) {
				ok += 1;
				say(`----------------------------- ok  ${ok}`);
			} else {
				err += 1;
				say(`***************************** err  ${err} ********`);
			}
		}

		test_ok += ok;
		test_err += err;
		peg_ok += 1;
	} // grammars

	if (peg_err === 0 && test_err === 0) {
		console.log(
			`OK ${file}: all ${test_ok} test(s), ${peg_ok} grammar(s) .....`,
		);
	} else {
		console.log(
			`**** Error ${file}: Failed ${test_err} test(s), passed ok ${test_ok} test(s), failed ${peg_err} grammar(s)`,
		);
		failure = 1;
	}

	/** @param {string} msg */
	function say(msg) {
		if (!silent) console.log(msg);
	}

	/** @param {string} str */
	function strip_leading_comments(str) {
		if (str === "") return str;
		const rx = str.match(/^((?:[ \t\n\r]*#[^\n\r]*[\n\r]*)*)[ \t\n\r]*(.*)/s);
		return rx?.[2] ?? "";
	}
} // test_file

/**
 * @param {import("./pPEG.js").Parse} parse
 * @param {string[]} args
 */
function sameMatch(parse, args) {
	const name = args[1];
	const id = parse.code.names.indexOf(name);
	if (id < 0) throw new Error(`<${args.join(" ")}> undefined rule: ${name}`);

	let prior = "";
	for (let i = parse.trace.length - 1; i >= 0; i--) {
		const node = parse.trace[i];
		if (node.fault() || node.idx() !== id) continue;
		prior = parse.input.slice(node.start, node.end);
		break;
	}
	if (prior === "") return true;
	if (!parse.input.startsWith(prior, parse.pos)) return false;
	parse.pos += prior.length;
	return true;
}

/** @param {import("./pPEG.js").Parse} parse */
function dumpTrace(parse) {
	console.log("   Span    Trace...");
	let pos = 0;
	let i = 0;
	while (i < parse.trace.length) {
		const start = parse.trace[i].start;
		const end = parse.trace[i].end;
		let depth = parse.trace[i].depth;
		const nextDepth = traceDepth(parse, i + 1);
		if (pos < start) {
			const value = formatSpan(parse.input, pos, start);
			console.log(
				`${String(pos).padStart(4)}..${String(start).padEnd(4)} ${indentBars(depth)}${value}`,
			);
			pos = start;
		}
		dumpTraceNode(parse, i, start, end, depth);
		if (pos < end && depth >= nextDepth) pos = end;
		while (depth > nextDepth) {
			const parent = traceParentOf(parse, i, depth);
			const parentEnd = parse.trace[parent].end;
			if (pos < parentEnd) {
				const value = formatSpan(parse.input, pos, parentEnd);
				console.log(
					`${String(pos).padStart(4)}..${String(parentEnd).padEnd(4)} ${indentBars(depth)}${value}`,
				);
				pos = parentEnd;
			}
			depth--;
		}
		i++;
	}
	const eot = parse.end;
	if (pos < eot) {
		const maxNode = parse.trace[parse.max_trace];
		const depth = maxNode.depth;
		const value = `\x1b[1;41m!${formatSpan(parse.input, pos, eot)}\x1b[0m`;
		console.log(
			`${String(pos).padStart(4)}..${String(eot).padEnd(4)} ${indentBars(depth)}${value}`,
		);
	}
	return true;
}

/**
 * @param {import("./pPEG.js").Parse} parse
 * @param {number} i
 * @param {number} start
 * @param {number} end
 * @param {number} depth
 */
function dumpTraceNode(parse, i, start, end, depth) {
	const FAIL = 0x2000;
	const DROP = 0x1000;
	const ID_VAL = 0x0fff;
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
	let value = formatSpan(parse.input, start, end);
	if (i + 1 < parse.trace.length && parse.trace[i + 1].depth > depth) {
		value = "\x1b[2;38;5;253m" + value + "\x1b[0m";
	}
	console.log(
		`${String(start).padStart(4)}..${String(end).padEnd(4)} ${indentBars(depth)}${name} ${value}`,
	);
}

/**
 * @param {string} input
 * @param {number} start
 * @param {number} end
 */
function formatSpan(input, start, end) {
	if (end - start < 50) return JSON.stringify(input.slice(start, end));
	return (
		JSON.stringify(input.slice(start, start + 30)) +
		" ... " +
		JSON.stringify(input.slice(start + 30, end))
	);
}

/** @param {number} size */
function indentBars(size) {
	return "\x1b[38;5;253m" + "│ ".repeat(size) + "\x1b[0m";
}

/**
 * @param {import("./pPEG.js").Parse} parse
 * @param {number} i
 * @param {number} depth
 */
function traceParentOf(parse, i, depth) {
	while (i > 0) {
		i--;
		if (parse.trace[i].depth < depth) return i;
	}
	return 0;
}

/**
 * @param {import("./pPEG.js").Parse} parse
 * @param {number} i
 */
function traceDepth(parse, i) {
	return i < parse.trace.length ? parse.trace[i].depth : 0;
}

process.exit(failure ? 1 : 0);
