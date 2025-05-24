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
exports.JavaImplementationService = void 0;
const vscode_1 = require("vscode");
const languagePatterns_1 = require("../../patterns/languagePatterns");
const pathUtils_1 = require("../../utils/pathUtils");
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class JavaImplementationService {
    async findJavaFilesInBazelWorkspace() {
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
            // Use Bazel to query for Java files
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
                    const javaFiles = [];
                    const lines = stdout.split('\n');
                    console.log('[CodeJump+] Found', lines.length, 'lines in Bazel output');
                    for (const line of lines) {
                        if (line.includes('.java"')) {
                            const match = line.match(/"([^"]+\.java)"/);
                            if (match) {
                                const filePath = path.join(workspaceRoot, match[1]);
                                console.log('[CodeJump+] Found Java file:', filePath);
                                if ((0, pathUtils_1.isPathAllowed)(filePath)) {
                                    console.log('[CodeJump+] File is allowed by path configuration');
                                    javaFiles.push(vscode_1.Uri.file(filePath));
                                }
                                else {
                                    console.log('[CodeJump+] File is not allowed by path configuration');
                                }
                            }
                        }
                    }
                    console.log('[CodeJump+] Found', javaFiles.length, 'Java files in Bazel workspace');
                    resolve(javaFiles);
                });
            });
        }
        catch (error) {
            console.error('[CodeJump+] Error finding Java files in Bazel workspace:', error);
            return [];
        }
    }
    async findImplementations(target) {
        console.log('[CodeJump+] Finding implementations for method:', target.methodName);
        const implementations = [];
        try {
            // Try to find Java files using Bazel first
            console.log('[CodeJump+] Searching for Java files in Bazel workspace...');
            let javaFiles = await this.findJavaFilesInBazelWorkspace();
            // If no files found through Bazel, fall back to workspace.findFiles
            if (javaFiles.length === 0) {
                console.log('[CodeJump+] No files found through Bazel, falling back to workspace.findFiles');
                const filePattern = '**/*.java';
                const foundFiles = await vscode_1.workspace.findFiles(filePattern, '**/node_modules/**', 1000);
                javaFiles = foundFiles.filter(file => (0, pathUtils_1.isPathAllowed)(file.fsPath));
                console.log('[CodeJump+] Found', javaFiles.length, 'files through workspace.findFiles');
            }
            for (const file of javaFiles) {
                try {
                    console.log('[CodeJump+] Checking file for implementations:', file.fsPath);
                    const doc = await vscode_1.workspace.openTextDocument(file);
                    let currentClass = "";
                    let inClassBlock = false;
                    for (let i = 0; i < doc.lineCount; i++) {
                        const line = doc.lineAt(i).text;
                        const match = languagePatterns_1.LANGUAGE_PATTERNS.java.structDef.exec(line);
                        if (match) {
                            currentClass = match[1];
                            console.log('[CodeJump+] Found class:', currentClass);
                            if (line.includes(`implements ${target.methodName}`)) {
                                console.log('[CodeJump+] Class implements interface:', target.methodName);
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
                                console.log('[CodeJump+] Found implementation of method', target.methodName, 'in class', currentClass);
                                const pos = new vscode_1.Position(i, line.indexOf(target.methodName));
                                implementations.push(new vscode_1.Location(file, new vscode_1.Range(pos, pos)));
                            }
                        }
                    }
                }
                catch (error) {
                    console.error('[CodeJump+] Error reading file', file.fsPath, ':', error);
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
exports.JavaImplementationService = JavaImplementationService;
//# sourceMappingURL=javaImplementationService.js.map