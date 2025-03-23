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
exports.ImplementationCodeLensProvider = void 0;
const vscode_1 = require("vscode");
const languagePatterns_1 = require("../patterns/languagePatterns");
class ImplementationCodeLensProvider {
    // @ts-ignore
    provideCodeLenses(document, token) {
        try {
            const codeLenses = [];
            const language = document.languageId;
            const patterns = languagePatterns_1.LANGUAGE_PATTERNS[language];
            if (!patterns)
                return codeLenses;
            // For Java, we need to search for implementations in other files
            if (language === 'java') {
                return this.provideJavaCodeLenses(document, patterns);
            }
            // For Go, use the existing implementation
            let inInterfaceBlock = false;
            for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
                const line = document.lineAt(lineNumber).text;
                const defMatch = patterns.interfaceDef.exec(line);
                if (defMatch) {
                    const interfaceName = defMatch[1];
                    const codeLens = this.createCodeLens(document, lineNumber, interfaceName, 0);
                    if (codeLens)
                        codeLenses.push(codeLens);
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
                        const codeLens = this.createCodeLens(document, lineNumber, methodMatch[1], 0);
                        if (codeLens)
                            codeLenses.push(codeLens);
                    }
                }
            }
            return codeLenses;
        }
        catch (error) {
            console.error('Error providing code lenses:', error);
            return [];
        }
    }
    provideJavaCodeLenses(document, patterns) {
        return __awaiter(this, void 0, void 0, function* () {
            const codeLenses = [];
            const filePattern = '**/*.java';
            const javaFiles = yield vscode_1.workspace.findFiles(filePattern);
            console.log(`Found ${javaFiles.length} Java files`);
            const interfaces = yield this.collectJavaInterfaces(javaFiles, patterns);
            console.log('Found interfaces:', Array.from(interfaces.entries()).map(([name, methods]) => `${name}: ${Array.from(methods).join(', ')}`));
            let inInterfaceBlock = false;
            let currentInterface = "";
            for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
                const line = document.lineAt(lineNumber).text;
                const defMatch = patterns.interfaceDef.exec(line);
                if (defMatch) {
                    currentInterface = defMatch[1];
                    console.log(`Found interface definition: ${currentInterface}`);
                    const implementations = yield this.findJavaImplementations(currentInterface, javaFiles, patterns);
                    console.log(`Found ${implementations.length} implementations for interface ${currentInterface}`);
                    if (implementations.length > 0) {
                        const codeLens = this.createCodeLens(document, lineNumber, currentInterface, implementations.length);
                        if (codeLens)
                            codeLenses.push(codeLens);
                    }
                    inInterfaceBlock = true;
                    continue;
                }
                if (inInterfaceBlock) {
                    if (/^\s*}\s*$/.test(line)) {
                        inInterfaceBlock = false;
                        currentInterface = "";
                        continue;
                    }
                    const methodMatch = patterns.interfaceMethod.exec(line);
                    if (methodMatch) {
                        const methodName = methodMatch[1];
                        console.log(`Found interface method: ${methodName}`);
                        const implementations = yield this.findJavaMethodImplementations(methodName, interfaces, javaFiles, patterns);
                        console.log(`Found ${implementations.length} implementations for method ${methodName}`);
                        if (implementations.length > 0) {
                            const codeLens = this.createCodeLens(document, lineNumber, methodName, implementations.length);
                            if (codeLens)
                                codeLenses.push(codeLens);
                        }
                    }
                }
            }
            return codeLenses;
        });
    }
    collectJavaInterfaces(javaFiles, patterns) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const interfaces = new Map();
            for (const file of javaFiles) {
                try {
                    const doc = yield vscode_1.workspace.openTextDocument(file);
                    let currentInterface = "";
                    let inInterfaceBlock = false;
                    for (let i = 0; i < doc.lineCount; i++) {
                        const line = doc.lineAt(i).text;
                        const match = patterns.interfaceDef.exec(line);
                        if (match) {
                            currentInterface = match[1];
                            console.log(`Found interface in ${file.fsPath}: ${currentInterface}`);
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
                                const methodName = methodMatch[1];
                                console.log(`Found interface method in ${currentInterface}: ${methodName}`);
                                (_a = interfaces.get(currentInterface)) === null || _a === void 0 ? void 0 : _a.add(methodName);
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
    findJavaImplementations(interfaceName, javaFiles, patterns) {
        return __awaiter(this, void 0, void 0, function* () {
            const implementations = [];
            for (const file of javaFiles) {
                try {
                    const doc = yield vscode_1.workspace.openTextDocument(file);
                    for (let i = 0; i < doc.lineCount; i++) {
                        const line = doc.lineAt(i).text;
                        const match = patterns.structDef.exec(line);
                        if (match) {
                            console.log(`Checking class in ${file.fsPath}: ${line}`);
                            if (line.includes(`implements ${interfaceName}`)) {
                                console.log(`Found implementation of ${interfaceName} in ${file.fsPath}`);
                                implementations.push(file);
                                break;
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Error reading file ${file.fsPath}:`, error);
                }
            }
            return implementations;
        });
    }
    findJavaMethodImplementations(methodName, interfaces, javaFiles, patterns) {
        return __awaiter(this, void 0, void 0, function* () {
            const implementations = [];
            for (const file of javaFiles) {
                try {
                    const doc = yield vscode_1.workspace.openTextDocument(file);
                    let currentClass = "";
                    let inClassBlock = false;
                    let implementsInterfaces = [];
                    // First, find if this class implements any interfaces
                    for (let i = 0; i < doc.lineCount; i++) {
                        const line = doc.lineAt(i).text;
                        const match = patterns.structDef.exec(line);
                        if (match) {
                            currentClass = match[1];
                            console.log(`Checking class ${currentClass} in ${file.fsPath}`);
                            // Extract interfaces from implements clause
                            const implementsMatch = line.match(/implements\s+([^{]+)/);
                            if (implementsMatch) {
                                implementsInterfaces = implementsMatch[1].split(',').map(i => i.trim());
                                console.log(`Class ${currentClass} implements: ${implementsInterfaces.join(', ')}`);
                            }
                            inClassBlock = true;
                            continue;
                        }
                        if (inClassBlock) {
                            if (/^\s*}\s*$/.test(line)) {
                                inClassBlock = false;
                                continue;
                            }
                            // Check if this method matches any interface method
                            const methodMatch = patterns.methodWithReceiver.exec(line);
                            if (methodMatch && methodMatch[1] === methodName) {
                                console.log(`Found method ${methodName} in class ${currentClass}`);
                                // Check if any of the implemented interfaces have this method
                                for (const interfaceName of implementsInterfaces) {
                                    const interfaceMethods = interfaces.get(interfaceName);
                                    if (interfaceMethods === null || interfaceMethods === void 0 ? void 0 : interfaceMethods.has(methodName)) {
                                        console.log(`Method ${methodName} in ${currentClass} implements interface ${interfaceName}`);
                                        implementations.push(file);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Error reading file ${file.fsPath}:`, error);
                }
            }
            return implementations;
        });
    }
    createCodeLens(document, line, methodName, implementationCount) {
        const lineText = document.lineAt(line).text;
        const methodIndex = lineText.indexOf(methodName);
        if (methodIndex === -1) {
            console.log(`Warning: Could not find method name "${methodName}" in line: ${lineText}`);
            return undefined;
        }
        const pos = new vscode_1.Position(line, methodIndex);
        console.log(`Creating CodeLens for ${methodName} at line ${line}`);
        return new vscode_1.CodeLens(new vscode_1.Range(pos, pos), {
            title: `$(symbol-method) ${implementationCount} implementation${implementationCount !== 1 ? 's' : ''}`,
            command: "extension.goToImplementation",
            arguments: [{ position: pos, methodName }],
        });
    }
}
exports.ImplementationCodeLensProvider = ImplementationCodeLensProvider;
//# sourceMappingURL=implementationProvider.js.map