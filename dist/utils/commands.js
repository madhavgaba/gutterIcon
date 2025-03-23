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
exports.registerCommands = void 0;
const vscode_1 = require("vscode");
const languagePatterns_1 = require("../patterns/languagePatterns");
function registerCommands() {
    return __awaiter(this, void 0, void 0, function* () {
        return [
            vscode_1.commands.registerCommand('extension.goToImplementation', (target) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const document = (_a = vscode_1.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document;
                if (!document)
                    return;
                const language = document.languageId;
                if (language === 'java') {
                    // For Java, use our custom implementation detection
                    const filePattern = '**/*.java';
                    const javaFiles = yield vscode_1.workspace.findFiles(filePattern);
                    const implementations = [];
                    for (const file of javaFiles) {
                        try {
                            const doc = yield vscode_1.workspace.openTextDocument(file);
                            let currentClass = "";
                            let inClassBlock = false;
                            for (let i = 0; i < doc.lineCount; i++) {
                                const line = doc.lineAt(i).text;
                                const match = languagePatterns_1.LANGUAGE_PATTERNS.java.structDef.exec(line);
                                if (match) {
                                    currentClass = match[1];
                                    if (line.includes(`implements ${target.methodName}`)) {
                                        const pos = new vscode_1.Position(i, line.indexOf(currentClass));
                                        implementations.push(new vscode_1.Location(file, new vscode_1.Range(pos, pos)));
                                    }
                                    inClassBlock = true;
                                    continue;
                                }
                                if (inClassBlock) {
                                    if (/^\s*}\s*$/.test(line)) {
                                        inClassBlock = false;
                                        continue;
                                    }
                                    const methodMatch = languagePatterns_1.LANGUAGE_PATTERNS.java.methodWithReceiver.exec(line);
                                    if (methodMatch && methodMatch[1] === target.methodName) {
                                        const pos = new vscode_1.Position(i, line.indexOf(target.methodName));
                                        implementations.push(new vscode_1.Location(file, new vscode_1.Range(pos, pos)));
                                    }
                                }
                            }
                        }
                        catch (error) {
                            console.error(`Error reading file ${file.fsPath}:`, error);
                        }
                    }
                    if (implementations.length > 0) {
                        if (implementations.length === 1) {
                            // If there's only one implementation, navigate directly to it
                            const implementation = implementations[0];
                            yield vscode_1.commands.executeCommand('vscode.open', implementation.uri, { selection: implementation.range });
                        }
                        else {
                            // If there are multiple implementations, show the references view
                            yield vscode_1.commands.executeCommand('editor.action.showReferences', document.uri, target.position, implementations);
                            const disposable = vscode_1.window.onDidChangeActiveTextEditor(() => {
                                vscode_1.commands.executeCommand('closeReferenceSearch');
                                disposable.dispose();
                            });
                        }
                    }
                }
                else {
                    // For Go, use the built-in implementation provider
                    const implementations = yield vscode_1.commands.executeCommand('vscode.executeImplementationProvider', document.uri, target.position);
                    if (implementations && implementations.length > 0) {
                        if (implementations.length === 1) {
                            // If there's only one implementation, navigate directly to it
                            const implementation = implementations[0];
                            yield vscode_1.commands.executeCommand('vscode.open', implementation.uri, { selection: implementation.range });
                        }
                        else {
                            // If there are multiple implementations, show the references view
                            yield vscode_1.commands.executeCommand('editor.action.showReferences', document.uri, target.position, implementations);
                            const disposable = vscode_1.window.onDidChangeActiveTextEditor(() => {
                                vscode_1.commands.executeCommand('closeReferenceSearch');
                                disposable.dispose();
                            });
                        }
                    }
                }
            })),
            vscode_1.commands.registerCommand('extension.goToInterface', (target) => __awaiter(this, void 0, void 0, function* () {
                if (target.interfaceLocation && target.interfaceFile) {
                    yield vscode_1.commands.executeCommand('vscode.open', target.interfaceFile, { selection: new vscode_1.Range(target.interfaceLocation, target.interfaceLocation) });
                }
            }))
        ];
    });
}
exports.registerCommands = registerCommands;
//# sourceMappingURL=commands.js.map