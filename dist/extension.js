"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode_1 = require("vscode");
const implementationProvider_1 = require("./providers/implementationProvider");
const interfaceProvider_1 = require("./providers/interfaceProvider");
const commands_1 = require("./utils/commands");
const LANGUAGE_PATTERNS = {
    go: {
        interfaceDef: /^\s*type\s+(\w+)\s+interface\s*{/,
        interfaceMethod: /^\s*(\w+)\s*\(.*?\)/,
        methodWithReceiver: /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/,
        structDef: /^\s*type\s+(\w+)\s+struct\s*{/,
    },
    java: {
        interfaceDef: /^\s*(?:public\s+)?interface\s+(\w+)\s*{/,
        interfaceMethod: /^\s*(?:public\s+)?(?:abstract\s+)?(?:default\s+)?(?:static\s+)?(?:<[^>]+>\s*)?(\w+)\s*\(/,
        methodWithReceiver: /^\s*(?:public\s+)?(?:private\s+)?(?:protected\s+)?(?:static\s+)?(?:<[^>]+>\s*)?(\w+)\s*\(/,
        structDef: /^\s*(?:public\s+)?class\s+(\w+)\s*{/,
    },
};
/**
 * CodeLens Provider for "Go to Implementations"
 */
class GoImplementationCodeLensProvider {
    // @ts-ignore
    provideCodeLenses(document, token) {
        const codeLenses = [];
        const language = document.languageId;
        const patterns = LANGUAGE_PATTERNS[language];
        if (!patterns)
            return codeLenses;
        let inInterfaceBlock = false;
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const line = document.lineAt(lineNumber).text;
            const defMatch = patterns.interfaceDef.exec(line);
            if (defMatch) {
                const interfaceName = defMatch[1];
                codeLenses.push(this.createCodeLens(document, lineNumber, interfaceName));
                inInterfaceBlock = true;
                continue;
            }
            if (inInterfaceBlock) {
                if (/^\s*}\s*$/.test(line)) {
                    inInterfaceBlock = false;
                    continue;
                }
                const methodMatch = patterns.interfaceMethod.exec(line);
                if (methodMatch) {
                    codeLenses.push(this.createCodeLens(document, lineNumber, methodMatch[1]));
                }
            }
        }
        return codeLenses;
    }
    createCodeLens(document, line, methodName) {
        const pos = new vscode_1.Position(line, document.lineAt(line).text.indexOf(methodName));
        return new vscode_1.CodeLens(new vscode_1.Range(pos, pos), {
            title: "$(symbol-method) Implemented by",
            command: "extension.goToImplementation",
            arguments: [{ position: pos, methodName }],
        });
    }
}
/**
 * CodeLens Provider for "Go to Interface"
 */
class GoInterfaceCodeLensProvider {
    // @ts-ignore
    provideCodeLenses(document, token) {
        const codeLenses = [];
        const language = document.languageId;
        const patterns = LANGUAGE_PATTERNS[language];
        if (!patterns)
            return codeLenses;
        const filePattern = language === 'go' ? '**/*.go' : '**/*.java';
        vscode_1.workspace.findFiles(filePattern).then(goFiles => {
            // Collect all interfaces and their methods
            this.collectInterfaces(goFiles, language).then(interfaces => {
                for (let i = 0; i < document.lineCount; i++) {
                    const lineText = document.lineAt(i).text;
                    // Struct/Class detection
                    const structMatch = patterns.structDef.exec(lineText);
                    if (structMatch) {
                        this.processStruct(document, i, structMatch[1], interfaces, goFiles, language).then(lenses => {
                            codeLenses.push(...lenses);
                        });
                    }
                    // Method detection
                    const methodMatch = patterns.methodWithReceiver.exec(lineText);
                    if (methodMatch) {
                        this.processMethod(document, i, methodMatch[1], interfaces, goFiles, language).then(lenses => {
                            codeLenses.push(...lenses);
                        });
                    }
                }
            });
        });
        return codeLenses;
    }
    collectInterfaces(goFiles, language) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const interfaces = new Map();
            const patterns = LANGUAGE_PATTERNS[language];
            for (const file of goFiles) {
                try {
                    const doc = yield vscode_1.workspace.openTextDocument(file);
                    let currentInterface = "";
                    let inInterfaceBlock = false;
                    for (let i = 0; i < doc.lineCount; i++) {
                        const line = doc.lineAt(i).text;
                        const match = patterns.interfaceDef.exec(line);
                        if (match) {
                            currentInterface = match[1];
                            interfaces.set(currentInterface, new Set());
                            inInterfaceBlock = true;
                            continue;
                        }
                        if (inInterfaceBlock) {
                            if (/^\s*}\s*$/.test(line)) {
                                inInterfaceBlock = false;
                                continue;
                            }
                            const methodMatch = patterns.interfaceMethod.exec(line);
                            if (methodMatch) {
                                (_a = interfaces.get(currentInterface)) === null || _a === void 0 ? void 0 : _a.add(methodMatch[1]);
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Error reading file ${file.fsPath}:`, error);
                }
            }
            return interfaces;
        });
    }
    processStruct(document, line, structName, interfaces, goFiles, language) {
        return __awaiter(this, void 0, void 0, function* () {
            const patterns = LANGUAGE_PATTERNS[language];
            const structMethods = new Set();
            for (let j = line + 1; j < document.lineCount; j++) {
                const methodMatch = patterns.methodWithReceiver.exec(document.lineAt(j).text);
                if (methodMatch) {
                    structMethods.add(methodMatch[1]);
                }
            }
            const matchingInterfaces = [...interfaces.entries()].filter(([_, methods]) => [...methods].every((method) => structMethods.has(method)));
            return this.createInterfaceCodeLenses(document, line, structName, matchingInterfaces, goFiles, language);
        });
    }
    processMethod(document, line, methodName, interfaces, goFiles, language) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const [interfaceName, methods] of interfaces) {
                if (methods.has(methodName)) {
                    return this.createInterfaceCodeLenses(document, line, methodName, [[interfaceName, methods]], goFiles, language);
                }
            }
            return [];
        });
    }
    createInterfaceCodeLenses(document, line, methodName, matchingInterfaces, goFiles, language) {
        return __awaiter(this, void 0, void 0, function* () {
            const codeLenses = [];
            const patterns = LANGUAGE_PATTERNS[language];
            for (const [interfaceName] of matchingInterfaces) {
                // Find the first file containing the interface definition
                for (const file of goFiles) {
                    try {
                        const doc = yield vscode_1.workspace.openTextDocument(file);
                        for (let i = 0; i < doc.lineCount; i++) {
                            if (doc.lineAt(i).text.match(patterns.interfaceDef)) {
                                const interfacePos = new vscode_1.Position(i, doc.lineAt(i).text.indexOf(interfaceName));
                                const methodPos = new vscode_1.Position(line, document.lineAt(line).text.indexOf(methodName));
                                codeLenses.push(new vscode_1.CodeLens(new vscode_1.Range(methodPos, methodPos), {
                                    title: "$(symbol-interface) Interface",
                                    command: "extension.goToInterface",
                                    arguments: [{ position: methodPos, methodName, interfaceLocation: interfacePos, interfaceFile: file }],
                                }));
                                return codeLenses;
                            }
                        }
                    }
                    catch (error) {
                        console.error(`Error reading file ${file.fsPath}:`, error);
                    }
                }
            }
            return codeLenses;
        });
    }
}
function activate(context) {
    // Register providers for both Go and Java
    const supportedLanguages = ['go', 'java'];
    supportedLanguages.forEach(lang => {
        context.subscriptions.push(
        // @ts-ignore
        vscode_1.languages.registerCodeLensProvider({ language: lang }, new implementationProvider_1.ImplementationCodeLensProvider()));
        context.subscriptions.push(
        // @ts-ignore
        vscode_1.languages.registerCodeLensProvider({ language: lang }, new interfaceProvider_1.InterfaceCodeLensProvider()));
    });
    // Register commands
    (0, commands_1.registerCommands)().then(commands => {
        context.subscriptions.push(...commands);
    });
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map