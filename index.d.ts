export { ppeg } from "./pPEG.mjs";

/**
 * Metadata for a parsed node
 */
export interface Metadata {
    /** The rule name that matched */
    rule: string;
    /** The index of the rule in the grammar */
    rule_id: number;
    /** Start position in the input string */
    start: number;
    /** End position in the input string */
    end: number;
    /** Unique identifier for this match */
    id: number;
    /** The matched text (for terminal nodes) */
    match?: string;
    /** Child nodes in the parse tree */
    children: Metadata[];
    /** Error information if parsing failed at this node */
    error?: {
        /** Type of error that occurred */
        type: string;
        /** Detailed error message */
        message: string;
    };
}

/**
 * Match information for a parsed rule
 */
export interface Match {
    rule: string;
    rule_id: number;
    start: number;
    end: number;
    id: number;
}

/**
 * Parser options
 */
export interface Options {
    trace?: boolean;
    short?: boolean;
}

export interface Error {
    type: string;
    message: string;
    location?: string;
}

/**
 * Result of a successful parse
 */
export interface ParseSuccess {
    /** Indicates parsing was successful */
    ok: true;
    /** The parse tree */
    ptree: Exp[];
    /** Metadata tree with position information */
    ptree_metadata: Metadata;
}

/**
 * Result of a failed parse
 */
export interface ParseFailure {
    /** Indicates parsing failed */
    ok: false;
    /** Internal environment state */
    env: Env;
    error: Error;
    /** Metadata tree with position information */
    ptree_metadata: Metadata;
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * A compiled parser
 */
export interface CompileSuccess {
    /** Indicates compilation was successful */
    ok: true;
    /** Parse an input string */
    parse: (input: string, options?: Options) => ParseResult;
}

/**
 * A failed parser compilation
 */
export interface CompileFailure {
    /** Indicates compilation failed */
    ok: false;
    error: Error;
    /** Metadata tree with position information */
    ptree_metadata: Metadata;
}

export type CompileResult = CompileSuccess | CompileFailure;

/**
 * Extension functions
 */
export interface Extensions {
    [key: string]: (exp: unknown, env: Env) => unknown;
}

/**
 * Environment configuration object
 */
export interface Env {
    codex: Codex;
    code: Array<Command>;
    extend: Extensions;
    options: Options;
    input: string;
    pos: number;
    peak: number;
    depth: number;
    max_depth: number;
    rule_names: string[];
    tree: unknown[];
    metadata_tree: Metadata[]; // why is this an array...
    matches: Match[];
    last_match_id: number;
    panic: string;
    fault_pos: number;
    fault_tree: unknown[];
    fault_rule: string | null;
    fault_exp: string | null;
    trace: boolean | string;
    trace_depth: number;
    start: number[];
    stack: number[];
    metadata_stack: number[];
    indent: string[];
    result: boolean;
}

/**
 * Instruction code
 */
export interface Codex {
    rules: unknown[];
    names: Record<string, number>;
    code: Command[];
    start: CommandID;
}

/**
 * A recursive array type that starts with a string followed by strings or nested arrays
 */
export type Exp = [string, ...(string | Exp)[]];

/**
 * Base command type with a function
 */
export type Command =
    | CommandID
    | CommandALT
    | CommandSEQ
    | CommandREP
    | CommandPRE
    | CommandCHS
    | CommandSQ
    | CommandEXTN;

/**
 * ID command structure
 */
export type CommandID = [
    (...args: unknown[]) => boolean, // The ID function itself
    number, // The index in the code array
    string, // The rule name
];

/**
 * ALT command structure
 */
export type CommandALT = [
    (...args: unknown[]) => boolean, // The ALT function itself
    Array<Command>, // Arguments to the ALT function
    Array<string>?, // Guards
];

/**
 * SEQ command structure
 */
export type CommandSEQ = [
    (...args: unknown[]) => boolean, // The SEQ function itself
    number, // min
    number, // max
    Array<Command>, // exp
];

/**
 * REP command structure
 */
export type CommandREP = [
    (...args: unknown[]) => boolean, // The REP function itself
    number, // min
    number, // max
    Command, // expr
];

/**
 * PRE command structure
 */
export type CommandPRE = [
    (...args: unknown[]) => boolean, // The PRE function itself
    string, // sign
    Command, // term
];

/**
 * CHS command structure
 */
export type CommandCHS = [
    (...args: unknown[]) => boolean, // The CHS function itself
    boolean, // neg
    number, // min
    number, // max
    string, // str
];

/**
 * SQ command structure
 */
export type CommandSQ = [
    (...args: unknown[]) => boolean, // The SQ function itself
    boolean, // Case insensitivity
    string, // str - e.g. "something"
];

/**
 * EXTN command structure
 */
export type CommandEXTN = [
    (...args: unknown[]) => boolean, // The EXTN function itself
    string, // extension function name
];
