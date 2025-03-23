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
 * First collects interface method names.
 * Then, for each implementation method (with a receiver) whose name is in an interface,
 * adds a CodeLens.
 */
class GoInterfaceCodeLensProvider {
    // @ts-ignore
    provideCodeLenses(document, token) {
        const codeLenses = [];
        const interfaceMethods = new Set();
        const interfaceDefRegex = /^\s*type\s+\w+\s+interface\s*{/;
        const interfaceMethodRegex = /^\s*(\w+)\s*\(.*\)/;
        let inInterfaceBlock = false;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;
            if (interfaceDefRegex.test(text)) {
                inInterfaceBlock = true;
                continue;
            }
            if (inInterfaceBlock) {
                if (/^\s*}\s*$/.test(text)) {
                    inInterfaceBlock = false;
                    continue;
                }
                const match = interfaceMethodRegex.exec(text);
                if (match) {
                    const methodName = match[1];
                    interfaceMethods.add(methodName);
                    console.log(`Collected interface method: ${methodName} (line ${i})`);
                }
            }
        }
        console.log("Interface methods collected:", Array.from(interfaceMethods));
        // Relaxed regex for implementation methods with a receiver.
        // Matches lines like:
        //   func (d *Dog) Speak() string {
        //   func (d Dog) Move(distance int) error {
        const methodWithReceiverRegex = /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;
            const match = methodWithReceiverRegex.exec(text);
            if (match) {
                const methodName = match[1];
                if (interfaceMethods.has(methodName)) {
                    const startIndex = text.indexOf(methodName);
                    const pos = new vscode_1.Position(i, startIndex);
                    codeLenses.push(new vscode_1.CodeLens(new vscode_1.Range(pos, pos), {
                        title: "$(arrow-left) Go to Interface",
                        command: "extension.goToInterface",
                        arguments: [{ position: pos, methodName }]
                    }));
                    console.log(`Added Go to Interface CodeLens for method: ${methodName} at line ${i}`);
                }
            }
        }
        return codeLenses;
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
// Custom command for reverse navigation.
vscode_1.commands.registerCommand("extension.goToInterface", (target) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Executing custom Go to Interface command for method:", target.methodName);
    const editor = vscode_1.window.activeTextEditor;
    if (editor) {
        const docText = editor.document.getText();
        // Use a regex with the 's' flag to search for an interface block containing the method name.
        const regex = new RegExp(`type\\s+(\\w+)\\s+interface\\s*{[^}]*\\b${target.methodName}\\b`, 's');
        const match = regex.exec(docText);
        if (match) {
            const index = match.index;
            const pos = editor.document.positionAt(index);
            editor.selection = new vscode_1.Selection(pos, pos);
            editor.revealRange(new vscode_1.Range(pos, pos));
            console.log(`Found interface block for ${target.methodName} at line ${pos.line}`);
        }
        else {
            console.log(`No interface block found for ${target.methodName}. Falling back.`);
            yield vscode_1.commands.executeCommand("editor.action.goToTypeDefinition");
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
    // @ts-ignore
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