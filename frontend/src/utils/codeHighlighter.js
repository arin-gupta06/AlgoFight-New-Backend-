/**
 * High-performance, lightweight code syntax highlighter for AlgoFight Code Editor.
 * Tokenizes arbitrary code in JavaScript, Python, C++, and Java into colorful syntax tokens.
 */

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const KEYWORDS_BY_LANG = {
  javascript: [
    "function", "return", "const", "let", "var", "if", "else", "for", "while", "do",
    "switch", "case", "break", "continue", "default", "try", "catch", "finally", "throw",
    "new", "delete", "typeof", "instanceof", "void", "yield", "async", "await", "class",
    "extends", "super", "this", "import", "export", "from", "as", "debugger", "in", "of"
  ],
  python: [
    "def", "return", "class", "if", "elif", "else", "for", "while", "break", "continue",
    "pass", "import", "from", "as", "try", "except", "finally", "raise", "with", "yield",
    "lambda", "global", "nonlocal", "assert", "del", "in", "is", "not", "and", "or"
  ],
  cpp: [
    "auto", "break", "case", "catch", "class", "const", "continue", "default", "delete",
    "do", "else", "enum", "explicit", "export", "extern", "for", "friend", "goto", "if",
    "inline", "mutable", "namespace", "new", "noexcept", "operator", "private", "protected",
    "public", "register", "reinterpret_cast", "return", "sizeof", "static", "static_assert",
    "static_cast", "struct", "switch", "template", "this", "thread_local", "throw", "try",
    "typedef", "typeid", "typename", "union", "using", "virtual", "volatile", "while"
  ],
  java: [
    "abstract", "assert", "break", "case", "catch", "class", "const", "continue", "default",
    "do", "else", "enum", "extends", "final", "finally", "for", "goto", "if", "implements",
    "import", "instanceof", "interface", "native", "new", "package", "private", "protected",
    "public", "return", "static", "strictfp", "super", "switch", "synchronized", "this",
    "throw", "throws", "transient", "try", "void", "volatile", "while"
  ]
};

const TYPES_BY_LANG = {
  javascript: [
    "Array", "Object", "String", "Number", "Boolean", "Symbol", "BigInt", "Promise",
    "Map", "Set", "WeakMap", "WeakSet", "Date", "RegExp", "Error", "JSON", "Math"
  ],
  python: [
    "int", "float", "str", "bool", "list", "dict", "set", "tuple", "bytes", "bytearray",
    "range", "complex", "type", "object", "List", "Dict", "Set", "Tuple", "Optional", "Any", "Union"
  ],
  cpp: [
    "int", "long", "short", "char", "float", "double", "bool", "void", "size_t",
    "int8_t", "int16_t", "int32_t", "int64_t", "uint8_t", "uint16_t", "uint32_t", "uint64_t",
    "string", "vector", "map", "set", "unordered_map", "unordered_set", "pair", "queue",
    "stack", "deque", "priority_queue", "list", "bitset", "array", "tuple"
  ],
  java: [
    "int", "long", "short", "byte", "char", "float", "double", "boolean", "void",
    "String", "Integer", "Long", "Double", "Float", "Boolean", "Character",
    "List", "ArrayList", "LinkedList", "Map", "HashMap", "TreeMap", "Set", "HashSet",
    "Queue", "Deque", "Stack", "PriorityQueue", "Arrays", "Collections", "Math", "System"
  ]
};

const BUILTINS_BY_LANG = {
  javascript: [
    "console", "window", "document", "true", "false", "null", "undefined", "NaN", "Infinity",
    "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURI", "decodeURI"
  ],
  python: [
    "True", "False", "None", "print", "len", "range", "enumerate", "zip", "map", "filter",
    "sorted", "reversed", "min", "max", "sum", "abs", "round", "input", "open", "isinstance",
    "issubclass", "hasattr", "getattr", "setattr", "delattr", "repr", "id", "self"
  ],
  cpp: [
    "true", "false", "nullptr", "NULL", "cin", "cout", "cerr", "clog", "endl", "std",
    "min", "max", "sort", "reverse", "fill", "swap", "abs", "sqrt", "pow"
  ],
  java: [
    "true", "false", "null", "out", "err", "in", "println", "print", "printf"
  ]
};

export function highlightCode(code, language = "javascript") {
  if (!code) return "";

  const langKey = language?.toLowerCase?.() || "javascript";
  const normalizedLang = langKey.includes("py")
    ? "python"
    : langKey.includes("c++") || langKey.includes("cpp") || langKey === "c" || langKey === "clang"
    ? "cpp"
    : langKey.includes("java") && !langKey.includes("script")
    ? "java"
    : "javascript";

  const keywords = KEYWORDS_BY_LANG[normalizedLang] || KEYWORDS_BY_LANG.javascript;
  const types = TYPES_BY_LANG[normalizedLang] || TYPES_BY_LANG.javascript;
  const builtins = BUILTINS_BY_LANG[normalizedLang] || BUILTINS_BY_LANG.javascript;

  const keywordSet = new Set(keywords);
  const typeSet = new Set(types);
  const builtinSet = new Set(builtins);

  const isPython = normalizedLang === "python";
  const isCpp = normalizedLang === "cpp";

  const pattern = isPython
    ? /("""[\s\S]*?"""|'''[\s\S]*?'''|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|[a-zA-Z_$][a-zA-Z0-9_$]*|[!=<>]=?|[-+*/%&|^~]=?|->|::|[{}()[\],;.:])/g
    : isCpp
    ? /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#(?:include|define|undef|ifdef|ifndef|if|elif|else|endif|pragma)\b|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|[a-zA-Z_$][a-zA-Z0-9_$]*|[!=<>]=?|===|!==|=>|\+\+|--|[-+*/%&|^~]=?|&&|\|\||->|::|[{}()[\],;.:])/g
    : /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|[a-zA-Z_$][a-zA-Z0-9_$]*|[!=<>]=?|===|!==|=>|\+\+|--|[-+*/%&|^~]=?|&&|\|\||->|::|[{}()[\],;.:])/g;

  let lastIndex = 0;
  let result = "";
  let match;

  while ((match = pattern.exec(code)) !== null) {
    const matchIndex = match.index;
    const token = match[0];

    // Non-token characters between matches (e.g. whitespace, tabs, newlines)
    if (matchIndex > lastIndex) {
      result += escapeHtml(code.slice(lastIndex, matchIndex));
    }
    lastIndex = pattern.lastIndex;

    const firstChar = token[0];

    // 1. Comments
    if (token.startsWith("//") || token.startsWith("/*") || (isPython && token.startsWith("#"))) {
      result += `<span class="tok-comment">${escapeHtml(token)}</span>`;
    }
    // 2. Preprocessor (C++)
    else if (token.startsWith("#") && isCpp) {
      result += `<span class="tok-keyword">${escapeHtml(token)}</span>`;
    }
    // 3. Strings
    else if (firstChar === '"' || firstChar === "'" || firstChar === "`" || token.startsWith('"""') || token.startsWith("'''")) {
      result += `<span class="tok-string">${escapeHtml(token)}</span>`;
    }
    // 4. Numbers
    else if (/^(?:0x[0-9a-fA-F]+|\d)/.test(token)) {
      result += `<span class="tok-number">${escapeHtml(token)}</span>`;
    }
    // 5. Identifiers & Words
    else if (/^[a-zA-Z_$]/.test(firstChar)) {
      // Check if followed by '(' -> function invocation or declaration
      const nextCharIdx = lastIndex;
      const restSnippet = code.slice(nextCharIdx, nextCharIdx + 12);
      const isFunction = /^\s*\(/.test(restSnippet);

      if (keywordSet.has(token)) {
        result += `<span class="tok-keyword">${escapeHtml(token)}</span>`;
      } else if (typeSet.has(token)) {
        result += `<span class="tok-type">${escapeHtml(token)}</span>`;
      } else if (builtinSet.has(token)) {
        result += `<span class="tok-builtin">${escapeHtml(token)}</span>`;
      } else if (isFunction) {
        result += `<span class="tok-function">${escapeHtml(token)}</span>`;
      } else {
        result += `<span class="tok-var">${escapeHtml(token)}</span>`;
      }
    }
    // 6. Operators
    else if (/^([!=<>]=?|===|!==|=>|\+\+|--|[-+*/%&|^~]=?|&&|\|\||->|::)$/.test(token)) {
      result += `<span class="tok-operator">${escapeHtml(token)}</span>`;
    }
    // 7. Punctuation
    else if (/^[{}()[\],;.:]$/.test(token)) {
      result += `<span class="tok-punct">${escapeHtml(token)}</span>`;
    }
    else {
      result += escapeHtml(token);
    }
  }

  // Trailing characters
  if (lastIndex < code.length) {
    result += escapeHtml(code.slice(lastIndex));
  }

  return result;
}
