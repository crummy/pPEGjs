# pPEGjs

A portable Parser Expression Grammar.

For more information see: [pPEG].

To see a demo try the [dingus] web-page.

To develop your own pPEG grammar use the [peg-play] command line tool.

The peg-play.mjs module is a small node.js command line tool to
compile and run files with a pPEG grammar and input text test(s).

The play/ directory has some examples for peg-play.mjs to run.

The examples/ directory has examples of how to use pPEG in JavaScript.

This repo is an implementation of [pPEG] in JavaScript, for other languages see: [INDEX].

To use pPEG the single file JavaScript module pPEG.mjs is all you need.
It has no dependencies, it can be run in Node.js or in a browser.

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

    if (!pURI.ok) throw "URI grammar error:\n"+pURI.show_err();

    const test = "http://www.ics.uci.edu/pub/ietf/uri/#Related";

    const uri = pURI.parse(test);

    if (uri.ok) console.log(uri.show_ptree());
    else console.log(uri.show_err());

    /*
    uri.ptree =
    ["URI",[["scheme","http"],["auth","www.ics.uci.edu"],["path","/pub/ietf/uri/"],
            ["frag","Related"]]]

    uri.show_ptree() =>
    URI
    ├─scheme "http"
    ├─auth "www.ics.uci.edu"
    ├─path "/pub/ietf/uri/"
    └─frag "Related"
    */
```

##  API

The `import` provides a `peg` object with a `compile` function which takes a string that defines your grammar.

The `compile` result is an parser object with a `parse` function:

    {
      ok: boolean, true if there are no errors,

      err: int, # an error code, 0=ok, 1=panic, ...

      show_err: () => a full error report.

      parse: (String) => parser object
    }

The `parser.parse` function takes a string and generates a parse-tree object:

    {
      ok: boolean, true if there are no errors,

      err: int, # an error code, 0=ok, 1=panic, ...

      show_err: () => a full error report.

      ptree: parse_tree object,

      show_ptree: (fmt) => ptree pretty print string.
                              # default ascii-art tree, 
                              # fmt=true for json format.
    }

The `ptree` parse tree type is JSON data, as defined in [pPEG].



[pPEG]: https://github.com/pcanz/pPEG
[dingus]: https://pcanz.github.io/pPEGjs/dingus.html
[peg-play]: https://github.com/pcanz/pPEGjs/blob/master/play/about-peg-play.md
[INDEX]: https://github.com/pcanz/pPEG/blob/master/INDEX.md