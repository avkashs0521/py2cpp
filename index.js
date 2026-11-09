/**
 * @module @avkashhhh/py2cpp
 * A tiny, zero-dependency Python to modern C++ transpiler and code generator.
 */

/**
 * Custom error thrown when transpilation fails due to invalid syntax or unsupported constructs.
 */
export class TranspileError extends Error {
  /**
   * @param {string} message - Error description.
   * @param {number|null} [line=null] - 1-based source line number.
   * @param {number|null} [column=null] - 1-based column number.
   */
  constructor(message, line = null, column = null) {
    const loc = line !== null ? ` at line ${line}` + (column !== null ? `:${column}` : '') : '';
    super(`${message}${loc}`);
    this.name = 'TranspileError';
    this.line = line;
    this.column = column;
  }
}

/**
 * Options for configuring C++ transpilation.
 *
 * @typedef {Object} TranspileOptions
 * @property {boolean} [wrapInMain=true] - Whether to wrap top-level statements inside int main() { ... return 0; }.
 * @property {boolean} [includeHeaders=true] - Whether to automatically detect and prepend required C++ header files.
 * @property {boolean} [useNamespaceStd=false] - Whether to include 'using namespace std;' and strip 'std::'.
 * @property {number} [indent=4] - Number of spaces per indentation level.
 * @property {boolean} [includeStats=false] - Whether to return an object with code and compilation statistics.
 * @property {string[]} [extraHeaders=[]] - Additional C++ headers to include.
 */

/**
 * Map of Python type annotations to C++ types.
 */
const TYPE_MAP = {
  int: 'int',
  float: 'double',
  str: 'std::string',
  bool: 'bool',
  void: 'void',
  None: 'void',
  auto: 'auto',
};

/**
 * Parses Python type annotation into C++ type.
 *
 * @param {string} pyType
 * @returns {string}
 */
export function mapType(pyType) {
  if (!pyType) return 'auto';
  const clean = pyType.trim();
  if (TYPE_MAP[clean]) return TYPE_MAP[clean];

  // List[T] or list[T]
  const listMatch = clean.match(/^(?:List|list)\[\s*(.+)\s*\]$/);
  if (listMatch) {
    return `std::vector<${mapType(listMatch[1])}>`;
  }

  // Dict[K, V] or dict[K, V]
  const dictMatch = clean.match(/^(?:Dict|dict)\[\s*([^,]+)\s*,\s*(.+)\s*\]$/);
  if (dictMatch) {
    return `std::map<${mapType(dictMatch[1])}, ${mapType(dictMatch[2])}>`;
  }

  return clean;
}

/**
 * Safely splits a comma-delimited argument string while respecting quotes, brackets, and parentheses.
 *
 * @param {string} str
 * @returns {string[]}
 */
export function splitArguments(str) {
  const result = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let inQuote = null;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prev = i > 0 ? str[i - 1] : '';

    if (inQuote) {
      current += char;
      if (char === inQuote && prev !== '\\') {
        inQuote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inQuote = char;
      current += char;
    } else if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth--;
      current += char;
    } else if (char === '[') {
      bracketDepth++;
      current += char;
    } else if (char === ']') {
      bracketDepth--;
      current += char;
    } else if (char === '{') {
      braceDepth++;
      current += char;
    } else if (char === '}') {
      braceDepth--;
      current += char;
    } else if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Infers C++ type from a Python literal or expression.
 *
 * @param {string} expr
 * @param {Map<string, string>} [scope=new Map()]
 * @returns {string}
 */
export function inferType(expr, scope = new Map()) {
  if (!expr) return 'auto';
  const trimmed = expr.trim();

  // Known variable in scope
  if (scope.has(trimmed)) {
    return scope.get(trimmed);
  }

  // Boolean
  if (trimmed === 'True' || trimmed === 'False') {
    return 'bool';
  }

  // String
  if (/^(['"]).*\1$/.test(trimmed)) {
    return 'std::string';
  }

  // Float
  if (/^-?\d+\.\d+([eE][+-]?\d+)?$/.test(trimmed)) {
    return 'double';
  }

  // Integer
  if (/^-?\d+$/.test(trimmed)) {
    return 'int';
  }

  // List literal [1, 2, 3]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return 'std::vector<int>';
    const items = splitArguments(inner);
    const itemType = inferType(items[0], scope);
    return `std::vector<${itemType === 'auto' ? 'int' : itemType}>`;
  }

  // Dict literal {"a": 1}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return 'std::map<std::string, int>';
    const pairs = splitArguments(inner);
    const colonIdx = pairs[0].indexOf(':');
    if (colonIdx !== -1) {
      const kType = inferType(pairs[0].slice(0, colonIdx), scope);
      const vType = inferType(pairs[0].slice(colonIdx + 1), scope);
      return `std::map<${kType}, ${vType}>`;
    }
  }

  // Comparison or boolean operations
  if (/\b(==|!=|<=|>=|<|>|and|or|not)\b/.test(trimmed)) {
    return 'bool';
  }

  // Integer division // yields int
  if (trimmed.includes('//')) {
    return 'int';
  }

  // Integer arithmetic (e.g. 10 + 20, 5 * 3)
  if (/^-?\d+\s*([+\-*%]\s*-?\d+\s*)+$/.test(trimmed)) {
    return 'int';
  }

  // Division in Python 3 always yields float
  if (trimmed.includes('/') && !trimmed.includes('//')) {
    return 'double';
  }

  // Builtin return types
  if (/^len\s*\(/.test(trimmed)) return 'int';
  if (/^math\.(sqrt|pow|sin|cos|tan)\s*\(/.test(trimmed)) return 'double';

  return 'auto';
}

/**
 * Translates a single Python expression into equivalent C++.
 *
 * @param {string} expr
 * @param {Set<string>} headers
 * @param {Map<string, string>} scope
 * @returns {string}
 */
export function translateExpression(expr, headers, scope) {
  if (!expr) return '';
  let result = expr.trim();

  // Boolean literals and None
  result = result.replace(/\bTrue\b/g, 'true');
  result = result.replace(/\bFalse\b/g, 'false');
  result = result.replace(/\bNone\b/g, 'nullptr');

  // Convert Python single-quoted strings to C++ double-quoted strings
  result = result.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, content) => {
    const escaped = content.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  // Math constants
  if (/\bmath\.pi\b/.test(result)) {
    headers.add('<cmath>');
    result = result.replace(/\bmath\.pi\b/g, 'M_PI');
  }
  if (/\bmath\.e\b/.test(result)) {
    headers.add('<cmath>');
    result = result.replace(/\bmath\.e\b/g, 'M_E');
  }

  // Math functions
  const mathFuncs = ['sqrt', 'pow', 'abs', 'floor', 'ceil', 'sin', 'cos', 'tan', 'log', 'exp'];
  for (const fn of mathFuncs) {
    const regex = new RegExp(`\\bmath\\.${fn}\\s*\\(`, 'g');
    if (regex.test(result)) {
      headers.add('<cmath>');
      result = result.replace(regex, `std::${fn}(`);
    }
  }

  // Built-in abs
  if (/\babs\s*\(/.test(result)) {
    headers.add('<cmath>');
    result = result.replace(/\babs\s*\(/g, 'std::abs(');
  }

  // Built-in min/max
  if (/\bmin\s*\(/.test(result)) {
    headers.add('<algorithm>');
    result = result.replace(/\bmin\s*\(/g, 'std::min(');
  }
  if (/\bmax\s*\(/.test(result)) {
    headers.add('<algorithm>');
    result = result.replace(/\bmax\s*\(/g, 'std::max(');
  }

  // Built-in len(x) -> static_cast<int>(x.size())
  result = result.replace(/\blen\s*\(([^)]+)\)/g, (_m, p1) => {
    return `static_cast<int>(${translateExpression(p1, headers, scope)}.size())`;
  });

  // Built-in sum(x) -> std::accumulate(x.begin(), x.end(), 0)
  result = result.replace(/\bsum\s*\(([^)]+)\)/g, (_m, p1) => {
    headers.add('<numeric>');
    const inner = translateExpression(p1, headers, scope);
    return `std::accumulate(${inner}.begin(), ${inner}.end(), 0)`;
  });

  // Vector methods
  // arr.append(val) -> arr.push_back(val)
  result = result.replace(/(\b[a-zA-Z_]\w*)\.append\s*\((.+?)\)/g, (_m, arr, val) => {
    return `${arr}.push_back(${translateExpression(val, headers, scope)})`;
  });
  // arr.pop() -> arr.pop_back()
  result = result.replace(/(\b[a-zA-Z_]\w*)\.pop\s*\(\)/g, '$1.pop_back()');
  // arr.clear() -> arr.clear()
  result = result.replace(/(\b[a-zA-Z_]\w*)\.clear\s*\(\)/g, '$1.clear()');

  // Operators:
  // ** -> std::pow
  result = result.replace(/([a-zA-Z0-9_().]+)\s*\*\*\s*([a-zA-Z0-9_().]+)/g, (_m, base, exp) => {
    headers.add('<cmath>');
    return `std::pow(${translateExpression(base, headers, scope)}, ${translateExpression(exp, headers, scope)})`;
  });

  // // -> /
  result = result.replace(/\/\//g, '/');

  // Logical operators
  result = result.replace(/\bis\s+not\b/g, '!=');
  result = result.replace(/\bis\b/g, '==');
  result = result.replace(/\band\b/g, '&&');
  result = result.replace(/\bor\b/g, '||');
  result = result.replace(/\bnot\s+/g, '!');

  // List literals: [1, 2, 3] -> {1, 2, 3}
  if (result.startsWith('[') && result.endsWith(']')) {
    headers.add('<vector>');
    const inner = result.slice(1, -1);
    const elements = splitArguments(inner).map((e) => translateExpression(e, headers, scope));
    return `{${elements.join(', ')}}`;
  }

  // Dict literals: {"a": 1, "b": 2} -> {{"a", 1}, {"b", 2}}
  if (result.startsWith('{') && result.endsWith('}')) {
    headers.add('<map>');
    const inner = result.slice(1, -1).trim();
    if (!inner) return '{}';
    const pairs = splitArguments(inner).map((pair) => {
      const idx = pair.indexOf(':');
      if (idx === -1) return pair;
      const k = translateExpression(pair.slice(0, idx), headers, scope);
      const v = translateExpression(pair.slice(idx + 1), headers, scope);
      return `{${k}, ${v}}`;
    });
    return `{${pairs.join(', ')}}`;
  }

  return result;
}

/**
 * Transpiles Python source code into modern C++.
 *
 * @param {string} source - Python code string.
 * @param {TranspileOptions} [options={}] - Transpiler configuration options.
 * @returns {string} Generated C++ code.
 * @throws {TypeError} If source is not a string or options is invalid.
 * @throws {TranspileError} If invalid Python syntax is encountered.
 */
export function transpile(source, options = {}) {
  if (typeof source !== 'string') {
    throw new TypeError('source must be a string');
  }
  if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) {
    throw new TypeError('options must be an object');
  }

  const {
    wrapInMain = true,
    includeHeaders = true,
    useNamespaceStd = false,
    indent = 4,
    includeStats = false,
    extraHeaders = [],
  } = options || {};

  if (typeof wrapInMain !== 'boolean') {
    throw new TypeError('wrapInMain must be a boolean');
  }
  if (typeof includeHeaders !== 'boolean') {
    throw new TypeError('includeHeaders must be a boolean');
  }
  if (typeof useNamespaceStd !== 'boolean') {
    throw new TypeError('useNamespaceStd must be a boolean');
  }
  if (typeof indent !== 'number' || indent < 0 || !Number.isInteger(indent)) {
    throw new TypeError('indent must be a non-negative integer');
  }
  if (typeof includeStats !== 'boolean') {
    throw new TypeError('includeStats must be a boolean');
  }
  if (!Array.isArray(extraHeaders) || extraHeaders.some((h) => typeof h !== 'string')) {
    throw new TypeError('extraHeaders must be an array of strings');
  }

  const pad = ' '.repeat(indent);
  const headers = new Set();
  for (const h of extraHeaders) {
    const trimmed = h.trim();
    const formatted = trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed : `<${trimmed}>`;
    headers.add(formatted);
  }
  const globalScope = new Map();

  const lines = source.split(/\r?\n/);
  const functionDefs = [];
  const topLevelStatements = [];

  let currentFunction = null;
  let blockStack = []; // [{ type, indentLevel }]
  let currentScope = globalScope;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const lineNum = lineIdx + 1;

    // Preserve empty lines
    if (rawLine.trim() === '') {
      if (currentFunction) {
        currentFunction.lines.push('');
      } else {
        topLevelStatements.push('');
      }
      continue;
    }

    // Determine indentation
    const indentMatch = rawLine.match(/^(\s*)/);
    const lineIndent = indentMatch ? indentMatch[1].length : 0;
    const trimmed = rawLine.trim();

    // Check if exiting indented blocks
    while (blockStack.length > 0 && lineIndent <= blockStack[blockStack.length - 1].indentLevel) {
      const closed = blockStack.pop();
      const closeLine = ' '.repeat(closed.indentLevel) + '}';
      if (currentFunction) {
        currentFunction.lines.push(closeLine);
      } else {
        topLevelStatements.push(closeLine);
      }

      // If closed the function block itself
      if (closed.type === 'def') {
        functionDefs.push(currentFunction);
        currentFunction = null;
        currentScope = globalScope;
      }
    }

    const currentIndentStr = ' '.repeat(lineIndent);

    // Comments: # ... -> // ...
    if (trimmed.startsWith('#')) {
      const commentStr = `${currentIndentStr}// ${trimmed.slice(1).trimStart()}`;
      if (currentFunction) {
        currentFunction.lines.push(commentStr);
      } else {
        topLevelStatements.push(commentStr);
      }
      continue;
    }

    // Module imports: import math / from math import ...
    if (/^import\s+math\b|^from\s+math\s+import\b/.test(trimmed)) {
      headers.add('<cmath>');
      continue;
    }

    // Pass statement
    if (trimmed === 'pass') {
      const passStr = `${currentIndentStr}// pass`;
      if (currentFunction) currentFunction.lines.push(passStr);
      else topLevelStatements.push(passStr);
      continue;
    }

    // Break / Continue
    if (trimmed === 'break' || trimmed === 'continue') {
      const stmtStr = `${currentIndentStr}${trimmed};`;
      if (currentFunction) currentFunction.lines.push(stmtStr);
      else topLevelStatements.push(stmtStr);
      continue;
    }

    // Function definition: def name(params) [-> return_type]:
    const defMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)(?:\s*->\s*([^:]+))?\s*:$/);
    if (defMatch) {
      const [, funcName, rawParams, rawRetType] = defMatch;
      const fnScope = new Map(globalScope);
      const parsedParams = [];

      if (rawParams.trim()) {
        const paramList = splitArguments(rawParams);
        for (const p of paramList) {
          const colonIdx = p.indexOf(':');
          if (colonIdx !== -1) {
            const pName = p.slice(0, colonIdx).trim();
            const pType = mapType(p.slice(colonIdx + 1));
            parsedParams.push(`${pType} ${pName}`);
            fnScope.set(pName, pType);
            if (pType.includes('std::vector')) headers.add('<vector>');
            if (pType.includes('std::string')) headers.add('<string>');
            if (pType.includes('std::map')) headers.add('<map>');
          } else {
            const pName = p.trim();
            parsedParams.push(`auto ${pName}`);
            fnScope.set(pName, 'auto');
          }
        }
      }

      let returnType = rawRetType ? mapType(rawRetType) : 'auto';
      if (returnType.includes('std::vector')) headers.add('<vector>');
      if (returnType.includes('std::string')) headers.add('<string>');
      if (returnType.includes('std::map')) headers.add('<map>');

      currentFunction = {
        name: funcName,
        returnType,
        params: parsedParams.join(', '),
        lines: [],
        scope: fnScope,
        indentLevel: lineIndent,
      };

      currentScope = fnScope;
      blockStack.push({ type: 'def', indentLevel: lineIndent });
      continue;
    }

    // Return statement: return [expr]
    const returnMatch = trimmed.match(/^return(?:\s+(.+))?$/);
    if (returnMatch) {
      const rawVal = returnMatch[1];
      let stmtStr;
      if (rawVal) {
        const valTrans = translateExpression(rawVal, headers, currentScope);
        stmtStr = `${currentIndentStr}return ${valTrans};`;
        if (currentFunction && currentFunction.returnType === 'auto') {
          const inferred = inferType(rawVal, currentScope);
          if (inferred !== 'auto') {
            currentFunction.returnType = inferred;
            if (inferred.includes('std::vector')) headers.add('<vector>');
            if (inferred.includes('std::string')) headers.add('<string>');
            if (inferred.includes('std::map')) headers.add('<map>');
          }
        }
      } else {
        stmtStr = `${currentIndentStr}return;`;
      }

      if (currentFunction) currentFunction.lines.push(stmtStr);
      else topLevelStatements.push(stmtStr);
      continue;
    }

    // If statement: if condition:
    const ifMatch = trimmed.match(/^if\s+(.+)\s*:$/);
    if (ifMatch) {
      const cond = translateExpression(ifMatch[1], headers, currentScope);
      const ifStr = `${currentIndentStr}if (${cond}) {`;
      if (currentFunction) currentFunction.lines.push(ifStr);
      else topLevelStatements.push(ifStr);
      blockStack.push({ type: 'if', indentLevel: lineIndent });
      continue;
    }

    // Elif statement: elif condition:
    const elifMatch = trimmed.match(/^elif\s+(.+)\s*:$/);
    if (elifMatch) {
      const cond = translateExpression(elifMatch[1], headers, currentScope);
      const elifStr = `${currentIndentStr}} else if (${cond}) {`;
      if (currentFunction) currentFunction.lines.push(elifStr);
      else topLevelStatements.push(elifStr);
      blockStack.push({ type: 'elif', indentLevel: lineIndent });
      continue;
    }

    // Else statement: else:
    const elseMatch = trimmed.match(/^else\s*:$/);
    if (elseMatch) {
      const elseStr = `${currentIndentStr}} else {`;
      if (currentFunction) currentFunction.lines.push(elseStr);
      else topLevelStatements.push(elseStr);
      blockStack.push({ type: 'else', indentLevel: lineIndent });
      continue;
    }

    // While loop: while condition:
    const whileMatch = trimmed.match(/^while\s+(.+)\s*:$/);
    if (whileMatch) {
      const cond = translateExpression(whileMatch[1], headers, currentScope);
      const whileStr = `${currentIndentStr}while (${cond}) {`;
      if (currentFunction) currentFunction.lines.push(whileStr);
      else topLevelStatements.push(whileStr);
      blockStack.push({ type: 'while', indentLevel: lineIndent });
      continue;
    }

    // For loop with range: for i in range(...)
    const forRangeMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+range\s*\((.*?)\)\s*:$/);
    if (forRangeMatch) {
      const varName = forRangeMatch[1];
      const rangeArgs = splitArguments(forRangeMatch[2]).map((a) => translateExpression(a, headers, currentScope));
      currentScope.set(varName, 'int');

      let loopHeader;
      if (rangeArgs.length === 1) {
        loopHeader = `for (int ${varName} = 0; ${varName} < ${rangeArgs[0]}; ++${varName}) {`;
      } else if (rangeArgs.length === 2) {
        loopHeader = `for (int ${varName} = ${rangeArgs[0]}; ${varName} < ${rangeArgs[1]}; ++${varName}) {`;
      } else if (rangeArgs.length === 3) {
        const stepNum = Number(rangeArgs[2]);
        const cmp = !Number.isNaN(stepNum) && stepNum < 0 ? '>' : '<';
        loopHeader = `for (int ${varName} = ${rangeArgs[0]}; ${varName} ${cmp} ${rangeArgs[1]}; ${varName} += ${rangeArgs[2]}) {`;
      } else {
        throw new TranspileError('range() expects 1 to 3 arguments', lineNum);
      }

      const loopStr = `${currentIndentStr}${loopHeader}`;
      if (currentFunction) currentFunction.lines.push(loopStr);
      else topLevelStatements.push(loopStr);
      blockStack.push({ type: 'for', indentLevel: lineIndent });
      continue;
    }

    // For each in iterable: for item in items:
    const forEachMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+(.+)\s*:$/);
    if (forEachMatch) {
      const varName = forEachMatch[1];
      const iter = translateExpression(forEachMatch[2], headers, currentScope);
      currentScope.set(varName, 'auto');

      const loopStr = `${currentIndentStr}for (const auto& ${varName} : ${iter}) {`;
      if (currentFunction) currentFunction.lines.push(loopStr);
      else topLevelStatements.push(loopStr);
      blockStack.push({ type: 'for', indentLevel: lineIndent });
      continue;
    }

    // Print statement: print(...)
    const printMatch = trimmed.match(/^print\s*\((.*)\)$/);
    if (printMatch) {
      headers.add('<iostream>');
      const rawArgs = printMatch[1].trim();
      let printStr;
      if (!rawArgs) {
        printStr = `${currentIndentStr}std::cout << std::endl;`;
      } else {
        const args = splitArguments(rawArgs);
        const parts = [];
        for (let i = 0; i < args.length; i++) {
          const tr = translateExpression(args[i], headers, currentScope);
          parts.push(tr);
          if (i < args.length - 1) {
            parts.push('" "');
          }
        }
        parts.push('std::endl');
        printStr = `${currentIndentStr}std::cout << ${parts.join(' << ')};`;
      }

      if (currentFunction) currentFunction.lines.push(printStr);
      else topLevelStatements.push(printStr);
      continue;
    }

    // Assignment or variable declaration:
    // target = value OR target += value
    const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*([+\-*/%]?=)\s*(.+)$/);
    if (assignMatch) {
      const [, varName, op, rawVal] = assignMatch;
      const transVal = translateExpression(rawVal, headers, currentScope);

      let stmtStr;
      if (op === '=') {
        if (!currentScope.has(varName)) {
          // First declaration in this scope
          let inferred = inferType(rawVal, currentScope);
          if (inferred === 'auto' && rawVal.trim().startsWith('[') && rawVal.trim().endsWith(']')) {
            inferred = 'std::vector<int>';
          }
          currentScope.set(varName, inferred);
          if (inferred.includes('std::vector')) headers.add('<vector>');
          if (inferred.includes('std::string')) headers.add('<string>');
          if (inferred.includes('std::map')) headers.add('<map>');

          stmtStr = `${currentIndentStr}${inferred} ${varName} = ${transVal};`;
        } else {
          // Re-assignment
          stmtStr = `${currentIndentStr}${varName} = ${transVal};`;
        }
      } else {
        // Compound assignment (+=, -=, etc.)
        stmtStr = `${currentIndentStr}${varName} ${op} ${transVal};`;
      }

      if (currentFunction) currentFunction.lines.push(stmtStr);
      else topLevelStatements.push(stmtStr);
      continue;
    }

    // Expression statement (e.g. func_call() or arr.append(x))
    const exprTrans = translateExpression(trimmed, headers, currentScope);
    const exprStmt = `${currentIndentStr}${exprTrans};`;
    if (currentFunction) currentFunction.lines.push(exprStmt);
    else topLevelStatements.push(exprStmt);
  }

  // Close any unclosed blocks
  while (blockStack.length > 0) {
    const closed = blockStack.pop();
    const closeLine = ' '.repeat(closed.indentLevel) + '}';
    if (currentFunction) {
      currentFunction.lines.push(closeLine);
    } else {
      topLevelStatements.push(closeLine);
    }
    if (closed.type === 'def') {
      functionDefs.push(currentFunction);
      currentFunction = null;
    }
  }

  // Assemble C++ Code
  const outputParts = [];

  // Headers
  if (includeHeaders && headers.size > 0) {
    const sortedHeaders = Array.from(headers).sort();
    for (const h of sortedHeaders) {
      outputParts.push(`#include ${h}`);
    }
    outputParts.push('');
  }

  // Using namespace std
  if (useNamespaceStd) {
    outputParts.push('using namespace std;');
    outputParts.push('');
  }

  // Function definitions
  for (const fn of functionDefs) {
    outputParts.push(`${fn.returnType} ${fn.name}(${fn.params}) {`);
    for (const l of fn.lines) {
      outputParts.push(l ? `${pad}${l}` : '');
    }
    outputParts.push('}');
    outputParts.push('');
  }

  // Top-level execution
  const activeTopLevel = topLevelStatements.filter((l) => l.trim() !== '');
  if (activeTopLevel.length > 0) {
    if (wrapInMain) {
      outputParts.push('int main() {');
      for (const l of topLevelStatements) {
        outputParts.push(l ? `${pad}${l}` : '');
      }
      outputParts.push(`${pad}return 0;`);
      outputParts.push('}');
    } else {
      for (const l of topLevelStatements) {
        outputParts.push(l);
      }
    }
  }

  let finalCode = outputParts.join('\n').trim() + '\n';

  if (useNamespaceStd) {
    finalCode = finalCode.replace(/\bstd::/g, '');
  }

  const stats = {
    linesTranspiled: lines.length,
    functionsCount: functionDefs.length,
    headers: Array.from(headers).sort(),
    hasMain: wrapInMain && activeTopLevel.length > 0,
  };

  if (includeStats) {
    return {
      code: finalCode,
      stats,
    };
  }

  return finalCode;
}

/**
 * Transpiles Python source code and returns both the generated C++ code and compilation statistics.
 *
 * @param {string} source - Python source code.
 * @param {TranspileOptions} [options={}] - Transpiler configuration options.
 * @returns {{ code: string, stats: { linesTranspiled: number, functionsCount: number, headers: string[], hasMain: boolean } }}
 */
export function transpileWithStats(source, options = {}) {
  return transpile(source, { ...options, includeStats: true });
}

/**
 * Shorthand alias for transpile().
 *
 * @param {string} source - Python source code.
 * @param {TranspileOptions} [options={}] - Transpiler configuration.
 * @returns {string} Generated C++ code.
 */
export function py2cpp(source, options = {}) {
  return transpile(source, options);
}

/**
 * Transpiles a Python code snippet without wrapping in main() or prepending headers.
 *
 * @param {string} source - Python code snippet.
 * @param {TranspileOptions} [options={}] - Transpiler configuration.
 * @returns {string} Generated C++ snippet.
 */
export function transpileSnippet(source, options = {}) {
  return transpile(source, {
    wrapInMain: false,
    includeHeaders: false,
    ...options,
  });
}

export default transpile;
