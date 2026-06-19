import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { compile } from "../pPEG.js";
import { assertCompactTrace, showTrace } from "./trace-test-helper.js";

const FAIL = 0x2000;
const DROP = 0x1000;
const ID_VAL = 0x0fff;

/** @param {string} grammar @returns {import("../pPEG.js").Code} */
function compileGrammar(grammar) {
	try {
		return compile(grammar);
	} catch (error) {
		assert.fail(`grammar should compile: ${String(error)}`);
	}
}

/**
 * @param {import("../pPEG.js").Code} compiled
 * @param {string} input
 * @param {{ ok: boolean, ptree: unknown, options?: number }} expected
 */
function assertTree(compiled, input, expected) {
	const result = compiled.parse(input, expected.options);
	assert.equal(result.ok, expected.ok, "parse result should match expectation");
	assert.deepEqual(result.ptree(), expected.ptree);
}

/**
 * @param {import("../pPEG.js").Code} compiled
 * @param {string} input
 * @param {{ ok: boolean, trace: unknown, options?: number }} expected
 */
function assertTrace(compiled, input, expected) {
	const result = compiled.parse(input, expected.options);
	assert.equal(result.ok, expected.ok, "parse result should match expectation");
	assertCompactTrace(result, expected.trace);
}

describe("Parser Output", () => {
	describe("Backtracking", () => {
		test("failed sequence branch does not leak into final ptree", () => {
			const compiled = compileGrammar(`
p = x d / x
x = [a-z]
d = [0-9]`);
			assertTree(compiled, "a", {
				ok: true,
				ptree: ["x", "a"],
			});
		});

		test("negation does not leak into final ptree", () => {
			const compiled = compileGrammar(`s = P+ x
P = x &x
x = [a-z]`);

			assertTree(compiled, "abc", {
				ok: true,
				ptree: [
					"s",
					[
						["P", [["x", "a"]]],
						["P", [["x", "b"]]],
						["x", "c"],
					],
				],
			});
		});
	});

	describe("Malformed JSON", () => {
		test("failed root trace spans as far as the failed parse progressed", () => {
			const compiled = compileGrammar(String.raw`
json   = _ value _
value  =  Str / Arr / Obj / num / lit
Obj    = '{'_ (memb (_','_ memb)*)? _'}'
memb   = Str _':'_ value
Arr    = '['_ (value (_','_ value)*)? _']'
Str    = '"' chars* '"'
chars  = ~[\u0000-\u001F"\]+ / '\' esc
esc    = ["\/bfnrt] / 'u' [0-9a-fA-F]*4
num    = _int _frac? _exp?
_int   = '-'? ([1-9] [0-9]* / '0')
_frac  = '.' [0-9]+
_exp   = [eE] [+-]? [0-9]+
lit    = 'true' / 'false' / 'null'
_      = [ \t\n\r]*`);

			const result = compiled.parse("{a}");
			assert.equal(result.ok, false);

			const trace = showTrace(result);
			assert.equal(trace.rule, "json");
			assert.equal(trace.failed, true);
			assert.equal(trace.start, 0);
			assert.equal(trace.end, 1);
			assert.equal(trace.children[0].rule, "value");
			assert.equal(trace.children[0].start, 0);
			assert.equal(trace.children[0].end, 1);
			assert.equal(trace.children[0].children[2].rule, "Obj");
			assert.equal(trace.children[0].children[2].start, 0);
			assert.equal(trace.children[0].children[2].end, 1);

			assert.deepEqual(result.ptree(), ["lit", ""]);
		});
	});
});

const dateGrammar = compileGrammar(`
date  = year '-' month '-' day
year  = [1-2][0-9]*3
month = '0'[1-9] / '1'[0-2]
day   = [0-3][0-9]`);

describe("Error flagging", () => {
	test("should only mark ancestors as failed", () => {
		assertTrace(dateGrammar, "2021-02-0d3", {
			ok: false,
			trace: ["!date", ["-year", "-month", "!day"]],
		});
	});

	test("should only mark ancestors as failed, with sibling with depth", () => {
		const compiled = compileGrammar(`
root = a b a
a = '1' / b
b = '2'`);
		assertTrace(compiled, "223", {
			ok: false,
			trace: ["!root", [["-a", ["b"]], "-b", ["!a", ["!b"]]]],
		});
	});

	test("should keep successful repeated fields before a failing field", () => {
		const compiled = compileGrammar(`
minijson = '{' field (','field)*  '}'
field = key ':' (value/minijson)
key = string
value = string
string = '"' [a-z]+ '"'`);

		assertTrace(compiled, '{"foo":"bar","baz"x"v"}', {
			ok: false,
			trace: [
				"!minijson",
				[
					[
						"-field",
						[
							["key", ["string"]],
							["value", ["string"]],
						],
					],
					["!field", [["-key", ["string"]]]],
				],
			],
		});
	});

	test("should mark dropped trace entries separately from failures", () => {
		const compiled = compileGrammar(`
s = t y*
t = (x x)*
x = [a-z]
y = [a-z]`);

		const result = compiled.parse("abc");
		assert.equal(result.ok, true);
		assertCompactTrace(result, [
			"s",
			[["t", ["x", "x", "-x", "!x"]], "y", "!y"],
		]);

		const decoded = result.trace.map((entry) => ({
			ruleId: entry.id & ID_VAL,
			failed: (entry.id & FAIL) !== 0,
			dropped: (entry.id & DROP) !== 0,
			start: entry.start,
			end: entry.end,
		}));

		assert.deepEqual(
			decoded.map((entry) => ({
				rule: result.code.names[entry.ruleId],
				failed: entry.failed,
				dropped: entry.dropped,
				start: entry.start,
				end: entry.end,
			})),
			[
				{ rule: "s", failed: false, dropped: false, start: 0, end: 3 },
				{ rule: "t", failed: false, dropped: false, start: 0, end: 2 },
				{ rule: "x", failed: false, dropped: false, start: 0, end: 1 },
				{ rule: "x", failed: false, dropped: false, start: 1, end: 2 },
				{ rule: "x", failed: false, dropped: true, start: 2, end: 3 },
				{ rule: "x", failed: true, dropped: true, start: 3, end: 3 },
				{ rule: "y", failed: false, dropped: false, start: 2, end: 3 },
				{ rule: "y", failed: true, dropped: false, start: 3, end: 3 },
			],
		);
	});

	test("should preserve completed array items in ptree before missing closing delimiter", () => {
		const compiled = compileGrammar(`
Arr = '[' (Arr / int / _)* ']'
int = [0-9]+
_   = [ \\t\\n\\r]`);

		assertTree(compiled, "[1 2", {
			ok: false,
			ptree: [
				"Arr",
				[
					["int", "1"],
					["int", "2"],
					["int", ""],
				],
			],
		});
	});
});
