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
const vscode = require("vscode");
class GoImplementationCodeLensProvider {
    // @ts-ignore
    provideCodeLenses(document, token) {
        const codeLenses = [];
        // Regex to match Go function declarations (standalone functions or methods)
        const functionRegex = /^\s*func\s+(?:\([^)]*\)\s*)?(\w+)/gm;
        const text = document.getText();
        let match;
        while ((match = functionRegex.exec(text)) !== null) {
            const line = document.positionAt(match.index).line;
            const range = new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 0));
            codeLenses.push(new vscode.CodeLens(range, {
                title: "Go to Implementation",
                command: "extension.goToImplementation"
            }));
        }
        return codeLenses;
    }
}
function activate(context) {
    console.log("Go Implementation Gutter extension activated.");
    // Register the CodeLens provider for Go files.
    context.subscriptions.push(
    // @ts-ignore
    vscode.languages.registerCodeLensProvider({ language: "go" }, new GoImplementationCodeLensProvider()));
    // Register the command that gets executed when a CodeLens is clicked.
    context.subscriptions.push(vscode.commands.registerCommand("extension.goToImplementation", () => __awaiter(this, void 0, void 0, function* () {
        console.log("Executing Go to Implementation command");
        // Trigger the built-in "Go to Implementation" command.
        yield vscode.commands.executeCommand("editor.action.goToImplementation");
    })));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map