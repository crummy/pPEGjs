# pPEGjs

A portable Parser Expression Grammar.

For more information see: [pPEG].

To see a demo try the [dingus] web-page.

To develop your own pPEG grammar use the [peg-play] command line tool.

The peg-play.js module is a small node.js command line tool to
compile and run files with a pPEG grammar and input text test(s).

The play/ directory has some examples for peg-play.js to run.

The examples/ directory has examples of how to use pPEG in JavaScript.

This repo is an implementation of [pPEG] in JavaScript, for other languages see: [INDEX].

To use pPEG the single file JavaScript module pPEG.js is all you need.
It has no dependencies, it can be run in Node.js or in a browser.

##  Example

``` js
    import { compile } from './pPEG.js'

    // Equivalent to the regular expression for well-formed URI's in RFC 3986.

    const pURI = compile(`
        URI     = (scheme ':')? ('//' auth)? path ('?' query)? ('#' frag)?
        scheme  = ~[:/?#]+
        auth    = ~[/?#]*
        path    = ~[?#]*
        query   = ~'#'*
        frag    = ~[ \t\n\r]*
    `);

    const test = "http://www.ics.uci.edu/pub/ietf/uri/#Related";

    const uri = pURI.parse(test);

    console.log(String(uri));

    /*
    uri.ptree() =
    ["URI",[["scheme","http"],["auth","www.ics.uci.edu"],["path","/pub/ietf/uri/"],
            ["frag","Related"]]]

    String(uri) =>
    URI
    ├─scheme "http"
    ├─auth "www.ics.uci.edu"
    ├─path "/pub/ietf/uri/"
    └─frag "Related"
    */
```

##  API

Import `compile` from `pPEG.js` and pass it a string that defines your grammar.

The `compile` result is a parser object with a `parse` function:

    {
      ok: boolean, true if there are no errors,

      parse: (input: string, start?: number, end?: number) => Parse,

      read: (input: string) => transformed result,

      errors: () => compile error text
    }

The `parser.parse` function takes a string and returns a `Parse` object:

    {
      ok: boolean, true if there are no errors,

      ptree: () => parse_tree object,

      transform: () => transformed result,

      print_tree: () => print the parse tree,

      print_trace: () => print the raw trace,

      toString: () => parse tree or error report
    }

The `ptree` parse tree type is JSON data, as defined in [pPEG].



[pPEG]: https://github.com/pcanz/pPEG
[dingus]: TODO (mc)
[peg-play]: play/about-peg-play.md
[INDEX]: https://github.com/pcanz/pPEG/blob/master/INDEX.md
