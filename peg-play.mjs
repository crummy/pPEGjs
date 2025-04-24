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

    > node peg-play.mjs play/date.txt

Or to print the parse tree in json format:

    > node peg-play.mjs -j play/date.txt

This assumes peg-play.mjs is in the same directory as pPEG.mjs,
if not then read how to install as a command below.

Multiple grammars with tests can be combined into a single file.

Also used for regression testing of multiple files in a tests directory.

    > node peg-play.mjs tests

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

1. Edit this peg-play.mjs file to import your local copy of pPEG.mjs 

        import peg from './pPEG.mjs' // <== EDIT.ME to relocate

2. This command line tool can be used with node:

        > node peg-play.mjs my-test.txt

    But this requires the peg-play.mjs file to be in the same directory as
    the my-test.txt file(s), or the use of absolute path name(s).

3. Optional: to make peg-play.mjs into a command that can be used directly.

    Copy this file into: <your-command-path>/peg-play.mjs

    For example: /usr/local/bin/peg-play.mjs (or similar on your $PATH)

        > chmod +x /usr/local/bin/peg-play.mjs
    
    Usage:

        > peg-play.mjs my-test.txt

`; // doco

import peg from "./pPEG.mjs"; // <== EDIT.ME to relocate

import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import process from "node:process";

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
 * @return {boolean}
 */
function test_file(file, json, silent = false) {
	if (!file.endsWith(".txt")) {
		say(`**** Skip '${file}' this is not a .txt file...`);
		return false;
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

		const pp = peg.compile(ps);

		if (!pp.ok) {
			// bad grammar
			say(peg.show_err(pp.ptree_metadata));
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
			const tp = pp.parse(s);
			if (tp.ok) {
				say(peg.show_tree(tp.ptree));
			} else {
				// parse failed ...
				say(peg.show_err(tp.ptree_metadata));
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

	function say(msg) {
		if (!silent) console.log(msg);
	}

	function strip_leading_comments(str) {
		if (str === "") return str;
		const rx = str.match(/^((?:[ \t\n\r]*#[^\n\r]*[\n\r]*)*)[ \t\n\r]*(.*)/s);
		return rx[2];
	}
} // test_file

process.exit(failure ? 1 : 0);
