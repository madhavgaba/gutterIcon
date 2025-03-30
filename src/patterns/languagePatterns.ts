import { LanguagePatterns } from '../models/types';

export const LANGUAGE_PATTERNS: { [key: string]: LanguagePatterns } = {
  go: {
    interfaceDef: /^\s*type\s+(\w+)\s+interface\s*{/,
    interfaceMethod: /^\s*(\w+)\s*\(.*?\)/,
    methodWithReceiver: /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/,
    structDef: /^\s*type\s+(\w+)\s+struct\s*{/,
  },
  java: {
    interfaceDef: /^\s*(?:public\s+)?(?:abstract\s+)?interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*{/,
    interfaceMethod: /^\s*(?:public\s+)?(?:abstract\s+)?(?:default\s+)?(?:static\s+)?(?:<[^>]+>\s*)?(\w+)\s*\([^)]*\)(?:\s+throws\s+[^{]+)?\s*;?/,
    methodWithReceiver: /(\w+)\s*\([^)]*\)\s*{/,
    structDef: /class\s+(\w+)/,
  },
}; 