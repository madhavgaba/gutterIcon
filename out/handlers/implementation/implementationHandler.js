"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImplementationHandler = void 0;
const vscode_1 = require("vscode");
const goImplementationService_1 = require("../../services/go/goImplementationService");
class ImplementationHandler {
    constructor() {
        this.goService = new goImplementationService_1.GoImplementationService();
    }
    async handleGoToImplementation(target) {
        const document = vscode_1.window.activeTextEditor?.document;
        if (!document)
            return;
        const language = document.languageId;
        let implementations = [];
        if (language === 'go') {
            implementations = await this.goService.findImplementations(document.uri, target.position);
        }
        else {
            // For Java, use the existing implementations from the CodeLens
            if (target.implementations) {
                implementations = target.implementations.map(impl => new vscode_1.Location(impl.uri, impl.range));
            }
        }
        if (implementations && implementations.length > 0) {
            await this.navigateToImplementations(implementations, document.uri, target.position);
        }
    }
    async navigateToImplementations(implementations, documentUri, position) {
        if (implementations.length === 1) {
            // If there's only one implementation, navigate directly to it
            const implementation = implementations[0];
            await vscode_1.commands.executeCommand('vscode.open', implementation.uri, {
                selection: implementation.range
            });
        }
        else {
            // If there are multiple implementations, show the references view
            await vscode_1.commands.executeCommand('editor.action.showReferences', documentUri, position, implementations);
            // Close references view when editor changes
            const disposable = vscode_1.window.onDidChangeActiveTextEditor(() => {
                vscode_1.commands.executeCommand('closeReferenceSearch');
                disposable.dispose();
            });
        }
    }
}
exports.ImplementationHandler = ImplementationHandler;
//# sourceMappingURL=implementationHandler.js.map