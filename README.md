# @avkashhhh/py2cpp

[![npm version](https://img.shields.io/npm/v/@avkashhhh/py2cpp.svg)](https://www.npmjs.com/package/@avkashhhh/py2cpp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A tiny, zero-dependency Python to modern C++ transpiler and code generator for Node.js, modern browsers, and the command line.

---

## Features

- 🪶 **Zero dependencies**: Pure lightweight ES module that runs anywhere.
- 🔄 **Idiomatic C++ Output**: Generates clean, readable C++17/20 code.
- 🧠 **Automatic Type Inference**: Infers integers, doubles, strings, booleans, vectors, and maps from values and expressions.
- 📦 **Smart Header Detection**: Automatically identifies required C++ headers (`<iostream>`, `<vector>`, `<string>`, `<cmath>`, `<map>`, etc.).
- 🚀 **CLI Included**: Transpile directly from your terminal using `npx @avkashhhh/py2cpp`.
- 📘 **TypeScript Ready**: Complete JSDoc annotations and `index.d.ts` type declarations.

---

## Installation

```bash
npm install @avkashhhh/py2cpp
```

Or run via CLI without installing:

```bash
npx @avkashhhh/py2cpp input.py -o output.cpp
```

---

## Quick Start

```javascript
import { transpile } from '@avkashhhh/py2cpp';

const pythonCode = `
def factorial(n: int) -> int:
    if n <= 1:
        return 1
    return n * factorial(n - 1)

total = factorial(5)
print("Factorial is:", total)
`;

const cppCode = transpile(pythonCode);
console.log(cppCode);
```

### Generated C++ Output:

```cpp
#include <iostream>
#include <string>

int factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int main() {
    int total = factorial(5);
    std::cout << "Factorial is: " << total << std::endl;
    return 0;
}
```

---

## CLI Usage

```bash
# Transpile a file and print to terminal
py2cpp script.py

# Transpile and save to an output file
py2cpp script.py -o main.cpp

# Transpile with 'using namespace std;'
py2cpp script.py --std

# Transpile without wrapping in int main()
py2cpp script.py --no-main

# Transpile piped input
echo "print('Hello from C++')" | py2cpp
```

---

## API Reference

### `transpile(source, options?)`

Transpiles a Python source string into C++.

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `wrapInMain` | `boolean` | `true` | Wraps non-function statements inside `int main() { ... return 0; }`. |
| `includeHeaders` | `boolean` | `true` | Automatically includes required standard C++ headers (`<iostream>`, `<vector>`, etc.). |
| `useNamespaceStd` | `boolean` | `false` | Adds `using namespace std;` and strips `std::` prefixes. |
| `indent` | `number` | `4` | Number of spaces per indentation level. |

#### Helper Methods

- **`py2cpp(source, options?)`**: Alias to `transpile`.
- **`transpileSnippet(source, options?)`**: Shorthand for `{ wrapInMain: false, includeHeaders: false }`.
- **`inferType(expr, scope?)`**: Infers the C++ type string for a given Python expression.
- **`mapType(pyType)`**: Maps Python type annotation (`int`, `str`, `List[int]`, etc.) to C++ type.

---

## Supported Python Constructs

| Python Feature | Generated C++ Equivalent |
|---|---|
| `x = 42` | `int x = 42;` |
| `pi = 3.14` | `double pi = 3.14;` |
| `name = "Ada"` | `std::string name = "Ada";` |
| `flag = True` | `bool flag = true;` |
| `nums = [1, 2, 3]` | `std::vector<int> nums = {1, 2, 3};` |
| `scores = {"math": 95}` | `std::map<std::string, int> scores = {{"math", 95}};` |
| `print("Hello", val)` | `std::cout << "Hello" << " " << val << std::endl;` |
| `for i in range(10):` | `for (int i = 0; i < 10; ++i) {` |
| `for i in range(1, 10, 2):` | `for (int i = 1; i < 10; i += 2) {` |
| `for x in arr:` | `for (const auto& x : arr) {` |
| `if / elif / else` | `if (...) { ... } else if (...) { ... } else { ... }` |
| `def add(a: int, b: int) -> int:` | `int add(int a, int b) { ... }` |
| `arr.append(val)` | `arr.push_back(val);` |
| `len(arr)` | `static_cast<int>(arr.size())` |
| `math.sqrt(x)` | `std::sqrt(x)` |
| `a ** b` | `std::pow(a, b)` |
| `and`, `or`, `not` | `&&`, `||`, `!` |

---

## License

[MIT](LICENSE) © [Avkash Singh](https://github.com/avkashs0521)

