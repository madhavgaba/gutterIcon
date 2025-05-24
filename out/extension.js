"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode_1 = require("vscode");
const implementationProvider_1 = require("./providers/implementationProvider");
const interfaceProvider_1 = require("./providers/interfaceProvider");
const commands_1 = require("./utils/commands");
function activate(context) {
    console.log("CodeJump+ extension activated");
    // Always register our custom CodeLens providers for Go and Java.
    // These do NOT rely on gopls or the Go extension, so they work regardless of user Go config.
    context.subscriptions.push(vscode_1.languages.registerCodeLensProvider({ language: 'go' }, new implementationProvider_1.ImplementationCodeLensProvider()));
    context.subscriptions.push(vscode_1.languages.registerCodeLensProvider({ language: 'go' }, new interfaceProvider_1.InterfaceCodeLensProvider()));
    context.subscriptions.push(vscode_1.languages.registerCodeLensProvider({ language: 'java' }, new implementationProvider_1.ImplementationCodeLensProvider()));
    context.subscriptions.push(vscode_1.languages.registerCodeLensProvider({ language: 'java' }, new interfaceProvider_1.InterfaceCodeLensProvider()));
    // Register extension commands
    (0, commands_1.registerCommands)();
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map