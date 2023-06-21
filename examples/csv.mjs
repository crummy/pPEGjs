import peg from '../pPEG.mjs';

console.log("CSV example....")

// const csv = peg.compile(`
//     CSV     = Hdr Row+
//     Hdr     = Row
//     Row     = field (',' field)* '\r'? '\n'
//     field   = _string / _text / ''

//     _text   = ~[,\n\r]+
//     _string = '"' (~["] / '""')* '"'
// `);

// Header row is optional application specific, not necessary as a grammar rule
// There must be end-of-line characters after the last row -- should not be required.

// const csv = peg.compile(`
//     CSV     = Row+
//     Row     = field (',' field)* [\n\r]
//     field   = _string / _text

//     _text   = ~[,\n\r]*
//     _string = '"' (~["] / '""')* '"'
// `);

// The problem now is that there is a trailing row with an empty field!
// It is hard to see any way to avoid this!

// const csv = peg.compile(`
// CSV     = _ Row+
// Row     = __ field (',' field)* _
// field   = _string / _text

// _text   = ~[,\n\r]*
// _string = '"' (~["] / '""')* '"'
// __      = &(~[])   # A Row can be anything, but not nothing!
// _       = [\n\r]*  # any eol sequence or empty lines, or eof
// `);

// const csv = peg.compile(`
// CSV     = Row+
// Row     = field (',' field)* _eol
// field   = _string / _text

// _text   = ~[,\n\r]*
// _string = '"' (~["] / '""')* '"'
// _eol    = '\r'? '\n' / !(~[])
// `);

const csv = peg.compile(`
CSV     = _eol* Row+
Row     = !_eof field (',' field)* _eol
field   = _string / _text

_text   = ~[,\n\r]*
_string = '"' (~["] / '""')* '"'
_eol    = '\r\n' / '\n' / '\r' / _eof
_eof    = !_any
_any    = ~[]
`);


const test = `
A,B,C
a1,b1,c1
a2,"b,2",c2
a3,b3,c3
`;

const p = csv.parse(test);

if (p.ok) console.log(peg.show_tree(p.ptree)); //JSON.stringify(p.ptree));
else console.log(p.err);

/*
CSV example....
["CSV",[["Hdr",[["Row",[["field","A"],["field","B"],["field","C"]]]]],
    ["Row",[["field","a1"],["field","b1"],["field","c1"]]],
    ["Row",[["field","a2"],["field","\"b,2\""],["field","c2"]]],
    ["Row",[["field","a3"],["field","b3"],["field","c3"]]]]]

CSV example....
CSV
├─Hdr
│ └─Row
│   ├─field "A"
│   ├─field "B"
│   └─field "C"
├─Row
│ ├─field "a1"
│ ├─field "b1"
│ └─field "c1"
├─Row
│ ├─field "a2"
│ ├─field ""b,2""
│ └─field "c2"
└─Row
  ├─field "a3"
  ├─field "b3"
  └─field "c3"
*/