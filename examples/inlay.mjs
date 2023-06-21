import peg from '../pPEG.mjs';

console.log("Inset blocks example....");


const block = peg.compile(`
    block  = (inlay / line)*
    inlay  = indent line (<at inset> !sp line / inlay)*
    indent = &(<at inset> sp) inset
    inset  = ' '+ / '\t'+
    blank  = sp* _nl
    line   = ~[\n\r]* _nl?
    sp     = ' ' / '\t'
    _nl     = '\n' / '\r' '\n'?
`);

const test = `
line 1
    line 1.1
line 2
`;


const p = block.parse(test);

if (p.ok) console.log(peg.show_tree(p.ptree)); //JSON.stringify(p.ptree));
else console.log(p.err);

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