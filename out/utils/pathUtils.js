"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPathAllowed = void 0;
const vscode_1 = require("vscode");
const path = __importStar(require("path"));
const minimatch = __importStar(require("minimatch"));
function isPathAllowed(filePath) {
    const config = vscode_1.workspace.getConfiguration('codejump');
    const allowedPaths = config.get('allowedPaths', []);
    console.log('[CodeJump+] Configuration:', {
        filePath,
        allowedPaths,
        workspaceFolders: vscode_1.workspace.workspaceFolders?.map(f => f.uri.fsPath)
    });
    if (!allowedPaths || allowedPaths.length === 0) {
        return true;
    }
    const relativePath = path.relative(vscode_1.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);
    return allowedPaths.some(pattern => new minimatch.Minimatch(pattern).match(relativePath));
}
exports.isPathAllowed = isPathAllowed;
//# sourceMappingURL=pathUtils.js.map