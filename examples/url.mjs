import peg from '../pPEG.mjs'

console.log("url grammar...");

const uri = peg.compile(`
    URI     = (scheme ':')? ('//' auth)? path ('?' query)? ('#' frag)?
    scheme  = ~[:/?#]+
    auth    = ~[/?#]*
    path    = ~[?#]*
    query   = ~'#'*
    frag    = ~[ \t\n\r]*
`);

const test = "http://www.ics.uci.edu/pub/ietf/uri/#Related";

const parse = uri.parse(test);

if (parse.ok) console.log(JSON.stringify(parse.ptree));
else console.log(parse.err);

/*
url grammar...
["URI",[["scheme","http"],["auth","www.ics.uci.edu"],["path","/pub/ietf/uri/"],["frag","Related"]]]
*/
