import assert from "node:assert/strict";
import {describe, test} from "node:test";
import peg from "../pPEG.mjs";

function compileGrammar(grammar) {
    const compiled = peg.compile(grammar);
    assert.equal(compiled.ok, true, "grammar should compile");
    return compiled;
}

function assertParse(compiled, input, expected) {
    const result = compiled.parse(input, expected.options);
    assert.equal(result.ok, expected.ok, "parse result should match expectation");
    if (expected.ok && "ptree" in expected) {
        assert.deepEqual(result.ptree, expected.ptree);
    }
}

describe("Parser Output", () => {
    describe("Backtracking", () => {
        test("failed sequence branch does not leak into final ptree", () => {
            const compiled = compileGrammar(`
p = x d / x
x = [a-z]
d = [0-9]`);
            assertParse(compiled, "a", {
                ok: true,
                ptree: ["x", "a"],
            });
        });
    });
});
