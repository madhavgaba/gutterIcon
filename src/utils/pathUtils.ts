import { workspace, ConfigurationChangeEvent } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as minimatch from 'minimatch';

// Cache for compiled patterns and path information
interface PathCache {
    patterns: minimatch.Minimatch[];
    workspaceRoot: string;
    lastModified: number;
    // Cache for directory matches
    directoryCache: Map<string, boolean>;
    // Cache for file matches
    fileCache: Map<string, boolean>;
}

let pathCache: PathCache | null = null;
let lastConfigValue: string[] | null = null;

// Function to compile patterns
function compilePatterns(patterns: string[]): minimatch.Minimatch[] {
    return patterns.map(pattern => new minimatch.Minimatch(pattern));
}

// Function to get current workspace root
function getWorkspaceRoot(): string {
    return workspace.workspaceFolders?.[0]?.uri.fsPath || '';
}

// Function to check if a path exists and is a file
function isFile(path: string): boolean {
    try {
        return fs.statSync(path).isFile();
    } catch {
        return false;
    }
}

// Function to get the parent directory of a path
function getParentDir(path: string): string {
    return path.substring(0, path.lastIndexOf('/'));
}

// Function to check if a directory matches any pattern
function isDirectoryAllowed(dirPath: string, patterns: minimatch.Minimatch[], workspaceRoot: string): boolean {
    const relativePath = path.relative(workspaceRoot, dirPath);
    return patterns.some(pattern => pattern.match(relativePath));
}

// Function to check if any parent directory matches the patterns
function checkParentDirs(filePath: string, patterns: minimatch.Minimatch[], workspaceRoot: string, cache: PathCache): boolean {
    let currentPath = filePath;
    while (currentPath !== workspaceRoot && currentPath !== '') {
        // Check directory cache first
        const cachedResult = cache.directoryCache.get(currentPath);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        const isAllowed = isDirectoryAllowed(currentPath, patterns, workspaceRoot);
        // Cache the result
        cache.directoryCache.set(currentPath, isAllowed);
        
        if (isAllowed) {
            return true;
        }
        currentPath = getParentDir(currentPath);
    }
    return false;
}

// Function to initialize cache
function initializeCache(patterns: minimatch.Minimatch[], workspaceRoot: string): PathCache {
    return {
        patterns,
        workspaceRoot,
        lastModified: Date.now(),
        directoryCache: new Map<string, boolean>(),
        fileCache: new Map<string, boolean>()
    };
}

export function isPathAllowed(filePath: string): boolean {
    // Check file cache first
    if (pathCache?.fileCache.has(filePath)) {
        return pathCache.fileCache.get(filePath)!;
    }

    // Quick check if file exists and is a file
    if (!isFile(filePath)) {
        return false;
    }

    const config = workspace.getConfiguration('codejump');
    const allowedPaths = config.get<string[]>('allowedPaths', []);
    
    // Early return if no paths are specified
    if (!allowedPaths || allowedPaths.length === 0) {
        return true;
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return false;
    }

    // Check if we need to update the cache
    const configChanged = lastConfigValue === null || 
                         JSON.stringify(lastConfigValue) !== JSON.stringify(allowedPaths);
    const workspaceChanged = pathCache?.workspaceRoot !== workspaceRoot;
    
    if (configChanged || workspaceChanged) {
        pathCache = initializeCache(compilePatterns(allowedPaths), workspaceRoot);
        lastConfigValue = allowedPaths;
    }

    // Get relative path
    const relativePath = path.relative(workspaceRoot, filePath);
    if (!relativePath) {
        return false;
    }

    // First check the exact path
    const exactMatch = pathCache!.patterns.some(pattern => pattern.match(relativePath));
    if (exactMatch) {
        pathCache!.fileCache.set(filePath, true);
        return true;
    }

    // If no exact match, check parent directories
    const parentMatch = checkParentDirs(filePath, pathCache!.patterns, workspaceRoot, pathCache!);
    pathCache!.fileCache.set(filePath, parentMatch);
    return parentMatch;
}

// Reset cache when configuration changes
export function resetCache(event: ConfigurationChangeEvent) {
    if (event.affectsConfiguration('codejump.allowedPaths')) {
        pathCache = null;
        lastConfigValue = null;
    }
}

// Function to clear old cache entries (can be called periodically)
export function clearOldCacheEntries(maxAge: number = 5 * 60 * 1000) { // 5 minutes default
    if (pathCache && Date.now() - pathCache.lastModified > maxAge) {
        // Clear file cache but keep directory cache
        pathCache.fileCache.clear();
        pathCache.lastModified = Date.now();
    }
} 