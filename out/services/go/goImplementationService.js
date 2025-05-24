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
exports.GoImplementationService = void 0;
const vscode_1 = require("vscode");
const languagePatterns_1 = require("../../patterns/languagePatterns");
const pathUtils_1 = require("../../utils/pathUtils");
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class GoImplementationService {
    async findGoFilesInBazelWorkspace() {
        try {
            // First check if we're in a Bazel workspace
            const workspaceRoot = vscode_1.workspace.workspaceFolders?.[0]?.uri.fsPath;
            console.log('[CodeJump+] Checking Bazel workspace at:', workspaceRoot);
            if (!workspaceRoot) {
                console.log('[CodeJump+] No workspace root found');
                return [];
            }
            // Check if WORKSPACE or WORKSPACE.bazel exists
            const workspaceFile = path.join(workspaceRoot, 'WORKSPACE');
            const workspaceBazelFile = path.join(workspaceRoot, 'WORKSPACE.bazel');
            console.log('[CodeJump+] Checking for WORKSPACE files:', { workspaceFile, workspaceBazelFile });
            if (!fs.existsSync(workspaceFile) && !fs.existsSync(workspaceBazelFile)) {
                console.log('[CodeJump+] No WORKSPACE files found');
                return [];
            }
            console.log('[CodeJump+] Found WORKSPACE file, running Bazel query...');
            // First check if Go rules are configured
            try {
                await new Promise((resolve, reject) => {
                    cp.exec('bazel query @io_bazel_rules_go//go:def.bzl', { cwd: workspaceRoot }, (error) => {
                        if (error) {
                            console.log('[CodeJump+] Go rules not configured in Bazel workspace');
                            reject(error);
                        }
                        else {
                            resolve();
                        }
                    });
                });
            }
            catch (error) {
                console.log('[CodeJump+] Falling back to direct file search due to missing Go rules');
                return [];
            }
            // Use Bazel to query for Go files
            return new Promise((resolve, reject) => {
                const bazelCommand = 'bazel query "kind(source, deps(//...))" --output=build';
                console.log('[CodeJump+] Running Bazel command:', bazelCommand);
                cp.exec(bazelCommand, { cwd: workspaceRoot }, (error, stdout, stderr) => {
                    if (error) {
                        console.error('[CodeJump+] Error running Bazel query:', error);
                        console.error('[CodeJump+] Bazel stderr:', stderr);
                        resolve([]);
                        return;
                    }
                    console.log('[CodeJump+] Bazel query successful, parsing output...');
                    const goFiles = [];
                    const lines = stdout.split('\n');
                    console.log('[CodeJump+] Found', lines.length, 'lines in Bazel output');
                    for (const line of lines) {
                        if (line.includes('.go"')) {
                            const match = line.match(/"([^"]+\.go)"/);
                            if (match) {
                                const filePath = path.join(workspaceRoot, match[1]);
                                console.log('[CodeJump+] Found Go file:', filePath);
                                if ((0, pathUtils_1.isPathAllowed)(filePath)) {
                                    console.log('[CodeJump+] File is allowed by path configuration');
                                    goFiles.push(vscode_1.Uri.file(filePath));
                                }
                                else {
                                    console.log('[CodeJump+] File is not allowed by path configuration');
                                }
                            }
                        }
                    }
                    console.log('[CodeJump+] Found', goFiles.length, 'Go files in Bazel workspace');
                    resolve(goFiles);
                });
            });
        }
        catch (error) {
            console.error('[CodeJump+] Error finding Go files in Bazel workspace:', error);
            return [];
        }
    }
    async findGoFilesInWorkspace() {
        console.log('[CodeJump+] Searching for Go files in workspace...');
        const filePattern = '**/*.go';
        const foundFiles = await vscode_1.workspace.findFiles(filePattern, '**/node_modules/**', 1000);
        const goFiles = foundFiles.filter(file => (0, pathUtils_1.isPathAllowed)(file.fsPath));
        console.log('[CodeJump+] Found', goFiles.length, 'Go files in workspace');
        return goFiles;
    }
    async findImplementations(documentUri, position) {
        console.log('[CodeJump+] Finding implementations for:', documentUri.fsPath, 'at position:', position);
        const implementations = [];
        try {
            // Get the current document to find the interface/method name
            const currentDoc = await vscode_1.workspace.openTextDocument(documentUri);
            const line = currentDoc.lineAt(position.line).text;
            console.log('[CodeJump+] Current line:', line);
            const patterns = languagePatterns_1.LANGUAGE_PATTERNS['go'];
            // Check if we're on an interface definition or method
            const interfaceMatch = patterns.interfaceDef.exec(line);
            const methodMatch = patterns.interfaceMethod.exec(line);
            if (interfaceMatch) {
                const interfaceName = interfaceMatch[1];
                console.log('[CodeJump+] Found interface definition:', interfaceName);
                // Get all methods in the interface
                const interfaceMethods = new Set();
                let inInterfaceBlock = true;
                for (let i = position.line + 1; i < currentDoc.lineCount; i++) {
                    const lineText = currentDoc.lineAt(i).text;
                    if (/^\s*}\s*$/.test(lineText)) {
                        break;
                    }
                    const methodMatch = patterns.interfaceMethod.exec(lineText);
                    if (methodMatch) {
                        interfaceMethods.add(methodMatch[1]);
                        console.log('[CodeJump+] Found interface method:', methodMatch[1]);
                    }
                }
                // Try to find Go files using Bazel first
                console.log('[CodeJump+] Searching for Go files in Bazel workspace...');
                let goFiles = await this.findGoFilesInBazelWorkspace();
                // If no files found through Bazel, fall back to workspace.findFiles
                if (goFiles.length === 0) {
                    console.log('[CodeJump+] No files found through Bazel, falling back to workspace.findFiles');
                    goFiles = await this.findGoFilesInWorkspace();
                }
                for (const file of goFiles) {
                    try {
                        console.log('[CodeJump+] Checking file for implementations:', file.fsPath);
                        const data = await vscode_1.workspace.fs.readFile(file);
                        const content = Buffer.from(data).toString('utf8');
                        const lines = content.split(/\r?\n/);
                        let structMethods = new Set();
                        let currentStruct = '';
                        let structStartLine = -1;
                        for (let i = 0; i < lines.length; i++) {
                            const lineText = lines[i];
                            const structMatch = patterns.structDef.exec(lineText);
                            if (structMatch) {
                                currentStruct = structMatch[1];
                                console.log('[CodeJump+] Found struct:', currentStruct);
                                structMethods = new Set();
                                structStartLine = i;
                                continue;
                            }
                            const methodMatch = patterns.methodWithReceiver.exec(lineText);
                            if (methodMatch && currentStruct) {
                                structMethods.add(methodMatch[1]);
                                console.log('[CodeJump+] Found method in struct:', methodMatch[1]);
                            }
                            // Check if we've found all interface methods
                            if (structMethods.size > 0 && [...interfaceMethods].every(method => structMethods.has(method))) {
                                console.log('[CodeJump+] Found implementation of interface', interfaceName, 'in struct', currentStruct);
                                const pos = new vscode_1.Position(structStartLine, lines[structStartLine].indexOf(currentStruct));
                                implementations.push(new vscode_1.Location(file, new vscode_1.Range(pos, pos)));
                                break;
                            }
                        }
                    }
                    catch (error) {
                        console.error('[CodeJump+] Error reading file', file.fsPath, ':', error);
                    }
                }
            }
            else if (methodMatch) {
                const methodName = methodMatch[1];
                console.log('[CodeJump+] Found method:', methodName);
                // Try to find Go files using Bazel first
                console.log('[CodeJump+] Searching for Go files in Bazel workspace...');
                let goFiles = await this.findGoFilesInBazelWorkspace();
                // If no files found through Bazel, fall back to workspace.findFiles
                if (goFiles.length === 0) {
                    console.log('[CodeJump+] No files found through Bazel, falling back to workspace.findFiles');
                    goFiles = await this.findGoFilesInWorkspace();
                }
                for (const file of goFiles) {
                    try {
                        console.log('[CodeJump+] Checking file for method implementations:', file.fsPath);
                        const data = await vscode_1.workspace.fs.readFile(file);
                        const content = Buffer.from(data).toString('utf8');
                        const lines = content.split(/\r?\n/);
                        for (let i = 0; i < lines.length; i++) {
                            const lineText = lines[i];
                            const methodMatch = patterns.methodWithReceiver.exec(lineText);
                            if (methodMatch && methodMatch[1] === methodName) {
                                console.log('[CodeJump+] Found implementation of method', methodName, 'in file', file.fsPath);
                                const pos = new vscode_1.Position(i, lineText.indexOf(methodName));
                                implementations.push(new vscode_1.Location(file, new vscode_1.Range(pos, pos)));
                            }
                        }
                    }
                    catch (error) {
                        console.error('[CodeJump+] Error reading file', file.fsPath, ':', error);
                    }
                }
            }
        }
        catch (error) {
            console.error('[CodeJump+] Error finding implementations:', error);
        }
        console.log('[CodeJump+] Found', implementations.length, 'implementations');
        return implementations;
    }
}
exports.GoImplementationService = GoImplementationService;
//# sourceMappingURL=goImplementationService.js.map