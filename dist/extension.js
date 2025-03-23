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
/*
 * Forward Provider: "Go to Implementations"
 */
class GoImplementationCodeLensProvider {
    // @ts-ignore
    provideCodeLenses(document, token) {
        const codeLenses = [];
        const interfaceDefRegex = /^\s*type\s+(\w+)\s+interface\s*{/;
        const interfaceMethodRegex = /^\s*(\w+)\s*\(.*\)/;
        let inInterfaceBlock = false;
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const line = document.lineAt(lineNumber);
            const lineText = line.text;
            const defMatch = interfaceDefRegex.exec(lineText);
            if (defMatch) {
                const interfaceName = defMatch[1];
                const startIndex = lineText.indexOf(interfaceName);
                const pos = new vscode_1.Position(lineNumber, startIndex);
                codeLenses.push(new vscode_1.CodeLens(new vscode_1.Range(pos, pos), {
                    title: "$(arrow-right) Go to Implementations",
                    command: "extension.goToImplementation",
                    arguments: [{ position: pos, methodName: interfaceName }]
                }));
                inInterfaceBlock = true;
                continue;
            }
            if (inInterfaceBlock) {
                if (/^\s*}\s*$/.test(lineText)) {
                    inInterfaceBlock = false;
                    continue;
                }
                const methodMatch = interfaceMethodRegex.exec(lineText);
                if (methodMatch) {
                    const methodName = methodMatch[1];
                    const startIndex = lineText.indexOf(methodName);
                    const pos = new vscode_1.Position(lineNumber, startIndex);
                    codeLenses.push(new vscode_1.CodeLens(new vscode_1.Range(pos, pos), {
                        title: "$(arrow-right) Go to Implementations",
                        command: "extension.goToImplementation",
                        arguments: [{ position: pos, methodName }]
                    }));
                }
            }
        }
        return codeLenses;
    }
}
/*
 * Reverse Provider: "Go to Interface"
 * For each implementation method (with a receiver) whose method name appears in an interface,
 * we search the document for an interface block that contains that method.
 * If found, we add a reverse CodeLens at the implementation line with the interface location.
 */
class GoInterfaceCodeLensProvider {
    // @ts-ignore
    provideCodeLenses(document, token) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const codeLenses = [];
            // Regex for implementation methods with a receiver.
            // Matches lines like: "func (d *Dog) Speak() string {" or "func (d Dog) Move(distance int) error {"
            const methodWithReceiverRegex = /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/;
            // Regex for struct definitions
            const structDefRegex = /^\s*type\s+(\w+)\s+struct\s*{/;
            // Find all Go files in the workspace
            const goFiles = yield vscode_1.workspace.findFiles('**/*.go');
            // First, collect all interfaces and their methods
            const interfaces = new Map();
            for (const file of goFiles) {
                try {
                    const doc = yield vscode_1.workspace.openTextDocument(file);
                    let currentInterface = '';
                    let inInterfaceBlock = false;
                    for (let i = 0; i < doc.lineCount; i++) {
                        const line = doc.lineAt(i);
                        const text = line.text;
                        const interfaceDefMatch = /^\s*type\s+(\w+)\s+interface\s*{/.exec(text);
                        if (interfaceDefMatch) {
                            currentInterface = interfaceDefMatch[1];
                            inInterfaceBlock = true;
                            interfaces.set(currentInterface, new Map());
                            continue;
                        }
                        if (inInterfaceBlock) {
                            if (/^\s*}\s*$/.test(text)) {
                                inInterfaceBlock = false;
                                continue;
                            }
                            // Store the full method signature
                            const methodMatch = /^\s*(\w+)\s*\((.*?)\)/.exec(text);
                            if (methodMatch) {
                                (_a = interfaces.get(currentInterface)) === null || _a === void 0 ? void 0 : _a.set(methodMatch[1], methodMatch[2]);
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Error reading file ${file.fsPath}:`, error);
                }
            }
            // Now search for struct implementations and method implementations
            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);
                const text = line.text;
                // Check for struct definition
                const structMatch = structDefRegex.exec(text);
                if (structMatch) {
                    const structName = structMatch[1];
                    let structMethods = new Map();
                    let implementedInterfaces = new Set();
                    // Collect all methods of this struct with their signatures
                    for (let j = i + 1; j < document.lineCount; j++) {
                        const methodLine = document.lineAt(j);
                        const methodMatch = /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\((.*?)\)/.exec(methodLine.text);
                        if (methodMatch) {
                            structMethods.set(methodMatch[1], methodMatch[2]);
                        }
                    }
                    // Check if this struct implements any interfaces
                    for (const [interfaceName, interfaceMethods] of interfaces) {
                        // Skip if we've already added a CodeLens for this interface
                        if (implementedInterfaces.has(interfaceName)) {
                            continue;
                        }
                        // Check if all interface methods are implemented with matching signatures
                        const implementsInterface = Array.from(interfaceMethods.entries()).every(([methodName, interfaceSig]) => {
                            const structSig = structMethods.get(methodName);
                            return structSig === interfaceSig;
                        });
                        if (implementsInterface) {
                            // Find the interface file and position
                            for (const file of goFiles) {
                                try {
                                    const doc = yield vscode_1.workspace.openTextDocument(file);
                                    let found = false;
                                    for (let j = 0; j < doc.lineCount; j++) {
                                        const interfaceLine = doc.lineAt(j);
                                        const interfaceMatch = /^\s*type\s+(\w+)\s+interface\s*{/.exec(interfaceLine.text);
                                        if (interfaceMatch && interfaceMatch[1] === interfaceName) {
                                            const startIndex = interfaceLine.text.indexOf(interfaceName);
                                            const interfacePos = new vscode_1.Position(j, startIndex);
                                            const structStartIndex = text.indexOf(structName);
                                            const structPos = new vscode_1.Position(i, structStartIndex);
                                            codeLenses.push(new vscode_1.CodeLens(new vscode_1.Range(structPos, structPos), {
                                                title: `$(arrow-left) Go to Interface (${interfaceName})`,
                                                command: "extension.goToInterface",
                                                arguments: [{
                                                        position: structPos,
                                                        methodName: interfaceName,
                                                        interfaceLocation: interfacePos,
                                                        interfaceFile: file
                                                    }]
                                            }));
                                            implementedInterfaces.add(interfaceName);
                                            found = true;
                                            console.log(`Found interface ${interfaceName} for struct ${structName} in ${file.fsPath}`);
                                            break;
                                        }
                                    }
                                    if (found)
                                        break;
                                }
                                catch (error) {
                                    console.error(`Error reading file ${file.fsPath}:`, error);
                                }
                            }
                        }
                    }
                }
                // Check for method implementation
                const methodMatch = methodWithReceiverRegex.exec(text);
                if (methodMatch) {
                    const methodName = methodMatch[1];
                    let interfaceFound = false;
                    // Search through all Go files for the interface
                    for (const file of goFiles) {
                        try {
                            const doc = yield vscode_1.workspace.openTextDocument(file);
                            const docText = doc.getText();
                            // Search for interface blocks containing this method
                            const interfaceDefRegex = /^\s*type\s+(\w+)\s+interface\s*{/;
                            const interfaceMethodRegex = /^\s*(\w+)\s*\(.*\)/;
                            let inInterfaceBlock = false;
                            let currentInterfaceName = '';
                            for (let j = 0; j < doc.lineCount; j++) {
                                const interfaceLine = doc.lineAt(j);
                                const interfaceText = interfaceLine.text;
                                const defMatch = interfaceDefRegex.exec(interfaceText);
                                if (defMatch) {
                                    currentInterfaceName = defMatch[1];
                                    inInterfaceBlock = true;
                                    continue;
                                }
                                if (inInterfaceBlock) {
                                    if (/^\s*}\s*$/.test(interfaceText)) {
                                        inInterfaceBlock = false;
                                        continue;
                                    }
                                    const methodMatch = interfaceMethodRegex.exec(interfaceText);
                                    if (methodMatch && methodMatch[1] === methodName) {
                                        // Found the interface! Create a CodeLens
                                        const startIndex = interfaceText.indexOf(methodName);
                                        const interfacePos = new vscode_1.Position(j, startIndex);
                                        const implStartIndex = text.indexOf(methodName);
                                        const implPos = new vscode_1.Position(i, implStartIndex);
                                        codeLenses.push(new vscode_1.CodeLens(new vscode_1.Range(implPos, implPos), {
                                            title: `$(arrow-left) Go to Interface (${currentInterfaceName}.${methodName})`,
                                            command: "extension.goToInterface",
                                            arguments: [{
                                                    position: implPos,
                                                    methodName,
                                                    interfaceLocation: interfacePos,
                                                    interfaceFile: file
                                                }]
                                        }));
                                        interfaceFound = true;
                                        console.log(`Found interface ${currentInterfaceName} for ${methodName} in ${file.fsPath}`);
                                        break;
                                    }
                                }
                            }
                            if (interfaceFound)
                                break;
                        }
                        catch (error) {
                            console.error(`Error reading file ${file.fsPath}:`, error);
                        }
                    }
                    if (!interfaceFound) {
                        console.log(`No interface found for ${methodName} at line ${i}`);
                    }
                }
            }
            return codeLenses;
        });
    }
}
// Command for forward navigation.
vscode_1.commands.registerCommand("extension.goToImplementation", (target) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Executing Go to Implementation command at position:", target.position);
    const editor = vscode_1.window.activeTextEditor;
    if (editor) {
        const start = target.position;
        const end = new vscode_1.Position(target.position.line, target.position.character + target.methodName.length);
        editor.selection = new vscode_1.Selection(start, end);
        editor.revealRange(new vscode_1.Range(start, end));
        yield vscode_1.commands.executeCommand("editor.action.goToImplementation");
    }
}));
// Command for reverse navigation.
vscode_1.commands.registerCommand("extension.goToInterface", (target) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Executing Go to Interface command. Navigating to interface at:", target.interfaceLocation);
    if (target.interfaceLocation && target.interfaceFile) {
        try {
            const doc = yield vscode_1.workspace.openTextDocument(target.interfaceFile);
            yield vscode_1.window.showTextDocument(doc);
            const editor = vscode_1.window.activeTextEditor;
            if (editor) {
                const pos = target.interfaceLocation;
                editor.selection = new vscode_1.Selection(pos, pos);
                editor.revealRange(new vscode_1.Range(pos, pos));
                console.log(`Navigated to interface at line ${pos.line} in ${target.interfaceFile.fsPath}`);
            }
        }
        catch (error) {
            console.error("Error navigating to interface:", error);
        }
    }
}));
// Gutter decoration for visual flair.
let gutterDecoration = vscode_1.window.createTextEditorDecorationType({
    // @ts-ignore
    gutterIconPath: vscode_1.Uri.joinPath(vscode_1.window.activeTextEditor ? vscode_1.window.activeTextEditor.document.uri : vscode_1.Uri.parse(""), "dummy"),
    gutterIconSize: "contain"
});
function updateGutterDecorations(editor, context) {
    const ranges = [];
    const interfaceDefRegex = /^\s*type\s+\w+\s+interface\s*{/;
    const interfaceMethodRegex = /^\s*\w+\s*\(.*\)/;
    const methodWithReceiverRegex = /^\s*func\s+\([^)]*\)\s*(\w+)\s*\(.*\)/;
    for (let i = 0; i < editor.document.lineCount; i++) {
        const line = editor.document.lineAt(i);
        if (interfaceDefRegex.test(line.text) ||
            interfaceMethodRegex.test(line.text) ||
            methodWithReceiverRegex.test(line.text)) {
            ranges.push(new vscode_1.Range(new vscode_1.Position(i, 0), new vscode_1.Position(i, 0)));
        }
    }
    editor.setDecorations(gutterDecoration, ranges);
}
function activate(context) {
    console.log("Go Implementation Gutter extension activated.");
    context.subscriptions.push(
    //@ts-ignore
    vscode_1.languages.registerCodeLensProvider({ language: "go" }, new GoImplementationCodeLensProvider()));
    context.subscriptions.push(
    // @ts-ignore
    vscode_1.languages.registerCodeLensProvider({ language: "go" }, new GoInterfaceCodeLensProvider()));
    gutterDecoration = vscode_1.window.createTextEditorDecorationType({
        // @ts-ignore
        gutterIconPath: vscode_1.Uri.joinPath(context.extensionUri, "media", "intellij-go-to-implementation.svg"),
        gutterIconSize: "contain"
    });
    if (vscode_1.window.activeTextEditor) {
        updateGutterDecorations(vscode_1.window.activeTextEditor, context);
    }
    context.subscriptions.push(vscode_1.window.onDidChangeActiveTextEditor(editor => {
        if (editor)
            updateGutterDecorations(editor, context);
    }));
    context.subscriptions.push(vscode_1.window.onDidChangeTextEditorSelection(event => {
        updateGutterDecorations(event.textEditor, context);
    }));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map