import peg from '../pPEG.mjs'

console.log("date example ....")

const dg = peg.compile(`
    Date  = year '-' month '-' day
    year  = d d d d
    month = d d 
    day   = d d
    d     = [0-9]
`); // '0'/'1'/'2'/'3'/'4'/'5'/'6'/'7'/'8'/'9'

const p = dg.parse("2021-4-05  xxx");

if (p.ok) console.log(JSON.stringify(p.ptree));
else console.log(p.err);

const dt = peg.compile(`
    Date  = year '-' month '-' day
    year  = [0-9]*4
    month = [0-9]*1.. 
    day   = [0-9]*1..2
`)

const d = dt.parse("2021-04-0567");

if (d.ok) console.log(JSON.stringify(d.ptree));
else console.log(d.err);
