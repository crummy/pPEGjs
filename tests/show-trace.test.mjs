import assert from "node:assert/strict";
import {describe, test} from "node:test";
import peg from "../pPEG.mjs";

describe("Date", () => {

    const grammar = `
date  = year '-' month '-' day
year  = [1-2][0-9]*3
month = '0'[1-9] / '1'[0-2]
day   = [0-3][0-9]`

    const compiled = peg.compile(grammar);

    test("success", () => {
        const result = compiled.parse("2025-01-01")

        assert.deepEqual(peg.show_trace(result), {
            rule: "date",
            success: true,
            start: 0,
            end: 10,
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
                success: true,
                start: 8,
                end: 10,
                children: []
            }]
        })
    })

    test("failure", () => {
        const result = compiled.parse("2025-01-0d")

        assert.deepEqual(peg.show_trace(result), {
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
        })
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

        assert.deepEqual(peg.show_trace(result), {
            rule: "top",
            success: true,
            start: 0,
            end: 2,
            children: [{
                rule: "pair",
                success: true,
                start: 0,
                end: 2,
                children: [{
                    rule: "left",
                    success: true,
                    start: 0,
                    end: 1,
                    children: [{
                        rule: "digit",
                        success: true,
                        start: 0,
                        end: 1,
                        children: []
                    }]
                }, {
                    rule: "right",
                    success: true,
                    start: 1,
                    end: 2,
                    children: [{
                        rule: "digit",
                        success: true,
                        start: 1,
                        end: 2,
                        children: []
                    }]
                }]
            }]
        })
    })
})
