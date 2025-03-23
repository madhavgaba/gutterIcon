"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANGUAGE_PATTERNS = void 0;
exports.LANGUAGE_PATTERNS = {
    go: {
        interfaceDef: /^\s*type\s+(\w+)\s+interface\s*{/,
        interfaceMethod: /^\s*(\w+)\s*\(.*?\)/,
        methodWithReceiver: /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/,
        structDef: /^\s*type\s+(\w+)\s+struct\s*{/,
    },
    java: {
        interfaceDef: /^\s*(?:public\s+)?(?:abstract\s+)?interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*{/,
        interfaceMethod: /^\s*(?:public\s+)?(?:abstract\s+)?(?:default\s+)?(?:static\s+)?(?:<[^>]+>\s*)?(\w+)\s*\([^)]*\)(?:\s+throws\s+[^{]+)?\s*;?/,
        methodWithReceiver: /^\s*(?:public\s+)?(?:private\s+)?(?:protected\s+)?(?:static\s+)?(?:<[^>]+>\s*)?(\w+)\s*\([^)]*\)(?:\s+throws\s+[^{]+)?\s*{/,
        structDef: /^\s*(?:public\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+[^{]+)?(?:\s+implements\s+[^{]+)?\s*{/,
    },
};
//# sourceMappingURL=languagePatterns.js.map