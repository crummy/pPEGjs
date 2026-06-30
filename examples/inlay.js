import { compile } from "../pPEG.js";

console.log("Inset blocks example....");

const block = compile(
	`
    block  = (inlay / line)*
    inlay  = indent line (<at inset> !sp line / inlay)*
    indent = &(<at inset> sp) inset
    inset  = ' '+ / '\t'+
    blank  = sp* _nl
    line   = ~[\n\r]* _nl?
    sp     = ' ' / '\t'
    _nl     = '\n' / '\r' '\n'?
`,
	{},
	{ at: sameMatch },
);

const test = `
line 1
    line 1.1
line 2
`;

const p = block.parse(test);

console.log(JSON.stringify(p.ptree()));

/**
 * @param {import("../pPEG.js").Parse} parse
 * @param {string[]} args
 */
function sameMatch(parse, args) {
	const name = args[1];
	const id = parse.code.names.indexOf(name);
	if (id < 0) throw new Error(`<${args.join(" ")}> undefined rule: ${name}`);

	let prior = "";
	for (let i = parse.trace.length - 1; i >= 0; i--) {
		const node = parse.trace[i];
		if (node.fault() || node.idx() !== id) continue;
		prior = parse.input.slice(node.start, node.end);
		break;
	}
	if (prior === "") return true;
	if (!parse.input.startsWith(prior, parse.pos)) return false;
	parse.pos += prior.length;
	return true;
}

/*
Inset blocks example....
block
├─line "\n"
├─line "line 1\n"
├─inlay
│ ├─inset "    "
│ └─line "line 1.1\n"
├─line "line 2\n"
└─line ""
*/
