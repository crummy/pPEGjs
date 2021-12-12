import peg from '../pPEG.mjs'

import fs from 'fs';
import cp from 'child_process';
import readline from 'readline-sync';

/*
.../tests/            // __dirname
          RUN.mjs     // test.js     // run test cases
          test1.txt   // test cases
          test2.txt   // test cases
          ...
          test-records/
                      test1.txt-record  // previous resuts 
                      ...
*/

// let files = fs.readdirSync(__dirname); // .../tests/
let files = fs.readdirSync(new URL('./', import.meta.url)); // .../tests/
let txts = files.filter((path) => path.slice(-4) === ".txt");

// console.log(txts);

for (const file of txts) {
    const file_path = new URL('./'+file, import.meta.url); // __dirname+'/'+file;
    const result_path = new URL('./test-records/'+file+'-result', import.meta.url);
    // __dirname+'/test-records/'+file+'-result';
    const record_path = new URL('./test-records/'+file+'-record', import.meta.url);
    // __dirname+'/test-records/'+file+'-record';
    let tests = fs.readFileSync(file_path, 'utf8');
    let results = run_tests(file, tests);
    let record = read_file(record_path);
    if (!record) { // no file.txt-record
        console.log(results);
        if (!new_record(file, record_path, results)) break;
    } else if (results === record) {
        console.log('OK '+file);
    } else { // errors...
        console.log("Error: "+file+'-result !== '+file+'-record');
        write_file(result_path, results);
        const obj = cp.spawnSync("diff", ["-y", result_path, record_path]);
        console.log(obj.output.toString());
        if (!new_record(file, record_path, results))
            break; // skip rest of test files...
    } 
}

function new_record(file, record_path, results) {
    if (!readline.keyInYN("OK to record results?"))
        return false;
    console.log("New: "+file+'-record');
    write_file(record_path, results);
    return true;
}

function read_file(file) {
    try {
        const record = fs.readFileSync(file, 'utf8');
        return record;
    } catch (err) {
        // console.log(err);
    }
    return undefined;
}

function write_file(file, data) {
    try {
        const record = fs.writeFileSync(file, data, 'utf8');
    } catch (err) {
        console.log(err);
    }
}

function run_tests(name, tests) {
    let results = [];
    const test_cases = tests.split("\n---\n");
    for (let i=0; i<test_cases.length; i+=1) {
        const test_case = test_cases[i].split("\n--\n");
        results.push("--- "+name+" case:"+(i+1));
        results.push(test_case[0]);
        const grammar = peg.compile(test_case[0]); // TODO catch err
        for (let j=1; j<test_case.length; j+=1) {
            if (!test_case[j]) continue;
            results.push('--  '+name+" case:"+(i+1)+" input:"+j);
            results.push(test_case[j]);
            results.push("-");
            try {
                const p = grammar.parse(test_case[j]);
                if (p.ok) {
                    results.push(JSON.stringify(p.ptree));
                } else {
                    results.push("Error: "+p.err);
                }    
            } catch (error) {
                results.push(error);
            }
        }
    }
    return results.join("\n");
}
