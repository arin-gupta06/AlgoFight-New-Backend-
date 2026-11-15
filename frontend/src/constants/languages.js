export const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript", ext: "js" },
  { value: "python", label: "Python", ext: "py" },
  { value: "cpp", label: "C++", ext: "cpp" },
  { value: "java", label: "Java", ext: "java" },
  { value: "typescript", label: "TypeScript", ext: "ts" },
  { value: "c", label: "C", ext: "c" },
];

export const STARTER_TEMPLATES = {
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
  ].join("\n"),
};

export function getLanguageLabel(langValue) {
  const match = SUPPORTED_LANGUAGES.find((l) => l.value === String(langValue).toLowerCase());
  return match ? match.label : String(langValue || "JavaScript");
}

export function getStarterCodeForLanguage(problem, language) {
  const key = String(language || "javascript").toLowerCase();
  const starterCodeByLanguage =
    problem && typeof problem.starterCode === "object" ? problem.starterCode : {};

  const rawStarter =
    starterCodeByLanguage?.[key] ||
    STARTER_TEMPLATES[key] ||
    STARTER_TEMPLATES.javascript;

  const normalized = String(rawStarter || "");
  if (key === "javascript") {
    return normalized.replace(
      /\n?\s*module\.exports\s*=\s*\{?\s*solution\s*\}?\s*;?\s*$/m,
      ""
    );
  }

  return normalized;
}
