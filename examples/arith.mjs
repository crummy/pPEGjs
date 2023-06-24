import peg from '../pPEG.mjs'

console.log("Arith operator expression example....")

const arith = peg.compile(`
  exp = add 
  add = sub ('+' sub)*
  sub = mul ('-' mul)*
  mul = div ('*' div)*
  div = pow ('/' pow)*
  pow = val ('^' val)*
  grp = '(' exp ')'
  val = _ (sym / num / grp) _
  sym = [a-zA-Z]+
  num = [0-9]+
  _   = [ \t\n\r]*
`);

const tests = [
    ` 1 + 2 * 3 `,
    `x^2^3 - 1`
];

for (let test of tests) {
    const p = arith.parse(test);
    if (p.ok) console.log(p.show_ptree()); //JSON.stringify(p.ptree));
    else console.log(p.show_err());
}

// 1+2*3 ==> (+ 1 (* 2 3))
// ["add",[["num","1"],["mul",[["num","2"],["num","3"]]]]]

// x^2^3+1 ==> (+ (^ x 2 3) 1)
// ["add",[["pow",[["sym","x"],["num","2"],["num","3"]]],["num","1"]]]
/*
Arith operator expression example....
add
├─num "1"
└─mul
  ├─num "2"
  └─num "3"
sub
├─pow
│ ├─sym "x"
│ ├─num "2"
│ └─num "3"
└─num "1"
*/