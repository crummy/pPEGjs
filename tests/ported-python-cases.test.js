import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { compile } from "../pPEG.js";

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
 * @param {{ ok: boolean, ptree: unknown }} expected
 */
function assertParse(compiled, input, expected) {
	const result = compiled.parse(input);
	assert.equal(
		result.ok,
		expected.ok,
		`parse status should match for ${JSON.stringify(input)}`,
	);
	assert.deepEqual(result.ptree(), expected.ptree);
}

/** @type {Array<{ name: string, grammar: string, cases: Array<[string, { ok: boolean, ptree: unknown }]> }>} */
const parserCases = [
	{
		name: "numeric repeat exact count",
		grammar: `
s = x*3
x = [a-z]`,
		cases: [
			[
				"abc",
				{
					ok: true,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", "b"],
							["x", "c"],
						],
					],
				},
			],
			[
				"ab",
				{
					ok: false,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", "b"],
							["x", ""],
						],
					],
				},
			],
		],
	},
	{
		name: "numeric repeat closed range",
		grammar: `
s = x*3..5
x = [a-z]`,
		cases: [
			[
				"abc",
				{
					ok: true,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", "b"],
							["x", "c"],
						],
					],
				},
			],
			[
				"abcd",
				{
					ok: true,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", "b"],
							["x", "c"],
							["x", "d"],
						],
					],
				},
			],
			[
				"abcde",
				{
					ok: true,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", "b"],
							["x", "c"],
							["x", "d"],
							["x", "e"],
						],
					],
				},
			],
			[
				"ab",
				{
					ok: false,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", "b"],
							["x", ""],
						],
					],
				},
			],
			[
				"abcdef",
				{
					ok: false,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", "b"],
							["x", "c"],
							["x", "d"],
							["x", "e"],
						],
					],
				},
			],
		],
	},
	{
		name: "numeric repeat open range",
		grammar: `
s = x*2..
x = [a-z]`,
		cases: [
			[
				"ab",
				{
					ok: true,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", "b"],
						],
					],
				},
			],
			[
				"abc",
				{
					ok: true,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", "b"],
							["x", "c"],
						],
					],
				},
			],
			[
				"abcdefg",
				{
					ok: true,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", "b"],
							["x", "c"],
							["x", "d"],
							["x", "e"],
							["x", "f"],
							["x", "g"],
						],
					],
				},
			],
			[
				"a",
				{
					ok: false,
					ptree: [
						"s",
						[
							["x", "a"],
							["x", ""],
						],
					],
				},
			],
		],
	},
	{
		name: "star and optional in a sequence",
		grammar: `
s = x* '|' y?
x = [a-z]+
y = [a-z]+`,
		cases: [
			[
				"abc|def",
				{
					ok: true,
					ptree: [
						"s",
						[
							["x", "abc"],
							["y", "def"],
						],
					],
				},
			],
			["|", { ok: true, ptree: ["s", "|"] }],
		],
	},
	{
		name: "empty alternatives",
		grammar: `
s = x* / y? / z
x = [0-9]+
y = [a-z]+
z = [A-Z]*`,
		cases: [
			["123", { ok: true, ptree: ["x", "123"] }],
			["abc", { ok: false, ptree: ["x", ""] }],
			["ABC", { ok: false, ptree: ["x", ""] }],
			[
				"1aB",
				{
					ok: false,
					ptree: [
						"s",
						[
							["x", "1"],
							["x", ""],
						],
					],
				},
			],
			["", { ok: true, ptree: ["s", ""] }],
		],
	},
	{
		name: "failed fallback nodes do not leak into the final tree",
		grammar: `
s = t y*
t = (x x)*
x = [a-z]
y = [a-z]`,
		cases: [
			[
				"a",
				{
					ok: true,
					ptree: [
						"s",
						[
							["t", ""],
							["y", "a"],
						],
					],
				},
			],
			[
				"ab",
				{
					ok: true,
					ptree: [
						"t",
						[
							["x", "a"],
							["x", "b"],
						],
					],
				},
			],
			[
				"abc",
				{
					ok: true,
					ptree: [
						"s",
						[
							[
								"t",
								[
									["x", "a"],
									["x", "b"],
								],
							],
							["y", "c"],
						],
					],
				},
			],
			[
				"abcd",
				{
					ok: true,
					ptree: [
						"t",
						[
							["x", "a"],
							["x", "b"],
							["x", "c"],
							["x", "d"],
						],
					],
				},
			],
		],
	},
	{
		name: "lowercase rules elide redundant root nodes",
		grammar: `
s = x? y
x = 'x'+
y = 'y'*`,
		cases: [
			[
				"xy",
				{
					ok: true,
					ptree: [
						"s",
						[
							["x", "x"],
							["y", "y"],
						],
					],
				},
			],
			["yy", { ok: true, ptree: ["y", "yy"] }],
		],
	},
	{
		name: "capitalized rules retain the root node",
		grammar: `
S = x? y
x = 'x'+
y = 'y'*`,
		cases: [
			[
				"xy",
				{
					ok: true,
					ptree: [
						"S",
						[
							["x", "x"],
							["y", "y"],
						],
					],
				},
			],
			["yy", { ok: true, ptree: ["S", [["y", "yy"]]] }],
		],
	},
	{
		name: "not-predicate fallback using current any-character syntax",
		grammar: `
s = !x y / z
x = 'x' 'y'
y = ~[]*
z = ~[]*`,
		cases: [
			["xy", { ok: true, ptree: ["z", "xy"] }],
			["yy", { ok: true, ptree: ["y", "yy"] }],
			["", { ok: true, ptree: ["y", ""] }],
			["x", { ok: true, ptree: ["y", "x"] }],
		],
	},
	{
		name: "not-consumed fallback using current any-character syntax",
		grammar: `
s = ~x / y
x = 'x'
y = ~[]*`,
		cases: [
			["xy", { ok: true, ptree: ["y", "xy"] }],
			["y", { ok: true, ptree: ["s", "y"] }],
			["", { ok: true, ptree: ["y", ""] }],
		],
	},
	{
		name: "empty input with zero-or-more any-character",
		grammar: `
s = ~[]*`,
		cases: [
			["xy", { ok: true, ptree: ["s", "xy"] }],
			["", { ok: true, ptree: ["s", ""] }],
		],
	},
];

describe("Ported Python Cases", () => {
	for (const { name, grammar, cases } of parserCases) {
		test(name, () => {
			const compiled = compileGrammar(grammar);
			for (const [input, expected] of cases) {
				assertParse(compiled, input, expected);
			}
		});
	}

	test("Python-style := rule syntax is supported", () => {
		const compiled = compileGrammar(`
s := x? y
x = 'x'+
y = 'y'*`);

		assertParse(compiled, "xy", {
			ok: true,
			ptree: [
				"s",
				[
					["x", "x"],
					["y", "y"],
				],
			],
		});
	});
});
