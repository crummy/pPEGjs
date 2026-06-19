import assert from "node:assert/strict";

const FAIL = 0x2000;
const DROP = 0x1000;
const ID_VAL = 0x0fff;

/**
 * @typedef {object} TraceElement
 * @property {string} rule
 * @property {boolean} failed
 * @property {boolean} dropped
 * @property {number} start
 * @property {number} end
 * @property {TraceElement[]} children
 */

/**
 * @param {import("../pPEG.js").Parse} parse
 * @param {number} index
 * @returns {[TraceElement, number]}
 */
function traceElementAt(parse, index) {
	const node = parse.trace[index];
	assert.ok(node);
	/** @type {TraceElement} */
	const element = {
		rule: parse.code.names[node.id & ID_VAL],
		failed: (node.id & FAIL) !== 0,
		dropped: (node.id & DROP) !== 0,
		start: node.start,
		end: node.end,
		children: [],
	};
	let next = index + 1;
	while (next < parse.trace.length && parse.trace[next].depth > node.depth) {
		const [child, childNext] = traceElementAt(parse, next);
		element.children.push(child);
		next = childNext;
	}
	return [element, next];
}

/**
 * @param {import("../pPEG.js").Parse} parse
 * @returns {TraceElement}
 */
function showTrace(parse) {
	return traceElementAt(parse, 0)[0];
}

/**
 * @param {TraceElement} element
 * @returns {string | [string, Array<string | [string, unknown]>]}
 */
function compactTraceElement(element) {
	const label = element.failed
		? `!${element.rule}`
		: element.dropped
			? `-${element.rule}`
			: element.rule;
	if (element.children.length === 0) return label;
	return [label, element.children.map(compactTraceElement)];
}

/**
 * @param {import("../pPEG.js").Parse} result
 * @param {unknown} expected
 */
function assertCompactTrace(result, expected) {
	assert.deepEqual(compactTraceElement(showTrace(result)), expected);
}

export { assertCompactTrace, compactTraceElement, showTrace };
