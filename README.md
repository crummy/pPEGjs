# pPEGjs

This is an implementation of [pPEG] in JavaScript.

A single file JavaScript module with no dependencies, that can be run in Node.js or in a browser.

##  Example

``` js
    import peg from './pPEG.mjs'

    // Equivalent to the regular expression for well-formed URI's in RFC 3986.

    const pURI = peg.compile(`
        URI     = (scheme ':')? ('//' auth)? path ('?' query)? ('#' frag)?
        scheme  = ~[:/?#]+
        auth    = ~[/?#]*
        path    = ~[?#]*
        query   = ~'#'*
        frag    = ~[ \t\n\r]*
    `);

    if (!pURI.ok) throw "URI grammar error: "+pURI.err;

    const test = "http://www.ics.uci.edu/pub/ietf/uri/#Related";

    const uri = pURI.parse(test);

    if (uri.ok) console.log(JSON.stringify(uri.ptree));
    else console.log(uri.err);

    /*
    ["URI",[["scheme","http"],["auth","www.ics.uci.edu"],["path","/pub/ietf/uri/"],["frag","Related"]]]
    */
```

##  API

The `import` provides a `peg` object with a `compile` function which takes a string that defines your grammar.

The `compile` result is an object with a `parse` function:

    {
      ok: Boolean, true if there are no errors,

      err: String, an error report,

      parse: (String) => poi
    }

The `parse` function takes a string and generates a `poi` object:

    {
      ok: Boolean, true if there are no errors,

      err: String, an error report,

      ptree: parse tree
    }

The `ptree` parse tree type is JSON data, as defined in [pPEG].



[pPEG]: https://github.com/pcanz/pPEG
