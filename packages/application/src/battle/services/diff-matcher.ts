/**
 * Diff Matching Utility for Battle and Practice Checkpoint Persistence
 */

export const STARTER_TEMPLATES: Record<string, string> = {
    javascript: [
        "function solution(input) {",
        "  // TODO: implement solution",
        "  return input;",
        "}",
    ].join("\n"),

    python: [
        "def solution(input_data):",
        "    # TODO: implement solution",
        "    return input_data",
    ].join("\n"),

    cpp: [
        "#include <iostream>",
        "#include <string>",
        "#include <vector>",
        "#include <algorithm>",
        "",
        "using namespace std;",
        "",
        "// Pre-defined solution function: implement your logic here",
        "string solution(string input) {",
        "    // TODO: implement solution",
        "    return input;",
        "}",
        "",
        "int main() {",
        "    ios_base::sync_with_stdio(false);",
        "    cin.tie(NULL);",
        "",
        "    string input, line;",
        "    while (getline(cin, line)) {",
        "        if (!input.empty()) input += \"\\n\";",
        "        input += line;",
        "    }",
        "",
        "    cout << solution(input);",
        "    return 0;",
        "}",
    ].join("\n"),

    java: [
        "import java.util.*;",
        "",
        "public class Main {",
        "    public static void main(String[] args) {",
        "        Scanner scanner = new Scanner(System.in);",
        "        // TODO: implement solution",
        "    }",
        "}",
    ].join("\n"),

    typescript: [
        "function solution(input: any): any {",
        "  // TODO: implement solution",
        "  return input;",
        "}",
    ].join("\n"),

    c: [
        "#include <stdio.h>",
        "#include <stdlib.h>",
        "#include <string.h>",
        "",
        "// Pre-defined solution function: implement your logic here",
        "char* solution(const char* input) {",
        "    // TODO: implement solution",
        "    return (char*)input;",
        "}",
        "",
        "int main() {",
        "    static char input[1048576];",
        "    size_t bytesRead = fread(input, 1, sizeof(input) - 1, stdin);",
        "    input[bytesRead] = '\\0';",
        "",
        "    char* result = solution(input);",
        "    if (result != NULL) {",
        "        printf(\"%s\", result);",
        "    }",
        "    return 0;",
        "}",
    ].join("\n"),
};

export function getStarterCodeForLanguage(problem: any, language: string): string {
    const key = String(language || "javascript").toLowerCase();
    const starterCodeByLanguage =
        problem && typeof problem.starterCode === "object" ? problem.starterCode : {};

    const rawStarter =
        starterCodeByLanguage?.[key] ||
        STARTER_TEMPLATES[key] ||
        STARTER_TEMPLATES.javascript ||
        "";

    const normalized = String(rawStarter || "");
    if (key === "javascript") {
        return normalized.replace(
            /\n?\s*module\.exports\s*=\s*\{?\s*solution\s*\}?\s*;?\s*$/m,
            ""
        );
    }

    return normalized;
}

/**
 * Normalizes code by harmonizing line endings, trimming per-line trailing spaces,
 * and stripping surrounding blank lines.
 */
export function normalizeCode(code?: string | null): string {
    if (!code) return "";
    return code
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .trim();
}

/**
 * Determines whether userCode contains meaningful changes compared to the problem's starter template.
 */
export function isModifiedFromStarter(problem: any, language: string, userCode: string): boolean {
    const normUser = normalizeCode(userCode);
    if (!normUser) return false;

    const starter = getStarterCodeForLanguage(problem, language);
    const normStarter = normalizeCode(starter);

    return normUser !== normStarter;
}

/**
 * Checks if this exact normalized code was already submitted for this problem.
 */
export function isIdenticalToExistingSubmission(
    existingSubmissions: Array<{ problemId: string; code: string; language?: string }>,
    problemId: string,
    userCode: string
): boolean {
    const normUser = normalizeCode(userCode);
    if (!normUser) return false;

    return existingSubmissions.some(
        (sub) => sub.problemId === problemId && normalizeCode(sub.code) === normUser
    );
}
