/**
 * Compile a pPEG grammar string into reusable parser code.
 *
 * @param {string} grammar Grammar source.
 * @param {TransformMap} [transforms={}] Transform callbacks keyed by rule name.
 * @param {ExtensionMap} [extras={}] Extension callbacks keyed by extension command name.
 * @returns {Code}
 */
export function compile(grammar: string, transforms?: TransformMap, extras?: ExtensionMap): Code;
export class Node {
    /**
     * @param {number} id Rule id with optional FAIL/DROP flag bits.
     * @param {number} depth Nesting depth in the trace/tree.
     * @param {number} start Inclusive input offset.
     * @param {number} end Exclusive input offset.
     */
    constructor(id: number, depth: number, start: number, end: number);
    /** @type {number} */
    id: number;
    /** @type {number} */
    depth: number;
    /** @type {number} */
    start: number;
    /** @type {number} */
    end: number;
    /** @returns {number} Rule id without trace flags. */
    idx(): number;
    /** @returns {boolean} True when the node carries a FAIL or DROP flag. */
    fault(): boolean;
    /** @returns {Node} */
    clone(): Node;
    /** @returns {string} */
    toString(): string;
}
export class Parse {
    /**
     * @param {Code} code Compiled parser code.
     * @param {string} input Input text to parse.
     * @param {number} [start=-1] Inclusive input offset; negative means start at 0.
     * @param {number} [end=-1] Exclusive input offset; negative means parse through input length.
     */
    constructor(code: Code, input: string, start?: number, end?: number);
    /** @type {boolean} */
    ok: boolean;
    /** @type {Code} */
    code: Code;
    /** @type {string} */
    input: string;
    /** @type {number} */
    pos: number;
    /** @type {number} */
    end: number;
    /** @type {Node[]} Trace nodes for parse record, debugging, and error reporting. */
    trace: Node[];
    /** @type {Node[] | null} Trace pruned into a parse tree. */
    tree: Node[] | null;
    /** @type {boolean} */
    anon: boolean;
    /** @type {number} */
    rule: number;
    /** @type {number} */
    deep: number;
    /** @type {number} */
    max_deep: number;
    /** @type {number} */
    index: number;
    /** @type {number} */
    max_pos: number;
    /** @type {number} */
    max_trace: number;
    /** @type {number} */
    max_tree: number;
    /** @type {number} */
    max_seq_pos: number;
    /** @type {RuntimeExpr | null} */
    max_seq_op: RuntimeExpr | null;
    /** @type {RuntimeExpr | null} */
    expected: RuntimeExpr | null;
    /** @type {boolean} */
    fell_short: boolean;
    /** @type {[RuntimeExpr[], number] | null} */
    empty_alt: [RuntimeExpr[], number] | null;
    /** @type {Record<string, unknown>} */
    extra_state: Record<string, unknown>;
    /** @returns {string} */
    toString(): string;
    /** @param {number} i @returns {string} */
    name(i: number): string;
    /** @param {number} i @returns {string} */
    text(i: number): string;
    /** @param {number} i @returns {boolean} True if the parse tree node is terminal. */
    leaf(i: number): boolean;
    /** @returns {PtreeNode | []} */
    ptree(): PtreeNode | [];
    /** @returns {TransformResult} */
    transform(): TransformResult;
    /** @returns {void} */
    print_trace(): void;
    /** @returns {void} */
    print_tree(): void;
    /** @param {number} id @returns {boolean} */
    run(id: number): boolean;
    /**
     * Run a rule against the exact span covered by an existing node.
     *
     * @param {number} id Rule id to run.
     * @param {Node} node Node whose span should be matched.
     * @returns {boolean}
     */
    match(id: number, node: Node): boolean;
}
export class Code {
    /**
     * @param {Parse | null} peg_parse Parse of the PEG grammar, or null for bootstrapping.
     * @param {CodeOptions} [options]
     */
    constructor(peg_parse: Parse | null, { boot, transforms, extras }?: CodeOptions);
    /** @type {Parse | null} */
    peg_parse: Parse | null;
    ptree: [] | PtreeNode;
    /** @type {string[]} */
    names: string[];
    /** @type {GrammarExpr[]} */
    rules: GrammarExpr[];
    /** @type {RuntimeExpr[]} */
    codes: RuntimeExpr[];
    /** @type {RuleDef[]} */
    defs: RuleDef[];
    /** @type {ExtensionMap} */
    extras: ExtensionMap;
    /** @type {TransformMap} */
    transforms: TransformMap;
    /** @type {string[]} */
    err: string[];
    /** @type {boolean} */
    ok: boolean;
    /** @returns {void} */
    compose(): void;
    /** @returns {string} */
    toString(): string;
    /** @param {string} input @param {number} [start=-1] @param {number} [end=-1] @returns {Parse} */
    parse(input: string, start?: number, end?: number): Parse;
    /** @returns {string} */
    errors(): string;
    /** @param {number} id @returns {string} */
    id_name(id: number): string;
    /** @param {string} input @returns {TransformResult} */
    read(input: string): TransformResult;
    /** @param {string} name @returns {number} */
    name_id(name: string): number;
}
/**
 * Encoded rule definition kind: "=", ":", ":=", or "=:".
 */
export type RuleDef = 0 | 1 | 2 | 3;
export type IdOp = ["id", number];
export type AltOp = ["alt", RuntimeExpr[]];
export type SeqOp = ["seq", RuntimeExpr[]];
export type ReptOp = ["rept", number, number, RuntimeExpr];
export type PredOp = ["pred", "!" | "&", RuntimeExpr];
export type NegOp = ["neg", RuntimeExpr];
export type QuoteOp = ["quote", string, boolean];
export type ClassOp = ["class", string];
export type DotOp = ["dot"];
export type NoopOp = ["noop"];
export type ExtOp = ["ext", ExtensionFn, string[]];
export type ErrOp = ["err", string];
export type RuntimeExpr = IdOp | AltOp | SeqOp | ReptOp | PredOp | NegOp | QuoteOp | ClassOp | DotOp | NoopOp | ExtOp | ErrOp;
/**
 * Parsed grammar expression node.
 *
 * The compiler consumes the pPEG parse tree directly, so this intentionally
 * stays broad enough for all grammar node payloads.
 */
export type GrammarExpr = [string, any];
/**
 * A parse tree node returned by {@link Parse#ptree}.
 *
 * Leaves are `[name, text]`; branches are `[name, children]`. The compiler
 * also consumes bootstrap grammar arrays with this same broad tuple shape.
 */
export type PtreeNode = [string, any];
export type PtreeWalk = [PtreeNode[], number];
export type TransformWalk = [unknown[], number];
export type TransformResult = [boolean, unknown];
export type TransformFn = (value: unknown) => unknown;
export type ExtensionFn = (parse: Parse, args: string[]) => boolean;
export type TransformMap = Record<string, TransformFn>;
export type ExtensionMap = Record<string, ExtensionFn>;
export type CodeOptions = {
    /**
     * Bootstrap parse tree used before the PEG grammar can parse itself.
     */
    boot?: PtreeNode | null | undefined;
    /**
     * Transform callbacks keyed by rule name, or `rule:` for named wrapping.
     */
    transforms?: TransformMap | undefined;
    /**
     * Extension callbacks keyed by extension command name.
     */
    extras?: ExtensionMap | undefined;
};
