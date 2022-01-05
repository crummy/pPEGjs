import peg from '../pPEG.mjs'

const pPEG_grammar = `
    Peg   = " " (rule " ")+
    rule  = id " = " alt

    alt   = seq (" / " seq)*
    seq   = rep (" " rep)*
    rep   = pre sfx?
    pre   = pfx? term
    term  = call / sq / dq / chs / group / extn

    id    = [a-zA-Z_] [a-zA-Z0-9_]*
    pfx   = [&!~]
    sfx   = [+?] / '*' range?
    range = num (dots num?)?
    num   = [0-9]+
    dots  = '..'

    call  = id !" ="
    sq    = "'" ~"'"* "'" 'i'?
    dq    = '"' ~'"'* '"' 'i'?
    chs   = '[' ~']'* ']'
    group = "( " alt " )"
    extn  = '<' ~'>'* '>'

    _space_ = ('#' ~[\n\r]* / [ \t\n\r]+)*
`;

function test(times) {
    for (let i=0; i<times; i+=1) {
        peg.compile(`
        date  = year '-' month '-' day
        year  = [0-9]+
        month = [0-9]+
        day   = [0-9]+
        `)
        // peg.compile(pPEG_grammar)
    }
}

const times = 100000

let tests = "times "+times
console.time(tests)
test(times)
console.timeEnd(tests)

/* 
    iMac M1
    0.092 ms to compile(pPEG_grammar)
    0.013 ms to compile(date)

*/
