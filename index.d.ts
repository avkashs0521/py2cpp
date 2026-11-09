/**
 * Options for configuring C++ transpilation.
 */
export interface TranspileOptions {
  /**
   * Whether to wrap top-level statements inside `int main() { ... return 0; }`.
   * @default true
   */
  wrapInMain?: boolean;

  /**
   * Whether to automatically detect and prepend required C++ header files.
   * @default true
   */
  includeHeaders?: boolean;

  /**
   * Whether to include `using namespace std;` and strip `std::` prefixes.
   * @default false
   */
  useNamespaceStd?: boolean;

  /**
   * Number of spaces per indentation level.
   * @default 4
   */
  indent?: number;
}

/**
 * Custom error thrown when transpilation fails due to invalid syntax or unsupported constructs.
 */
export class TranspileError extends Error {
  readonly name: 'TranspileError';
  readonly line: number | null;
  readonly column: number | null;

  constructor(message: string, line?: number | null, column?: number | null);
}

/**
 * Maps a Python type annotation to its C++ equivalent.
 *
 * @param pyType Python type string (e.g., 'int', 'str', 'List[int]').
 * @returns Equivalent C++ type.
 */
export function mapType(pyType: string): string;

/**
 * Safely splits a comma-delimited argument string while respecting quotes, brackets, and parentheses.
 *
 * @param str Comma-delimited argument list.
 * @returns Array of individual argument strings.
 */
export function splitArguments(str: string): string[];

/**
 * Infers the C++ type from a Python literal or expression.
 *
 * @param expr Python expression string.
 * @param scope Optional map of known variable types.
 * @returns Inferred C++ type string.
 */
export function inferType(expr: string, scope?: Map<string, string>): string;

/**
 * Translates a single Python expression into equivalent C++.
 *
 * @param expr Python expression string.
 * @param headers Set of required headers that will be mutated if the expression needs specific libraries.
 * @param scope Map of known variable types in the current scope.
 * @returns Translated C++ expression string.
 */
export function translateExpression(
  expr: string,
  headers: Set<string>,
  scope: Map<string, string>
): string;

/**
 * Transpiles Python source code into modern C++.
 *
 * @param source Python source code.
 * @param options Transpiler configuration options.
 * @returns Generated C++ source code.
 */
export function transpile(source: string, options?: TranspileOptions): string;

/**
 * Shorthand alias for `transpile()`.
 *
 * @param source Python source code.
 * @param options Transpiler configuration options.
 * @returns Generated C++ source code.
 */
export function py2cpp(source: string, options?: TranspileOptions): string;

/**
 * Transpiles a Python code snippet without wrapping in `main()` or prepending headers.
 *
 * @param source Python code snippet.
 * @param options Transpiler configuration options.
 * @returns Generated C++ snippet.
 */
export function transpileSnippet(source: string, options?: TranspileOptions): string;

export default transpile;

