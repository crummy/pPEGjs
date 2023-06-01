import peg from '../pPEG.mjs'

console.log("json grammar...");

const json = peg.compile(`
    json   = _ value _
    value  =  Str / Arr / Obj / num / lit
    Obj    = '{' _ (memb (',' _ memb)*)? _ '}'
    memb   = Str _ ':' _ value _
    Arr    = '[' _ (value (_ ',' _ value)*)? _ ']'
    Str    = '"' chars* '"'
    chars  = ~[\u0000-\u001F"\\]+ / '\\' esc
    esc    = ["\\/bfnrt] / 'u' [0-9a-fA-F]*4
    num    = _int _frac? _exp?
    _int   = '-'? ([1-9] [0-9]* / '0')
    _frac  = '.' [0-9]+
    _exp   = [eE] [+-]? [0-9]+
    lit    = 'true' / 'false' / 'null'
    _      = [ \t\n\r]*
`);

// Obj Arr Str need to be caps (they can be empty)

const p = json.parse(`
  { "answer": 42,
    "mixed": [1, 2.3, "a\\tstring", true, [4, 5]],
    "empty": {}
  }
`);

if (p.ok) console.log(JSON.stringify(p.ptree));
else console.log(p.err);

/*
json grammar...
["Obj",[["memb",[["Str",[["chars","answer"]]],["num","42"]]],["memb",[["Str",[["chars","mixed"]]],["Arr",[["num","1"],["num","2.3"],["Str",[["chars","a"],["esc","t"],["chars","string"]]],["lit","true"],["Arr",[["num","4"],["num","5"]]]]]]],["memb",[["Str",[["chars","empty"]]],["Obj","{}"]]]]]
*/
