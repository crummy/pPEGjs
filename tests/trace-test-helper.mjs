import assert from "node:assert/strict";
import peg from "../pPEG.mjs";

function compactTraceElement(element) {
	const label = element.failed
		? `!${element.rule}`
		: element.dropped
			? `-${element.rule}`
			: element.rule;
	if (element.children.length === 0) return label;
	return [label, element.children.map(compactTraceElement)];
}

function assertCompactTrace(result, expected) {
	assert.deepEqual(compactTraceElement(peg.show_trace(result)), expected);
}

export { assertCompactTrace, compactTraceElement };
