/**
 * Universal Multi-Language Code Harness
 * 
 * Provides robust dual-mode execution wrappers for competitive coding:
 * 1. Function / Class style (solution, def solution, class Solution) automatically receives 
 *    stdin-to-parameter argument parsing and stdout serialization across Python, JS, TS, Java, and C++.
 * 2. Competitive programming style (cin/cout, sys.stdin, Scanner, process.stdin) executes untouched.
 * 3. Java case-sensitivity normalizer: strips top-level 'public class' or aligns filename to prevent Linux javac errors.
 */

export interface PreparedCodeResult {
    code: string;
    fileName: string;
    lineOffset: number;
}

export class CodeHarness {
    /**
     * Prepares user code and determines the correct filename and header line offset for Piston execution.
     */
    public static prepare(language: string, rawCode: string, defaultExt: string): PreparedCodeResult {
        const lang = language.toLowerCase().trim();

        switch (lang) {
            case "java":
                return this.prepareJava(rawCode, defaultExt);
            case "javascript":
            case "js":
            case "typescript":
            case "ts": {
                const prep = this.prepareJavaScript(rawCode);
                return {
                    code: prep.code,
                    fileName: `main.${defaultExt}`,
                    lineOffset: prep.lineOffset,
                };
            }
            case "python":
            case "py":
            case "python3": {
                const prep = this.preparePython(rawCode);
                return {
                    code: prep.code,
                    fileName: `main.${defaultExt}`,
                    lineOffset: prep.lineOffset,
                };
            }
            case "cpp":
            case "c++": {
                const prep = this.prepareCpp(rawCode);
                return {
                    code: prep.code,
                    fileName: `main.${defaultExt}`,
                    lineOffset: prep.lineOffset,
                };
            }
            case "c": {
                const prep = this.prepareC(rawCode);
                return {
                    code: prep.code,
                    fileName: `main.${defaultExt}`,
                    lineOffset: prep.lineOffset,
                };
            }
            default:
                return {
                    code: rawCode,
                    fileName: `main.${defaultExt}`,
                    lineOffset: 0,
                };
        }
    }

    /**
     * Java case-sensitivity and solution wrapper:
     * If user writes class Solution without main(), wrap with public class Main runner.
     * If user writes public class Main or public class Solution with main(), normalize class name.
     */
    private static prepareJava(rawCode: string, defaultExt: string): PreparedCodeResult {
        const hasMain = /\bpublic\s+static\s+void\s+main\s*\(/.test(rawCode);
        const hasSolutionClass = /\bclass\s+Solution\b/.test(rawCode);

        // If user wrote class Solution without main(), auto-generate the Main driver with reflection
        if (!hasMain && hasSolutionClass) {
            const wrappedCode = `import java.util.*;
import java.lang.reflect.*;

${rawCode}

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        StringBuilder sb = new StringBuilder();
        while (scanner.hasNextLine()) {
            sb.append(scanner.nextLine()).append("\\n");
        }
        String input = sb.toString().trim();
        if (input.isEmpty()) return;

        try {
            Solution sol = new Solution();
            Method targetMethod = null;
            for (Method m : Solution.class.getDeclaredMethods()) {
                if (m.getName().equals("solution") || m.getName().equals("solve")) {
                    targetMethod = m;
                    break;
                }
            }
            if (targetMethod == null) {
                Method[] methods = Solution.class.getDeclaredMethods();
                if (methods.length > 0) targetMethod = methods[0];
            }

            if (targetMethod != null) {
                targetMethod.setAccessible(true);
                Class<?>[] paramTypes = targetMethod.getParameterTypes();
                String[] lines = input.split("\\n");
                
                Object[] invokeArgs = new Object[paramTypes.length];
                if (paramTypes.length == 1) {
                    Class<?> p = paramTypes[0];
                    if (p == int[].class) {
                        String arrLine = lines.length > 1 ? lines[1].trim() : lines[0].trim();
                        String[] tokens = arrLine.split("\\\\s+");
                        int[] arr = new int[tokens.length];
                        for (int i = 0; i < tokens.length; i++) arr[i] = Integer.parseInt(tokens[i]);
                        invokeArgs[0] = arr;
                    } else if (p == int.class || p == Integer.class) {
                        invokeArgs[0] = Integer.parseInt(lines[0].trim().split("\\\\s+")[0]);
                    } else if (p == long[].class) {
                        String arrLine = lines.length > 1 ? lines[1].trim() : lines[0].trim();
                        String[] tokens = arrLine.split("\\\\s+");
                        long[] arr = new long[tokens.length];
                        for (int i = 0; i < tokens.length; i++) arr[i] = Long.parseLong(tokens[i]);
                        invokeArgs[0] = arr;
                    } else if (p == String.class) {
                        invokeArgs[0] = input;
                    } else if (p == String[].class) {
                        invokeArgs[0] = lines;
                    } else {
                        invokeArgs[0] = input;
                    }
                } else if (paramTypes.length == 2) {
                    if ((paramTypes[0] == int.class || paramTypes[0] == Integer.class) && paramTypes[1] == int[].class) {
                        invokeArgs[0] = Integer.parseInt(lines[0].trim().split("\\\\s+")[0]);
                        String arrLine = lines.length > 1 ? lines[1].trim() : lines[0].trim();
                        String[] tokens = arrLine.split("\\\\s+");
                        int[] arr = new int[tokens.length];
                        for (int i = 0; i < tokens.length; i++) arr[i] = Integer.parseInt(tokens[i]);
                        invokeArgs[1] = arr;
                    }
                }

                Object result = targetMethod.invoke(sol, invokeArgs);
                if (result != null) {
                    if (result instanceof int[]) {
                        System.out.println(Arrays.toString((int[]) result));
                    } else if (result instanceof long[]) {
                        System.out.println(Arrays.toString((long[]) result));
                    } else if (result instanceof Object[]) {
                        System.out.println(Arrays.deepToString((Object[]) result));
                    } else {
                        System.out.println(result);
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
`;
            return { code: wrappedCode, fileName: `Main.${defaultExt}`, lineOffset: 3 };
        }

        let code = rawCode;
        let fileName = `Main.${defaultExt}`;

        // Find public class name
        const match = code.match(/public\s+class\s+([A-Za-z0-9_$]+)/);
        if (match && match[1]) {
            const className = match[1];
            fileName = `${className}.${defaultExt}`;
            code = code.replace(/public\s+class\s+([A-Za-z0-9_$]+)/, "class $1");
        }

        return { code, fileName, lineOffset: 0 };
    }

    private static prepareJavaScript(rawCode: string): { code: string; lineOffset: number } {
        const hasStdin = rawCode.includes("process.stdin") || rawCode.includes("fs.readFileSync");
        const hasSolutionFn = /(?:function\s+solution\b|const\s+solution\s*=|let\s+solution\s*=|var\s+solution\s*=|class\s+Solution\b)/.test(rawCode);

        if (!hasSolutionFn || hasStdin) {
            return { code: rawCode, lineOffset: 0 };
        }

        const code = `const fs = require("fs");
const __af_input = fs.readFileSync(0, "utf-8");

${rawCode}

(function() {
    let fn = null;
    if (typeof solution === "function") {
        fn = solution;
    } else if (typeof Solution === "function") {
        try {
            const inst = new Solution();
            if (typeof inst.solution === "function") fn = inst.solution.bind(inst);
            else if (typeof inst.solve === "function") fn = inst.solve.bind(inst);
        } catch(e) {}
    }

    if (fn) {
        const raw = __af_input.trim();
        const lines = raw.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
        const parsedArgs = lines.map(l => {
            try { return JSON.parse(l); } catch(e) {
                if (l.includes(" ")) {
                    return l.split(/\\s+/).map(x => isNaN(Number(x)) ? x : Number(x));
                }
                return isNaN(Number(l)) ? l : Number(l);
            }
        });

        let res;
        const expectedLen = fn.length;
        if (expectedLen === 1) {
            if (parsedArgs.length === 2 && typeof parsedArgs[0] === "number" && Array.isArray(parsedArgs[1])) {
                try { res = fn(parsedArgs[1]); } catch(e) { res = fn(parsedArgs); }
            } else if (parsedArgs.length === 1) {
                res = fn(parsedArgs[0]);
            } else {
                try { res = fn(parsedArgs); } catch(e) { res = fn(raw); }
            }
        } else if (expectedLen > 1) {
            try { res = fn(...parsedArgs); } catch(e) { res = fn(parsedArgs); }
        } else {
            try { res = fn(...parsedArgs); } catch(e) { res = fn(raw); }
        }

        if (res !== undefined) {
            console.log(typeof res === "object" ? JSON.stringify(res) : res);
        }
    }
})();
`;
        return { code, lineOffset: 3 };
    }

    private static preparePython(rawCode: string): { code: string; lineOffset: number } {
        const hasStdin = rawCode.includes("sys.stdin") || rawCode.includes("input(");
        const hasSolution = /(?:def\s+solution\s*\(|class\s+Solution\b)/.test(rawCode);

        if (!hasSolution || hasStdin) {
            return { code: rawCode, lineOffset: 0 };
        }

        const code = `import sys, json, inspect

${rawCode}

if __name__ == '__main__':
    raw_input = sys.stdin.read().strip()
    
    fn = None
    if 'solution' in globals() and callable(globals()['solution']):
        fn = globals()['solution']
    elif 'Solution' in globals() and isinstance(globals()['Solution'], type):
        inst = globals()['Solution']()
        if hasattr(inst, 'solution') and callable(getattr(inst, 'solution')):
            fn = getattr(inst, 'solution')
        elif hasattr(inst, 'solve') and callable(getattr(inst, 'solve')):
            fn = getattr(inst, 'solve')

    if fn is not None:
        try:
            sig = inspect.signature(fn)
            params = [p for p in sig.parameters.values() if p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)]
            has_varargs = any(p.kind == inspect.Parameter.VAR_POSITIONAL for p in sig.parameters.values())
            param_count = len(params)
        except Exception:
            param_count = 1
            has_varargs = True

        lines = [l.strip() for l in raw_input.split('\\n') if l.strip()]
        
        parsed_args = []
        for l in lines:
            try:
                parsed_args.append(json.loads(l))
            except Exception:
                if ' ' in l:
                    parsed_args.append([int(x) if (x.isdigit() or (x.startswith('-') and x[1:].isdigit())) else (float(x) if x.replace('.','',1).isdigit() else x) for x in l.split()])
                elif l.isdigit() or (l.startswith('-') and l[1:].isdigit()):
                    parsed_args.append(int(l))
                else:
                    parsed_args.append(l)

        res = None
        if has_varargs or param_count == len(parsed_args):
            res = fn(*parsed_args)
        elif param_count == 1:
            if len(parsed_args) == 2 and isinstance(parsed_args[0], int) and isinstance(parsed_args[1], list):
                res = fn(parsed_args[1])
            elif len(parsed_args) == 1:
                res = fn(parsed_args[0])
            else:
                res = fn(parsed_args)
        else:
            res = fn(*parsed_args)

        if res is not None:
            if isinstance(res, (list, tuple, dict)):
                print(json.dumps(res))
            else:
                print(res)
`;
        return { code, lineOffset: 2 };
    }

    private static prepareCpp(rawCode: string): { code: string; lineOffset: number } {
        const hasMain = /\b(int|void)\s+main\s*\(/.test(rawCode);
        const hasSolutionClass = /\bclass\s+Solution\b/.test(rawCode);
        const hasSolutionFn = /\bsolution\s*\(/.test(rawCode);

        if (hasMain || (!hasSolutionClass && !hasSolutionFn)) {
            return { code: rawCode, lineOffset: 0 };
        }

        const code = `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>

${rawCode}

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    std::string input, line;
    while (std::getline(std::cin, line)) {
        if (!input.empty()) input += "\\n";
        input += line;
    }

${hasSolutionClass ? `    Solution sol;
    std::cout << sol.solution(input);` : `    std::cout << solution(input);`}
    return 0;
}
`;
        return { code, lineOffset: 6 };
    }

    private static prepareC(rawCode: string): { code: string; lineOffset: number } {
        const hasMain = /\b(int|void)\s+main\s*\(/.test(rawCode);
        const hasSolutionFn = /\bsolution\s*\(/.test(rawCode);

        if (hasMain || !hasSolutionFn) {
            return { code: rawCode, lineOffset: 0 };
        }

        const code = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

${rawCode}

int main() {
    static char input[1048576];
    size_t bytesRead = fread(input, 1, sizeof(input) - 1, stdin);
    input[bytesRead] = '\\0';

    char* result = (char*)solution(input);
    if (result != NULL) {
        printf("%s", result);
    }
    return 0;
}
`;
        return { code, lineOffset: 4 };
    }
}
