import { workspace } from 'vscode';
import * as path from 'path';
import * as minimatch from 'minimatch';

export function isPathAllowed(filePath: string): boolean {
    const config = workspace.getConfiguration('codejump');
    const allowedPaths = config.get<string[]>('allowedPaths', []);
    
    console.log('[CodeJump+] Configuration:', {
        filePath,
        allowedPaths,
        workspaceFolders: workspace.workspaceFolders?.map(f => f.uri.fsPath)
    });
    
    // If no paths are specified, don't allow anything
    if (allowedPaths.length === 0) {
        console.log('[CodeJump+] No paths specified, denying access');
        return false;
    }

    // Convert file path to workspace-relative path
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) {
        console.log('[CodeJump+] No workspace folders found');
        return false;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const relativePath = path.relative(workspaceRoot, filePath);
    console.log('[CodeJump+] Relative path:', relativePath);

    // Check if the path matches any of the allowed patterns
    const isAllowed = allowedPaths.some(pattern => {
        const matches = minimatch(relativePath, pattern);
        console.log(`[CodeJump+] Checking pattern "${pattern}": ${matches}`);
        return matches;
    });

    console.log('[CodeJump+] Final result:', isAllowed);
    return isAllowed;
} 