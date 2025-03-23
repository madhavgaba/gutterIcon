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
/**
 * CodeLens Provider for "Go to Implementations"
 */
class GoImplementationCodeLensProvider {
    // @ts-ignore
    provideCodeLenses(document, token) {
        const codeLenses = [];
        const interfaceDefRegex = /^\s*type\s+(\w+)\s+interface\s*{/;
        const interfaceMethodRegex = /^\s*(\w+)\s*\(.*?\)/;
        let inInterfaceBlock = false;
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const line = document.lineAt(lineNumber).text;
            const defMatch = interfaceDefRegex.exec(line);
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
                const methodMatch = interfaceMethodRegex.exec(line);
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
            title: "$(symbol-method) Go to Implementations",
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
        return __awaiter(this, void 0, void 0, function* () {
            const codeLenses = [];
            const methodWithReceiverRegex = /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/;
            const structDefRegex = /^\s*type\s+(\w+)\s+struct\s*{/;
            const goFiles = yield vscode_1.workspace.findFiles("**/*.go");
            // Collect all interfaces and their methods
            const interfaces = yield this.collectInterfaces(goFiles);
            for (let i = 0; i < document.lineCount; i++) {
                const lineText = document.lineAt(i).text;
                // Struct detection
                const structMatch = structDefRegex.exec(lineText);
                if (structMatch) {
                    codeLenses.push(...(yield this.processStruct(document, i, structMatch[1], interfaces, goFiles)));
                }
                // Method detection
                const methodMatch = methodWithReceiverRegex.exec(lineText);
                if (methodMatch) {
                    codeLenses.push(...(yield this.processMethod(document, i, methodMatch[1], interfaces, goFiles)));
                }
            }
            return codeLenses;
        });
    }
    collectInterfaces(goFiles) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const interfaces = new Map();
            for (const file of goFiles) {
                try {
                    const doc = yield vscode_1.workspace.openTextDocument(file);
                    let currentInterface = "";
                    let inInterfaceBlock = false;
                    for (let i = 0; i < doc.lineCount; i++) {
                        const line = doc.lineAt(i).text;
                        const match = /^\s*type\s+(\w+)\s+interface\s*{/.exec(line);
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
                            const methodMatch = /^\s*(\w+)\s*\(/.exec(line);
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
    processStruct(document, line, structName, interfaces, goFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            const structMethods = new Set();
            for (let j = line + 1; j < document.lineCount; j++) {
                const methodMatch = /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/.exec(document.lineAt(j).text);
                if (methodMatch) {
                    structMethods.add(methodMatch[1]);
                }
            }
            const matchingInterfaces = [...interfaces.entries()].filter(([_, methods]) => [...methods].every((method) => structMethods.has(method)));
            return this.createInterfaceCodeLenses(document, line, structName, matchingInterfaces, goFiles);
        });
    }
    processMethod(document, line, methodName, interfaces, goFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const [interfaceName, methods] of interfaces) {
                if (methods.has(methodName)) {
                    return this.createInterfaceCodeLenses(document, line, methodName, [[interfaceName, methods]], goFiles);
                }
            }
            return [];
        });
    }
    createInterfaceCodeLenses(document, line, methodName, matchingInterfaces, goFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            const codeLenses = [];
            for (const [interfaceName] of matchingInterfaces) {
                // Find the first file containing the interface definition
                for (const file of goFiles) {
                    try {
                        const doc = yield vscode_1.workspace.openTextDocument(file);
                        for (let i = 0; i < doc.lineCount; i++) {
                            if (doc.lineAt(i).text.includes(`type ${interfaceName} interface`)) {
                                const interfacePos = new vscode_1.Position(i, doc.lineAt(i).text.indexOf(interfaceName));
                                const methodPos = new vscode_1.Position(line, document.lineAt(line).text.indexOf(methodName));
                                codeLenses.push(new vscode_1.CodeLens(new vscode_1.Range(methodPos, methodPos), {
                                    title: "$(symbol-interface) Go to Interface",
                                    command: "extension.goToInterface",
                                    arguments: [{ position: methodPos, methodName, interfaceLocation: interfacePos, interfaceFile: file }],
                                }));
                                // Break out of both loops once we find the first occurrence
                                break;
                            }
                        }
                        // If we found the interface, break out of the file loop
                        if (codeLenses.length > 0)
                            break;
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
    // @ts-ignore
    context.subscriptions.push(vscode_1.languages.registerCodeLensProvider({ language: "go" }, new GoImplementationCodeLensProvider()));
    // @ts-ignore
    context.subscriptions.push(vscode_1.languages.registerCodeLensProvider({ language: "go" }, new GoInterfaceCodeLensProvider()));
    // Register the commands
    context.subscriptions.push(vscode_1.commands.registerCommand('extension.goToImplementation', (target) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const document = (_a = vscode_1.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document;
        if (!document)
            return;
        const implementations = yield vscode_1.commands.executeCommand('vscode.executeImplementationProvider', document.uri, target.position);
        if (implementations && implementations.length > 0) {
            const location = implementations[0];
            yield vscode_1.commands.executeCommand('vscode.open', location.uri, { selection: location.range });
        }
    })));
    context.subscriptions.push(vscode_1.commands.registerCommand('extension.goToInterface', (target) => __awaiter(this, void 0, void 0, function* () {
        if (target.interfaceLocation && target.interfaceFile) {
            yield vscode_1.commands.executeCommand('vscode.open', target.interfaceFile, { selection: new vscode_1.Range(target.interfaceLocation, target.interfaceLocation) });
        }
    })));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map