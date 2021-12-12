# pPEGjs

This is an implementation of [pPEG] in JavaScript.

See: <https://github.com/pcanz/pPEG>

##  Example

    import peg from './pPEG.mjs'

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

    console.log(JSON.stringify(parse));

    /*
    url grammar...
    ["URI",[["scheme","http"],["auth","www.ics.uci.edu"],["path","/pub/ietf/uri/"],["frag","Related"]]]
    */


[pPEG]: https://github.com/pcanz/pPEG
