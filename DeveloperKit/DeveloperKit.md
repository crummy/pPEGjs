#   A pPEG Parser Machine Developer Kit



Step 1:     [Machine-1]

    date grammar
    4-instruction parser machine
    no parse tree generation
    50 LOC grammar and parser code
    50 LOC parser machine

Step 2:     [Machine-2]

    date grammar, 
    4-instruction parser machine,
    generating a parse tree.
    100 LOC parser machine

Step 3:     [Machine-3]

    date grammar, 
    7-instruction parser machine,
    130 LOC parser machine

Step 4:     [Machine-4]

    pPEG boot grammar, 
    8-instruction parser machine,
    150 LOC parser machine

Step 5:     [Machine-5]

    full pPEG grammar, 
    8-instruction parser machine,
    parser_code from pPEG ptree,
    export grammar compile API
    200 LOC parser machine        

A full pPEG implementation:     [Machine-6]

     50 LOC pPEG grammar source and Json ptree
    250 LOC parser machine
    250 LOC compiler
    250 LOC fault and trace reporting
    130 LOC built-in extensions
    950 LOC total

[Machine-1]: https://github.com/pcanz/pPEGjs/blob/master/DeveloperKit/machine-1.js
[Machine-2]: https://github.com/pcanz/pPEGjs/blob/master/DeveloperKit/machine-2.js
[Machine-3]: https://github.com/pcanz/pPEGjs/blob/master/DeveloperKit/machine-3.js
[Machine-4]: https://github.com/pcanz/pPEGjs/blob/master/DeveloperKit/machine-4.js
[Machine-5]: https://github.com/pcanz/pPEGjs/blob/master/DeveloperKit/machine-5.js
[Machine-6]: https://github.com/pcanz/pPEGjs/blob/master/pPEG.mjs