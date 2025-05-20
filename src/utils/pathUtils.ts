import { workspace } from 'vscode';
import * as path from 'path';
import * as minimatch from 'minimatch';

export function isPathAllowed(filePath: string): boolean {
    const config = workspace.getConfiguration('codejump');
    const allowedPaths = config.get<string[]>('allowedPaths', []);
    
    // If no paths are specified, don't allow anything
    if (allowedPaths.length === 0) {
        return false;
    }

    // Convert file path to workspace-relative path
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) {
        return false;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const relativePath = path.relative(workspaceRoot, filePath);

    // Check if the path matches any of the allowed patterns
    return allowedPaths.some(pattern => minimatch(relativePath, pattern));
} 