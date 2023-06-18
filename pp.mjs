#!/usr/bin/env node

/* 
    This is a little command line tool to read a pPEG grammar from a file,
    and parse input text read from a second file.

    If successful the parse tree is printed, if not errors are reported.

    This makes it easy to use any text editor to play with pPEG grammars.
    
    To install:

    1. Edit this file below to import your local copy of pPEG.mjs 

        The import statement is immediately below this comment block:

        import peg from '<your-local-path>/pPEG.mjs'; // <== EDIT.ME

    2. This command line tool can then be used with node:

        > node pp.mjs test.peg test.txt

        But this requires the pp.mjs file to either be in the same directory as
        the grammar and text files, or be given an absolute path name.

    3. Optional: to make pp.mjs into a command that can be used directly.
    
        Copy this file into: <your-command-path>/pPEG.mjs
    
        For example: /usr/local/bin/pp.mjs (or similar on your $PATH)

        > chmod +x /usr/local/bin/pp.mjs
       
        Usage:
    
        > pp.mjs my-grammar.txt my-test.txt

*/

import peg from '<your-local-path>/pPEG.mjs'; // <== EDIT.ME

import { readFileSync } from 'node:fs';

if (process.argv.length !== 4) {
    console.log("Useage: expects two args: file name for grammar, and input text...")
    process.exit(1);
}

// read and compile the grammar -----------------------------------------

const f1 = readFileSync(process.argv[2], 'utf8');

const p = peg.compile(f1);

if (!p.ok) { // bad grammar...
    console.log(p.err);
    process.exit(2);
}

// read and parse the input text -----------------------------------------

const f2 = readFileSync(process.argv[3], 'utf8'); // input text

const t = p.parse(f2)

if (t.ok) {
    console.log(peg.show_tree(t.ptree));
    process.exit(0);
} else { // parse failed ...
    console.log(t.err);
    process.exit(3);
}
