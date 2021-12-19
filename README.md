# pPEGjs

This is an implementation of [pPEG] in JavaScript.

See: <https://github.com/pcanz/pPEG>

##  Example

``` js
    import peg from './pPEG.mjs'

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
    ["URI",[["scheme","http"],["auth","www.ics.uci.edu"],["path","/pub/ietf/uri/"],["frag","Related"]]]
    */
```
For an interactive demo try the [dingus].


[pPEG]: https://github.com/pcanz/pPEG
[dingus]: https://pcanz.github.io/pPEGjs/dingus.html
