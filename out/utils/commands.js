"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = void 0;
const vscode_1 = require("vscode");
const languagePatterns_1 = require("../patterns/languagePatterns");
const pathUtils_1 = require("../utils/pathUtils");
async function registerCommands() {
    return [
        vscode_1.commands.registerCommand('extension.goToImplementation', async (target) => {
            const document = vscode_1.window.activeTextEditor?.document;
            if (!document)
                return;
            // If implementations are provided, use them directly
            if (target.implementations && target.implementations.length > 0) {
                if (target.implementations.length === 1) {
                    const impl = target.implementations[0];
                    await vscode_1.commands.executeCommand('vscode.open', impl.uri, { selection: impl.range });
                }
                else {
                    await vscode_1.commands.executeCommand('editor.action.showReferences', document.uri, target.position, target.implementations.map(i => new vscode_1.Location(i.uri, i.range)));
                    const disposable = vscode_1.window.onDidChangeActiveTextEditor(() => {
                        vscode_1.commands.executeCommand('closeReferenceSearch');
                        disposable.dispose();
                    });
                }
                return;
            }
            const language = document.languageId;
            if (language === 'java') {
                // For Java, use our custom implementation detection
                const filePattern = '**/*.java';
                try {
                    const javaFiles = await vscode_1.workspace.findFiles(filePattern, '**/node_modules/**', 1000);
                    const allowedFiles = javaFiles.filter(file => (0, pathUtils_1.isPathAllowed)(file.fsPath));
                    const implementations = [];
                    for (const file of allowedFiles) {
                        try {
                            const doc = await vscode_1.workspace.openTextDocument(file);
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
                            await vscode_1.commands.executeCommand('vscode.open', implementation.uri, { selection: implementation.range });
                        }
                        else {
                            // If there are multiple implementations, show the references view
                            await vscode_1.commands.executeCommand('editor.action.showReferences', document.uri, target.position, implementations);
                            const disposable = vscode_1.window.onDidChangeActiveTextEditor(() => {
                                vscode_1.commands.executeCommand('closeReferenceSearch');
                                disposable.dispose();
                            });
                        }
                    }
                }
                catch (error) {
                    console.error('Error finding implementations:', error);
                }
            }
            else {
                // For Go, use the built-in implementation provider
                try {
                    const implementations = await vscode_1.commands.executeCommand('vscode.executeImplementationProvider', document.uri, target.position);
                    if (implementations && implementations.length > 0) {
                        if (implementations.length === 1) {
                            // If there's only one implementation, navigate directly to it
                            const implementation = implementations[0];
                            await vscode_1.commands.executeCommand('vscode.open', implementation.uri, { selection: implementation.range });
                        }
                        else {
                            // If there are multiple implementations, show the references view
                            await vscode_1.commands.executeCommand('editor.action.showReferences', document.uri, target.position, implementations);
                            const disposable = vscode_1.window.onDidChangeActiveTextEditor(() => {
                                vscode_1.commands.executeCommand('closeReferenceSearch');
                                disposable.dispose();
                            });
                        }
                    }
                }
                catch (error) {
                    console.error('Error finding implementations:', error);
                }
            }
        }),
        vscode_1.commands.registerCommand('extension.goToInterface', async (target) => {
            if (target.interfaces && target.interfaces.length > 0) {
                if (target.interfaces.length === 1) {
                    // If there's only one interface, navigate directly to it
                    const interfaceInfo = target.interfaces[0];
                    await vscode_1.commands.executeCommand('vscode.open', interfaceInfo.interfaceFile, {
                        selection: new vscode_1.Range(interfaceInfo.interfaceLocation, interfaceInfo.interfaceLocation)
                    });
                }
                else {
                    // Create locations for all interfaces
                    const locations = target.interfaces.map(i => new vscode_1.Location(i.interfaceFile, new vscode_1.Range(i.interfaceLocation, i.interfaceLocation)));
                    // Show references view using the current document and position
                    const document = vscode_1.window.activeTextEditor?.document;
                    if (document) {
                        await vscode_1.commands.executeCommand('editor.action.showReferences', document.uri, target.position, locations);
                        // Close references view when editor changes
                        const disposable = vscode_1.window.onDidChangeActiveTextEditor(() => {
                            vscode_1.commands.executeCommand('closeReferenceSearch');
                            disposable.dispose();
                        });
                    }
                }
            }
            else if (target.interfaceLocation && target.interfaceFile) {
                await vscode_1.commands.executeCommand('vscode.open', target.interfaceFile, {
                    selection: new vscode_1.Range(target.interfaceLocation, target.interfaceLocation)
                });
            }
        })
    ];
}
exports.registerCommands = registerCommands;
//# sourceMappingURL=commands.js.map