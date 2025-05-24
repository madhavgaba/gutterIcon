import { workspace, ConfigurationChangeEvent } from 'vscode';
import * as path from 'path';
import * as minimatch from 'minimatch';

// Cache for compiled patterns
let compiledPatterns: minimatch.Minimatch[] | null = null;
let lastConfigValue: string[] | null = null;

// Function to compile patterns
function compilePatterns(patterns: string[]): minimatch.Minimatch[] {
    return patterns.map(pattern => new minimatch.Minimatch(pattern));
}

// Function to get current workspace root
function getWorkspaceRoot(): string {
    return workspace.workspaceFolders?.[0]?.uri.fsPath || '';
}

export function isPathAllowed(filePath: string): boolean {
    const config = workspace.getConfiguration('codejump');
    const allowedPaths = config.get<string[]>('allowedPaths', []);
    
    console.log('[CodeJump+] Configuration:', {
        filePath,
        allowedPaths,
        workspaceFolders: workspace.workspaceFolders?.map(f => f.uri.fsPath)
    });
    
    // Early return if no paths are specified
    if (!allowedPaths || allowedPaths.length === 0) {
        return true;
    }

    // Check if config has changed
    if (lastConfigValue === null || JSON.stringify(lastConfigValue) !== JSON.stringify(allowedPaths)) {
        compiledPatterns = compilePatterns(allowedPaths);
        lastConfigValue = allowedPaths;
    }

    // Get relative path
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return false; // No workspace root, don't process
    }

    const relativePath = path.relative(workspaceRoot, filePath);
    if (!relativePath) {
        return false; // Path is not in workspace
    }

    // Check against compiled patterns
    return compiledPatterns!.some(pattern => pattern.match(relativePath));
}

// Reset cache when configuration changes
export function resetCache(event: ConfigurationChangeEvent) {
    if (event.affectsConfiguration('codejump.allowedPaths')) {
        compiledPatterns = null;
        lastConfigValue = null;
    }
} 