# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-10

### Added
- Initial release of `@avkashhhh/py2cpp`.
- `transpile(source, options)` and `py2cpp(source, options)` main API.
- `transpileSnippet(source, options)` for generating raw C++ snippets.
- Support for Python variable type inference (`int`, `double`, `std::string`, `bool`, `std::vector`, `std::map`).
- Functions with parameter annotations and return type inference.
- Control structures: `if`, `elif`, `else`, `while`, and `pass`.
- Range-based loops: `for i in range(...)` (1, 2, and 3 argument forms) and `for item in items`.
- Automatic detection and inclusion of C++ standard headers (`<iostream>`, `<vector>`, `<string>`, `<map>`, `<cmath>`, `<numeric>`, `<algorithm>`).
- Built-in math functions, list methods (`append`, `pop`, `clear`), and logical operators.
- CLI executable (`py2cpp` and `npx @avkashhhh/py2cpp`).
- Zero runtime dependencies with modern ES modules and TypeScript definitions.

