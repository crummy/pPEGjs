import assert from "node:assert/strict";
import {describe, test} from "node:test";
import peg from "../pPEG.mjs";

function compileGrammar(grammar) {
    const compiled = peg.compile(grammar);
    assert.equal(compiled.ok, true, "grammar should compile");
    return compiled;
}

function assertTree(compiled, input, expected) {
    const result = compiled.parse(input, expected.options);
    assert.equal(result.ok, expected.ok, "parse result should match expectation");
    assert.deepEqual(result.ptree, expected.ptree);
}

function assertTrace(compiled, input, expected) {
    const result = compiled.parse(input, expected.options);
    assert.equal(result.ok, expected.ok, "parse result should match expectation");
    assert.deepEqual(result.trace_history, expected.trace);
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
                ptree: ['s', [['P', [['x', 'a']]], ['P', [['x', 'b']]], ['x', 'c']]]
            })
        })
    });
});

const dateGrammar = compileGrammar(`
date  = year '-' month '-' day
year  = [1-2][0-9]*3
month = '0'[1-9] / '1'[0-2]
day   = [0-3][0-9]`)

describe("Error flagging", () => {
	test("should only mark ancestors as failed", () => {
		assertTrace(dateGrammar, "2021-02-0d3", {
			ok: false,
			trace: [
                -1, 0, 0, 8, // date, 0..8 - failed
                1, 1, 0, 4, // year, 0..4
                2, 1, 5, 7, // month, 5..7
                -4, 1, 8, 9 // day, 8..9, failed
            ]
		})
	})

    test("should only mark ancestors as failed, with sibling with depth", () => {
        const compiled = compileGrammar(`
root = a b a
a = '1' / b
b = '2'`)
        assertTrace(compiled, '223', {
            ok: false,
            trace: [
                -1, 0,  0, 2, // root, 0..2 - failed
                1, 1, 0, 1, // root > a, 0..1
                2, 2, 0, 1, // root > a > b, 0..1
                2, 1, 1, 2, // root > b, 1..2
                -2, 1, 2, 2 // root > a, 2..2 - failed
            ]
        })
    })
})
