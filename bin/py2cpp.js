#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpile } from '../index.js';

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
@avkashhhh/py2cpp - Python to Modern C++ Transpiler

Usage:
  py2cpp <input.py> [options]
  cat input.py | py2cpp [options]

Options:
  -o, --output <file>    Output C++ file path (defaults to stdout)
  --no-main              Do not wrap top-level statements in main()
  --no-headers           Do not include #include headers
  --std                  Use 'using namespace std;' and strip std::
  -i, --indent <num>     Indentation spaces (default: 4)
  -v, --version          Show version
  -h, --help             Show this help message

Examples:
  py2cpp script.py -o output.cpp
  py2cpp script.py --std
  echo "print('Hello C++')" | py2cpp
`);
}

if (args.includes('-h') || args.includes('--help')) {
  printHelp();
  process.exit(0);
}

if (args.includes('-v') || args.includes('--version')) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
  console.log(`v${pkg.version}`);
  process.exit(0);
}

let inputFile = null;
let outputFile = null;
let wrapInMain = true;
let includeHeaders = true;
let useNamespaceStd = false;
let indent = 4;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-o' || arg === '--output') {
    outputFile = args[++i];
  } else if (arg === '--no-main') {
    wrapInMain = false;
  } else if (arg === '--no-headers') {
    includeHeaders = false;
  } else if (arg === '--std') {
    useNamespaceStd = true;
  } else if (arg === '-i' || arg === '--indent') {
    indent = parseInt(args[++i], 10) || 4;
  } else if (!arg.startsWith('-') && !inputFile) {
    inputFile = arg;
  }
}

function processSource(source) {
  try {
    const cppCode = transpile(source, {
      wrapInMain,
      includeHeaders,
      useNamespaceStd,
      indent,
    });

    if (outputFile) {
      writeFileSync(resolve(process.cwd(), outputFile), cppCode, 'utf-8');
      console.log(`Successfully transpiled to ${outputFile}`);
    } else {
      process.stdout.write(cppCode);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

if (inputFile) {
  try {
    const source = readFileSync(resolve(process.cwd(), inputFile), 'utf-8');
    processSource(source);
  } catch (err) {
    console.error(`Error reading input file: ${err.message}`);
    process.exit(1);
  }
} else if (!process.stdin.isTTY) {
  let stdinData = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => {
    stdinData += chunk;
  });
  process.stdin.on('end', () => {
    processSource(stdinData);
  });
} else {
  printHelp();
  process.exit(1);
}

