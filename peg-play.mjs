#!/usr/bin/env node

const doco = ` 
    This is a little command line tool to play and test pPEG grammars.
    
    Reads a text (.txt) file starting with a pPEG grammar, followed by
    one or more input text tests, each separated by a line starting
    with four or more dashes ----  (see: format below)

    If successful the parse tree is printed, if not errors are reported.

    This makes it easy to play with a pPEG grammar.

    To give it a try run it with node.js:

    > node peg-play.mjs play/date.txt

    This assumes peg-play.mjs is in the same directory as pPEG.mjs,
    if not then read how to install as a command below.

    Multiple grammars with tests can also be combined in a single file.

    Also used for regression testing of multiple files in tests directory.


    ## Test format -----------------------------------------------------

    The test file stars with a pPEG grammar, 
    followed by a separator line:
    -----------------------
    with at least 4 ---- dashes.

    Multiple input tests are separated in the same way.

    The separator before an input test that should fail can be negated:
    ------------------- not 

    Multiple grammars with their tests can be separated with:
    ========================
    a line with at least 4 ==== chars.

 
    ## To install as a command -----------------------------------------

    1. Edit this peg-play.mjs file to import your local copy of pPEG.mjs 

        import peg from './pPEG.mjs'; // <== EDIT.ME to relocate

    2. This command line tool can be used with node:

        > node peg-play.mjs my-test.txt

        But this requires the peg-play.mjs file to be in the same directory as
        the my-test.txt file(s), or the use of absolute path name(s).

    3. Optional: to make peg-play.mjs into a command that can be used directly.
    
        Copy this file into: <your-command-path>/peg-play.mjs
    
        For example: /usr/local/bin/peg-play.mjs (or similar on your $PATH)

        > chmod +x /usr/local/bin/peg-play.mjs
       
        Usage:
    
        > peg-play.mjs my-test.txt

`; // doco

import peg from './pPeg.mjs'; // <== EDIT.ME to relocate

import { lstatSync, readFileSync, readdirSync } from 'node:fs';

if (process.argv.length !== 3 ) {
    console.log("Useage: expects a file name (or directory name) ...\n"+
                "  for more info use > peg-play -h");
    process.exit(1);
}

const path = process.argv[2];

if (path.startsWith('-')) { // options
    // no options so assume -help  .....
    console.log(doco);
    process.exit(1);
}

if (lstatSync(path).isDirectory()) {
    const files = readdirSync(path, 'utf8');
    for (const file of files) {
        test_file(path+'/'+file, true);
    }
} else {
    test_file(path);
};

// read and compile the grammar -----------------------------------------

function test_file(file, silent) {
    if (!file.endsWith('.txt')) {
        say("**** Error: skip '"+file+"' this is not a .txt file...");
        say("   for more info try > node peg-play.mjs -h ");
        return;
    };
    const f1 = readFileSync(file, 'utf8');

    const grammars = f1.split(/[\n\r]*====+[ \t]*([^ \t\n\r]*)[^\n\r]*\r?\n/);

    let peg_ok = 0, peg_err = 0; // pPEGs

    let test_ok = 0, test_err = 0;   // input tests

    for (let i=0; i<grammars.length; i+=2) {

        say("===========================================================");

        const tests = grammars[i].split(/\r?\n----+[ \t]*([^ \t\n\r]*)[^\n\r]*\r?\n/);

        const px = tests[0]; // pPEG grammar source

        say(px);

        const ps = strip_leading_comments(px); // # lines prior to rules

        if (ps === '') continue; // skip grammar that is all comment lines

        const pp = peg.compile(ps);

        say("-----------------------------------------------------------");


        if (!pp.ok) { // bad grammar...
            peg_err += 1;
            say(pp.err);
            say("********************* grammar failed, skip tests....");
            continue;
        }

        // read and parse the input text -----------------------------------------

        let ok = 0, err = 0;

        for (let i=2; i<tests.length; i+=2) {
            const s = tests[i];
            let neg = false;
            say(s);
            if (tests[i-1] === "not") {
                neg = true;
                say(">>>> not");
            } else {
                say(">>>>");
            }
            const tp = pp.parse(s);
            if (tp.ok) {
                say(peg.show_tree(tp.ptree));
            } else { // parse failed ...
                say(tp.err);
            }
            if (tp.ok && !neg || !tp.ok && neg) {
                ok += 1;
                say("----------------------------- ok  "+ok);
            } else {
                err += 1;
                say("***************************** err  "+err+" ********");
            }
        }

        test_ok += ok;
        test_err += err;
        peg_ok += 1;

    } // grammars

    if (peg_err === 0 && test_err === 0) {
        console.log("OK "+file+": all "+test_ok+" test(s), "+peg_ok+" grammar(s) .....");
    } else {
        console.log("**** Error "+file+": Failed "+test_err+" test(s), passed ok "+
                    test_ok+" test(s), failed "+peg_err+" grammar(s)");
    }

    function say(msg) {
        if (!silent) console.log(msg);
    }

    function strip_leading_comments(str) {
        if (str === "") return str;
        let rx = str.match(/^((?:[ \t\n\r]*#[^\n\r]*[\n\r]*)*)[ \t\n\r]*(.*)/s);
        return rx[2];
    }

} // test_file

process.exit(0);
