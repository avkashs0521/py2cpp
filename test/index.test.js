import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  transpile,
  py2cpp,
  transpileSnippet,
  mapType,
  inferType,
  splitArguments,
} from '../index.js';

describe('@avkashhhh/py2cpp', () => {
  describe('Input validation', () => {
    it('throws on non-string input', () => {
      assert.throws(() => transpile(123), /source must be a string/);
      assert.throws(() => transpile(null), /source must be a string/);
      assert.throws(() => transpile(undefined), /source must be a string/);
    });

    it('throws on invalid options', () => {
      assert.throws(() => transpile('', 'invalid'), /options must be an object/);
      assert.throws(() => transpile('', { wrapInMain: 'yes' }), /wrapInMain must be a boolean/);
      assert.throws(() => transpile('', { includeHeaders: 1 }), /includeHeaders must be a boolean/);
      assert.throws(() => transpile('', { useNamespaceStd: null }), /useNamespaceStd must be a boolean/);
      assert.throws(() => transpile('', { indent: -2 }), /indent must be a non-negative integer/);
    });
  });

  describe('Type mapping & Type inference', () => {
    it('maps primitive types correctly', () => {
      assert.equal(mapType('int'), 'int');
      assert.equal(mapType('float'), 'double');
      assert.equal(mapType('str'), 'std::string');
      assert.equal(mapType('bool'), 'bool');
      assert.equal(mapType('None'), 'void');
    });

    it('maps container types', () => {
      assert.equal(mapType('List[int]'), 'std::vector<int>');
      assert.equal(mapType('list[str]'), 'std::vector<std::string>');
      assert.equal(mapType('Dict[str, int]'), 'std::map<std::string, int>');
    });

    it('infers literal types', () => {
      assert.equal(inferType('42'), 'int');
      assert.equal(inferType('3.14'), 'double');
      assert.equal(inferType('"hello"'), 'std::string');
      assert.equal(inferType("'world'"), 'std::string');
      assert.equal(inferType('True'), 'bool');
      assert.equal(inferType('False'), 'bool');
      assert.equal(inferType('[1, 2, 3]'), 'std::vector<int>');
      assert.equal(inferType('["a", "b"]'), 'std::vector<std::string>');
    });
  });

  describe('splitArguments helper', () => {
    it('splits arguments while respecting quotes and nested brackets', () => {
      assert.deepEqual(splitArguments('a, b, c'), ['a', 'b', 'c']);
      assert.deepEqual(splitArguments('"hello, world", 42'), ['"hello, world"', '42']);
      assert.deepEqual(splitArguments('[1, 2, 3], {"k": "v"}'), ['[1, 2, 3]', '{"k": "v"}']);
    });
  });

  describe('Variables & Basic statements', () => {
    it('transpiles variable declaration and re-assignment', () => {
      const py = `
x = 10
x = 20
y = 3.5
name = "Alice"
flag = True
`;
      const cpp = transpileSnippet(py);
      assert.ok(cpp.includes('int x = 10;'));
      assert.ok(cpp.includes('x = 20;'));
      assert.ok(cpp.includes('double y = 3.5;'));
      assert.ok(cpp.includes('std::string name = "Alice";'));
      assert.ok(cpp.includes('bool flag = true;'));
    });

    it('transpiles compound assignments', () => {
      const py = `
count = 0
count += 1
count -= 2
count *= 3
`;
      const cpp = transpileSnippet(py);
      assert.ok(cpp.includes('int count = 0;'));
      assert.ok(cpp.includes('count += 1;'));
      assert.ok(cpp.includes('count -= 2;'));
      assert.ok(cpp.includes('count *= 3;'));
    });
  });

  describe('Print statement', () => {
    it('transpiles print with multiple arguments and automatically includes <iostream>', () => {
      const py = `print("Total:", 100)`;
      const cpp = transpile(py);
      assert.ok(cpp.includes('#include <iostream>'));
      assert.ok(cpp.includes('std::cout << "Total:" << " " << 100 << std::endl;'));
    });

    it('transpiles empty print()', () => {
      const py = `print()`;
      const cpp = transpileSnippet(py);
      assert.ok(cpp.includes('std::cout << std::endl;'));
    });
  });

  describe('Operators & Math', () => {
    it('transpiles logical and comparison operators', () => {
      const py = `
a = True and not False
b = 5 is not None
c = 10 // 3
`;
      const cpp = transpileSnippet(py);
      assert.ok(cpp.includes('bool a = true && !false;'));
      assert.ok(cpp.includes('bool b = 5 != nullptr;'));
      assert.ok(cpp.includes('int c = 10 / 3;'));
    });

    it('transpiles power operator to std::pow and includes <cmath>', () => {
      const py = `x = 2 ** 3`;
      const cpp = transpile(py);
      assert.ok(cpp.includes('#include <cmath>'));
      assert.ok(cpp.includes('std::pow(2, 3)'));
    });

    it('transpiles math module methods and constants', () => {
      const py = `
import math
r = 5.0
area = math.pi * r ** 2
root = math.sqrt(16.0)
`;
      const cpp = transpile(py);
      assert.ok(cpp.includes('#include <cmath>'));
      assert.ok(cpp.includes('M_PI'));
      assert.ok(cpp.includes('std::sqrt(16.0)'));
    });
  });

  describe('Control Flow', () => {
    it('transpiles if / elif / else blocks', () => {
      const py = `
score = 85
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
else:
    grade = "C"
`;
      const cpp = transpileSnippet(py);
      assert.ok(cpp.includes('if (score >= 90) {'));
      assert.ok(cpp.includes('} else if (score >= 80) {'));
      assert.ok(cpp.includes('} else {'));
    });

    it('transpiles while loops', () => {
      const py = `
i = 0
while i < 5:
    i += 1
`;
      const cpp = transpileSnippet(py);
      assert.ok(cpp.includes('while (i < 5) {'));
      assert.ok(cpp.includes('i += 1;'));
    });
  });

  describe('For Loops', () => {
    it('transpiles for i in range(10)', () => {
      const py = `
for i in range(10):
    print(i)
`;
      const cpp = transpileSnippet(py);
      assert.ok(cpp.includes('for (int i = 0; i < 10; ++i) {'));
    });

    it('transpiles for i in range(1, 10)', () => {
      const py = `
for i in range(1, 10):
    print(i)
`;
      const cpp = transpileSnippet(py);
      assert.ok(cpp.includes('for (int i = 1; i < 10; ++i) {'));
    });

    it('transpiles for i in range(10, 0, -1)', () => {
      const py = `
for i in range(10, 0, -1):
    print(i)
`;
      const cpp = transpileSnippet(py);
      assert.ok(cpp.includes('for (int i = 10; i > 0; i += -1) {'));
    });

    it('transpiles range-based for in iterable', () => {
      const py = `
items = [1, 2, 3]
for x in items:
    print(x)
`;
      const cpp = transpileSnippet(py);
      assert.ok(cpp.includes('for (const auto& x : items) {'));
    });
  });

  describe('Lists & Dicts', () => {
    it('transpiles list initialization and methods', () => {
      const py = `
nums = [1, 2, 3]
nums.append(4)
nums.pop()
`;
      const cpp = transpile(py);
      assert.ok(cpp.includes('#include <vector>'));
      assert.ok(cpp.includes('std::vector<int> nums = {1, 2, 3};'));
      assert.ok(cpp.includes('nums.push_back(4);'));
      assert.ok(cpp.includes('nums.pop_back();'));
    });

    it('transpiles dict initialization and includes <map>', () => {
      const py = `scores = {"math": 95}`;
      const cpp = transpile(py);
      assert.ok(cpp.includes('#include <map>'));
      assert.ok(cpp.includes('std::map<std::string, int> scores = {{"math", 95}};'));
    });
  });

  describe('Functions & Recursion', () => {
    it('transpiles typed function and places before main()', () => {
      const py = `
def add(a: int, b: int) -> int:
    return a + b

total = add(3, 4)
print(total)
`;
      const cpp = transpile(py);
      assert.ok(cpp.includes('int add(int a, int b) {'));
      assert.ok(cpp.includes('return a + b;'));
      assert.ok(cpp.includes('int main() {'));
      assert.ok(cpp.indexOf('int add') < cpp.indexOf('int main()'));
    });

    it('transpiles recursive function', () => {
      const py = `
def fib(n: int) -> int:
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
`;
      const cpp = transpile(py, { wrapInMain: false });
      assert.ok(cpp.includes('int fib(int n) {'));
      assert.ok(cpp.includes('if (n <= 1) {'));
      assert.ok(cpp.includes('return n;'));
      assert.ok(cpp.includes('return fib(n - 1) + fib(n - 2);'));
    });
  });

  describe('Options', () => {
    it('respects useNamespaceStd option', () => {
      const py = `print("hello")`;
      const cpp = transpile(py, { useNamespaceStd: true });
      assert.ok(cpp.includes('using namespace std;'));
      assert.ok(cpp.includes('cout << "hello" << endl;'));
      assert.ok(!cpp.includes('std::cout'));
    });

    it('respects custom indent', () => {
      const py = `
if True:
    x = 1
`;
      const cpp = transpileSnippet(py, { indent: 2 });
      assert.ok(cpp.includes('  int x = 1;'));
    });
  });

  describe('py2cpp alias', () => {
    it('functions identically to transpile', () => {
      const py = `x = 5`;
      assert.equal(py2cpp(py), transpile(py));
    });
  });
});
