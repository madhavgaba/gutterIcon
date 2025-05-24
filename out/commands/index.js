"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = void 0;
const vscode_1 = require("vscode");
const implementationHandler_1 = require("../handlers/implementation/implementationHandler");
const interfaceHandler_1 = require("../handlers/interface/interfaceHandler");
async function registerCommands() {
    const implementationHandler = new implementationHandler_1.ImplementationHandler();
    const interfaceHandler = new interfaceHandler_1.InterfaceHandler();
    return [
        vscode_1.commands.registerCommand('extension.goToImplementation', implementationHandler.handleGoToImplementation.bind(implementationHandler)),
        vscode_1.commands.registerCommand('extension.goToInterface', interfaceHandler.handleGoToInterface.bind(interfaceHandler))
    ];
}
exports.registerCommands = registerCommands;
//# sourceMappingURL=index.js.map