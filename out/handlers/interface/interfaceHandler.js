"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterfaceHandler = void 0;
const vscode_1 = require("vscode");
class InterfaceHandler {
    async handleGoToInterface(target) {
        if (target.interfaces && target.interfaces.length > 0) {
            if (target.interfaces.length === 1) {
                // If there's only one interface, navigate directly to it
                const interfaceInfo = target.interfaces[0];
                await vscode_1.commands.executeCommand('vscode.open', interfaceInfo.interfaceFile, {
                    selection: new vscode_1.Range(interfaceInfo.interfaceLocation, interfaceInfo.interfaceLocation)
                });
            }
            else {
                await this.handleMultipleInterfaces(target);
            }
        }
        else if (target.interfaceLocation && target.interfaceFile) {
            await this.handleSingleInterface(target);
        }
    }
    async handleMultipleInterfaces(target) {
        // Create locations for all interfaces
        // @ts-ignore
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
    async handleSingleInterface(target) {
        await vscode_1.commands.executeCommand('vscode.open', target.interfaceFile, {
            // @ts-ignore
            selection: new vscode_1.Range(target.interfaceLocation, target.interfaceLocation)
        });
    }
}
exports.InterfaceHandler = InterfaceHandler;
//# sourceMappingURL=interfaceHandler.js.map