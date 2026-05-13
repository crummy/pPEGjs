import {describe, test} from "node:test";
import peg from "../pPEG.mjs";
import {assertCompactTrace} from "./trace-test-helper.mjs";

describe("Date", () => {

    const grammar = `
date  = year '-' month '-' day
year  = [1-2][0-9]*3
month = '0'[1-9] / '1'[0-2]
day   = [0-3][0-9]`

    const compiled = peg.compile(grammar);

    test("success", () => {
        const result = compiled.parse("2025-01-01")

        assertCompactTrace(result, ["date", ["year", "month", "day"]])
    })

    test("failure", () => {
        const result = compiled.parse("2025-01-0d")

        assertCompactTrace(result, ["!date", ["year", "month", "!day"]])
    })
})

describe("Nested traces", () => {

    const grammar = `
top  = pair
pair = left right
left = digit
right = digit
digit = [0-9]`

    const compiled = peg.compile(grammar);

    test("keeps descendants attached to their direct parent", () => {
        const result = compiled.parse("42")

        assertCompactTrace(result, [
            "top",
            [[
                "pair",
                [["left", ["digit"]], ["right", ["digit"]]]
            ]]
        ])
    })
})
