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
    assert.deepEqual(peg.show_trace(result), expected.trace);
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
			trace: {
                rule: "date",
                success: false,
                start: 0,
                end: 8,
                children: [{
                    rule: "year",
                    success: true,
                    start: 0,
                    end: 4,
                    children: []
                }, {
                    rule: "month",
                    success: true,
                    start: 5,
                    end: 7,
                    children: []
                }, {
                    rule: "day",
                    success: false,
                    start: 8,
                    end: 9,
                    children: []
                }]
            }
		})
	})

    test("should only mark ancestors as failed, with sibling with depth", () => {
        const compiled = compileGrammar(`
root = a b a
a = '1' / b
b = '2'`)
        assertTrace(compiled, '223', {
            ok: false,
            trace: {
                rule: "root",
                success: false,
                start: 0,
                end: 2,
                children: [{
                    rule: "a",
                    success: true,
                    start: 0,
                    end: 1,
                    children: [{
                        rule: "b",
                        success: true,
                        start: 0,
                        end: 1,
                        children: []
                    }]
                }, {
                    rule: "b",
                    success: true,
                    start: 0,
                    end: 1,
                    children: []
                }, {
                    rule: "b",
                    success: true,
                    start: 1,
                    end: 2,
                    children: []
                }, {
                    rule: "a",
                    success: false,
                    start: 2,
                    end: 2,
                    children: []
                }]
            }
        })
    })
})
