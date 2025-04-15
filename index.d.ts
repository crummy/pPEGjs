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
}

export type MetadataTree = Metadata | Metadata[];

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

/**
 * Result of a successful parse
 */
export interface ParseSuccess {
	/** Indicates parsing was successful */
	ok: true;
	/** The parse tree */
	ptree: any[];
	/** Metadata tree with position information */
	ptree_metadata: MetadataTree;
	/** Returns a string representation of the parse tree */
	show_ptree: (json?: boolean) => string;
	/** All rule matches from the parse */
	matches: Match[];
}

/**
 * Result of a failed parse
 */
export interface ParseFailure {
	/** Indicates parsing failed */
	ok: false;
	/** Returns an error message explaining why parsing failed */
	show_err: () => string;
	/** Error code */
	err: number;
	/** Internal environment state */
	env: Env;
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
	/** Returns a string representation of the grammar's parse tree */
	show_ptree: (json?: boolean) => string;
}

/**
 * A failed parser compilation
 */
export interface CompileFailure {
	/** Indicates compilation failed */
	ok: false;
	/** Error code */
	err: number;
	/** Error message */
	panic?: string;
	/** Returns an error message explaining why compilation failed */
	show_err: () => string;
	/** Parse an input string (will always fail) */
	parse: (input?: string, options?: Options) => ParseFailure;
}

export type CompileResult = CompileSuccess | CompileFailure;

/**
 * Extension functions
 */
export interface Extensions {
	[key: string]: (exp: any, env: Env) => unknown;
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
	tree: any[];
	metadata_tree: MetadataTree[];
	matches: Match[];
	last_match_id: number;
	panic: string;
	fault_pos: number;
	fault_tree: any[];
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
	rules: any[];
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
	Function, // The ID function itself
	number, // The index in the code array
	string, // The rule name
];

/**
 * ALT command structure
 */
export type CommandALT = [
	Function, // The ALT function itself
	Array<Command>, // Arguments to the ALT function
	Array<string>?, // Guards
];

/**
 * SEQ command structure
 */
export type CommandSEQ = [
	Function, // The SEQ function itself
	number, // min
	number, // max
	Array<Command>, // exp
];

/**
 * REP command structure
 */
export type CommandREP = [
	Function, // The REP function itself
	number, // min
	number, // max
	Command, // expr
];

/**
 * PRE command structure
 */
export type CommandPRE = [
	Function, // The PRE function itself
	string, // sign
	Command, // term
];

/**
 * CHS command structure
 */
export type CommandCHS = [
	Function, // The CHS function itself
	boolean, // neg
	number, // min
	number, // max
	string, // str
];

/**
 * SQ command structure
 */
export type CommandSQ = [
	Function, // The SQ function itself
	boolean, // Case insensitivity
	string, // str - e.g. "something"
];

/**
 * EXTN command structure
 */
export type CommandEXTN = [
	Function, // The EXTN function itself
	string, // extension function name
];
