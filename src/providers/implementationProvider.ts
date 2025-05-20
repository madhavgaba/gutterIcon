import {
  CodeLens,
  TextDocument,
  CancellationToken,
  Range,
  Position,
  workspace,
  Uri,
  commands,
  Location,
  Disposable,
  FileSystemWatcher,
} from "vscode";
import type { CodeLensProvider, ProviderResult } from "vscode";
import { LANGUAGE_PATTERNS } from '../patterns/languagePatterns';
import { GoImplementationService } from '../services/go/goImplementationService';
import { isPathAllowed } from '../utils/pathUtils';

interface CacheEntry {
  timestamp: number;
  data: any;
}

export class ImplementationCodeLensProvider implements Disposable {
  private goService: GoImplementationService;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTimeout = 30000; // 30 seconds
  private fileWatcher: FileSystemWatcher | undefined;
  private lastScanTime: number = 0;
  private scanCooldown = 5000; // 5 seconds between full scans

  constructor() {
    this.goService = new GoImplementationService();
    this.setupFileWatcher();
  }

  private setupFileWatcher() {
    // Watch for file changes to invalidate cache
    this.fileWatcher = workspace.createFileSystemWatcher('**/*.{go,java}');
    this.fileWatcher.onDidChange((uri) => {
      if (isPathAllowed(uri.fsPath)) {
        this.invalidateCache();
      }
    });
    this.fileWatcher.onDidCreate((uri) => {
      if (isPathAllowed(uri.fsPath)) {
        this.invalidateCache();
      }
    });
    this.fileWatcher.onDidDelete((uri) => {
      if (isPathAllowed(uri.fsPath)) {
        this.invalidateCache();
      }
    });
  }

  private invalidateCache() {
    this.cache.clear();
  }

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.cacheTimeout) {
      return entry.data as T;
    }
    return undefined;
  }

  private setCache<T>(key: string, data: T) {
    this.cache.set(key, {
      timestamp: Date.now(),
      data
    });
  }

  provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
    if (token.isCancellationRequested) {
      return [];
    }

    // Early return if path is not allowed
    if (!isPathAllowed(document.uri.fsPath)) {
      return [];
    }

    try {
      const language = document.languageId;
      const patterns = LANGUAGE_PATTERNS[language];
      if (!patterns) return [];

      // Check cache first
      const cacheKey = `impl_${document.uri.toString()}`;
      const cached = this.getCached<CodeLens[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // For Java, we need to search for implementations in other files (async)
      if (language === 'java') {
        return this.provideJavaCodeLenses(document, patterns);
      }

      // For Go, use our custom implementation service
      return this.provideGoCodeLenses(document, patterns);
    } catch (error) {
      console.error('Error providing code lenses:', error);
      return [];
    }
  }

  private async provideGoCodeLenses(document: TextDocument, patterns: any): Promise<CodeLens[]> {
    const codeLenses: CodeLens[] = [];
    let inInterfaceBlock = false;

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber).text;
      const defMatch = patterns.interfaceDef.exec(line);
      
      if (defMatch) {
        const interfaceName = defMatch[1];
        const pos = new Position(lineNumber, line.indexOf(interfaceName));
        const implementations = await this.goService.findImplementations(document.uri, pos);
        const codeLens = this.createCodeLens(document, lineNumber, interfaceName, implementations.length, implementations);
        if (codeLens) codeLenses.push(codeLens);
        inInterfaceBlock = true;
        continue;
      }

      if (inInterfaceBlock) {
        if (/^\s*}\s*$/.test(line)) {
          inInterfaceBlock = false;
          continue;
        }
        const methodMatch = patterns.interfaceMethod.exec(line);
        if (methodMatch) {
          const methodName = methodMatch[1];
          const pos = new Position(lineNumber, line.indexOf(methodName));
          const implementations = await this.goService.findImplementations(document.uri, pos);
          const codeLens = this.createCodeLens(document, lineNumber, methodName, implementations.length, implementations);
          if (codeLens) codeLenses.push(codeLens);
        }
      }
    }

    // Cache the results
    this.setCache(`impl_${document.uri.toString()}`, codeLenses);
    return codeLenses;
  }

  private async provideJavaCodeLenses(document: TextDocument, patterns: any): Promise<CodeLens[]> {
    // Check if we need to do a full scan
    const now = Date.now();
    if (now - this.lastScanTime < this.scanCooldown) {
      const cached = this.getCached<CodeLens[]>(`java_impl_${document.uri.toString()}`);
      if (cached) return cached;
    }

    const codeLenses: CodeLens[] = [];
    const filePattern = '**/*.java';
    
    // Only scan allowed paths
    const javaFiles = await workspace.findFiles(filePattern, '**/node_modules/**', 1000);
    const allowedFiles = javaFiles.filter(file => isPathAllowed(file.fsPath));
    
    if (allowedFiles.length === 0) {
      return codeLenses;
    }

    const interfaces = await this.collectJavaInterfaces(allowedFiles, patterns);
    this.setCache('java_interfaces', interfaces);

    let inInterfaceBlock = false;
    let currentInterface = "";

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber).text;
      
      const defMatch = patterns.interfaceDef.exec(line);
      if (defMatch) {
        currentInterface = defMatch[1];
        const implementations = await this.findJavaImplementations(currentInterface, allowedFiles, patterns);
        if (implementations.length > 0) {
          const locations = await this.getImplementationLocations(implementations, patterns);
          const codeLens = this.createCodeLens(document, lineNumber, currentInterface, implementations.length, locations);
          if (codeLens) codeLenses.push(codeLens);
        }
        inInterfaceBlock = true;
        continue;
      }

      if (inInterfaceBlock) {
        if (/^\s*}\s*$/.test(line)) {
          inInterfaceBlock = false;
          currentInterface = "";
          continue;
        }

        const methodMatch = patterns.interfaceMethod.exec(line);
        if (methodMatch) {
          const methodName = methodMatch[1];
          const implementations = await this.findJavaMethodImplementations(methodName, interfaces, allowedFiles, patterns);
          if (implementations.length > 0) {
            const codeLens = this.createCodeLens(document, lineNumber, methodName, implementations.length);
            if (codeLens) codeLenses.push(codeLens);
          }
        }
      }
    }

    this.lastScanTime = now;
    this.setCache(`java_impl_${document.uri.toString()}`, codeLenses);
    return codeLenses;
  }

  private async getImplementationLocations(
    implementations: { uri: Uri, line: number, className: string }[],
    patterns: any
  ): Promise<Location[]> {
    const locations: Location[] = [];
    for (const impl of implementations) {
      if (!isPathAllowed(impl.uri.fsPath)) {
        continue;
      }
      try {
        const data = await workspace.fs.readFile(impl.uri);
        const content = Buffer.from(data).toString('utf8');
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const lineText = lines[i];
          const match = patterns.structDef.exec(lineText);
          if (match && match[1] === impl.className) {
            const pos = new Position(i, lineText.indexOf(impl.className));
            locations.push({ uri: impl.uri, range: new Range(pos, pos) });
            break;
          }
        }
      } catch (error) {
        console.error(`Error reading file ${impl.uri.fsPath}:`, error);
      }
    }
    return locations;
  }

  private async collectJavaInterfaces(javaFiles: Uri[], patterns: any): Promise<Map<string, Set<string>>> {
    const interfaces = new Map<string, Set<string>>();
    
    for (const file of javaFiles) {
      if (!isPathAllowed(file.fsPath)) {
        continue;
      }
      try {
        const doc = await workspace.openTextDocument(file);
        let currentInterface = "";
        let inInterfaceBlock = false;

        for (let i = 0; i < doc.lineCount; i++) {
          const line = doc.lineAt(i).text;
          const match = patterns.interfaceDef.exec(line);

          if (match) {
            currentInterface = match[1];
            interfaces.set(currentInterface, new Set());
            inInterfaceBlock = true;
            continue;
          }

          if (inInterfaceBlock) {
            if (/^\s*}\s*$/.test(line)) {
              inInterfaceBlock = false;
              continue;
            }
            const methodMatch = patterns.interfaceMethod.exec(line);
            if (methodMatch) {
              const methodName = methodMatch[1];
              interfaces.get(currentInterface)?.add(methodName);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading file ${file.fsPath}:`, error);
      }
    }
    return interfaces;
  }

  private async findJavaImplementations(interfaceName: string, javaFiles: Uri[], patterns: any): Promise<{ uri: Uri, line: number, className: string }[]> {
    const implementations: { uri: Uri, line: number, className: string }[] = [];
    for (const file of javaFiles) {
      if (!isPathAllowed(file.fsPath)) {
        continue;
      }
      try {
        const data = await workspace.fs.readFile(file);
        const content = Buffer.from(data).toString('utf8');
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = patterns.structDef.exec(line);
          if (match) {
            const className = match[1];
            const implementsMatch = line.match(/implements\s+([^{]+)/);
            if (implementsMatch) {
              const implementedInterfaces = implementsMatch[1].split(',').map(i => i.trim());
              if (implementedInterfaces.includes(interfaceName)) {
                implementations.push({ uri: file, line: i, className });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error reading file ${file.fsPath}:`, error);
      }
    }
    return implementations;
  }

  private async findJavaMethodImplementations(
    methodName: string,
    interfaces: Map<string, Set<string>>,
    javaFiles: Uri[],
    patterns: any
  ): Promise<Uri[]> {
    const implementations: Uri[] = [];
    
    for (const file of javaFiles) {
      if (!isPathAllowed(file.fsPath)) {
        continue;
      }
      try {
        const doc = await workspace.openTextDocument(file);
        let currentClass = "";
        let inClassBlock = false;
        let implementsInterfaces: string[] = [];

        // First, find if this class implements any interfaces
        for (let i = 0; i < doc.lineCount; i++) {
          const line = doc.lineAt(i).text;
          const match = patterns.structDef.exec(line);
          if (match) {
            currentClass = match[1];
            // Extract interfaces from implements clause
            const implementsMatch = line.match(/implements\s+([^{]+)/);
            if (implementsMatch) {
              implementsInterfaces = implementsMatch[1].split(',').map(i => i.trim());
            }
            inClassBlock = true;
            continue;
          }

          if (inClassBlock) {
            if (/^\s*}\s*$/.test(line)) {
              inClassBlock = false;
              continue;
            }

            // Check if this method matches any interface method
            const methodMatch = patterns.methodWithReceiver.exec(line);
            if (methodMatch && methodMatch[1] === methodName) {
              // Check if any of the implemented interfaces have this method
              for (const interfaceName of implementsInterfaces) {
                const interfaceMethods = interfaces.get(interfaceName);
                if (interfaceMethods?.has(methodName)) {
                  implementations.push(file);
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error reading file ${file.fsPath}:`, error);
      }
    }
    return implementations;
  }

  private createCodeLens(document: TextDocument, line: number, methodName: string, implementationCount: number, implementations?: Location[]): CodeLens | undefined {
    const lineText = document.lineAt(line).text;
    const methodIndex = lineText.indexOf(methodName);
    if (methodIndex === -1) {
      return undefined;
    }
    const pos = new Position(line, methodIndex);
    const args: any = { 
      position: pos, 
      methodName,
      implementations: implementations?.map(impl => ({
        uri: impl.uri,
        range: impl.range
      }))
    };
    return new CodeLens(new Range(pos, pos), {
      title: `$(symbol-method) ${implementationCount} implementation${implementationCount !== 1 ? 's' : ''}`,
      command: "extension.goToImplementation",
      arguments: [args],
    });
  }

  dispose() {
    this.fileWatcher?.dispose();
    this.cache.clear();
  }
} 