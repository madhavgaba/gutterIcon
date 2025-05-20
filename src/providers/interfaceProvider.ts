import {
  CodeLens,
  CodeLensProvider,
  TextDocument,
  CancellationToken,
  Range,
  Position,
  ProviderResult,
  workspace,
  Uri,
  Disposable,
  FileSystemWatcher,
} from "vscode";
import { LANGUAGE_PATTERNS } from '../patterns/languagePatterns';
import { isPathAllowed } from '../utils/pathUtils';

interface CacheEntry {
  timestamp: number;
  data: any;
}

export class InterfaceCodeLensProvider implements Disposable {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTimeout = 30000; // 30 seconds
  private fileWatcher: FileSystemWatcher | undefined;
  private lastScanTime: number = 0;
  private scanCooldown = 5000; // 5 seconds between full scans

  constructor() {
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

    const codeLenses: CodeLens[] = [];
    const language = document.languageId;
    const patterns = LANGUAGE_PATTERNS[language];
    
    if (!patterns) return codeLenses;

    // Check cache first
    const cacheKey = `interface_${document.uri.toString()}`;
    const cached = this.getCached<CodeLens[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return (async () => {
      // Check if we need to do a full scan
      const now = Date.now();
      if (now - this.lastScanTime < this.scanCooldown) {
        const cached = this.getCached<CodeLens[]>(cacheKey);
        if (cached) return cached;
      }

      const filePattern = language === 'go' ? '**/*.go' : '**/*.java';
      // Only scan allowed paths
      const files = await workspace.findFiles(filePattern, '**/node_modules/**', 1000);
      const allowedFiles = files.filter(file => isPathAllowed(file.fsPath));
      
      if (allowedFiles.length === 0) {
        return codeLenses;
      }

      const interfaces = await this.collectInterfaces(allowedFiles, language);
      this.setCache('interfaces', interfaces);

      for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;

        // Struct/Class detection
        const structMatch = patterns.structDef.exec(lineText);
        if (structMatch) {
          const lenses = await this.processStruct(document, i, structMatch[1], interfaces, allowedFiles, language);
          codeLenses.push(...lenses);
        }

        // Method detection
        const methodMatch = patterns.methodWithReceiver.exec(lineText);
        if (methodMatch) {
          const lenses = await this.processMethod(document, i, methodMatch[1], interfaces, allowedFiles, language);
          codeLenses.push(...lenses);
        }
      }

      this.lastScanTime = now;
      this.setCache(cacheKey, codeLenses);
      return codeLenses;
    })();
  }

  private async collectInterfaces(files: Uri[], language: string): Promise<Map<string, Set<string>>> {
    // Check cache first
    const cacheKey = `interfaces_${language}`;
    const cached = this.getCached<Map<string, Set<string>>>(cacheKey);
    if (cached) {
      return cached;
    }

    const interfaces = new Map<string, Set<string>>();
    const patterns = LANGUAGE_PATTERNS[language];

    for (const file of files) {
      if (!isPathAllowed(file.fsPath)) {
        continue;
      }
      try {
        const data = await workspace.fs.readFile(file);
        const content = Buffer.from(data).toString('utf8');
        const lines = content.split(/\r?\n/);
        let currentInterface = "";
        let inInterfaceBlock = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
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
              interfaces.get(currentInterface)?.add(methodMatch[1]);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading file ${file.fsPath}:`, error);
      }
    }

    this.setCache(cacheKey, interfaces);
    return interfaces;
  }

  private async processStruct(
    document: TextDocument,
    line: number,
    structName: string,
    interfaces: Map<string, Set<string>>,
    files: Uri[],
    language: string
  ): Promise<CodeLens[]> {
    const patterns = LANGUAGE_PATTERNS[language];
    const structMethods = new Set<string>();
    for (let j = line + 1; j < document.lineCount; j++) {
      const methodMatch = patterns.methodWithReceiver.exec(document.lineAt(j).text);
      if (methodMatch) {
        structMethods.add(methodMatch[1]);
      }
    }

    let matchingInterfaces: [string, Set<string>][] = [];
    if (language === 'java') {
      // Parse the implements clause from the class definition line
      const classLine = document.lineAt(line).text;
      const implementsMatch = classLine.match(/implements\s+([^{]+)/);
      let implementedInterfaces: string[] = [];
      if (implementsMatch) {
        implementedInterfaces = implementsMatch[1].split(',').map(i => i.trim());
      }
      // Only consider interfaces explicitly listed in implements
      matchingInterfaces = [...interfaces.entries()].filter(([name, methods]) =>
        implementedInterfaces.includes(name) && [...methods].every((method) => structMethods.has(method))
      );
    } else {
      // Go: implicit interface implementation by method set
      matchingInterfaces = [...interfaces.entries()].filter(([_, methods]) =>
        [...methods].every((method) => structMethods.has(method))
      );
    }

    return this.createInterfaceCodeLenses(document, line, structName, matchingInterfaces, files, language);
  }

  private async processMethod(
    document: TextDocument,
    line: number,
    methodName: string,
    interfaces: Map<string, Set<string>>,
    files: Uri[],
    language: string
  ): Promise<CodeLens[]> {
    for (const [interfaceName, methods] of interfaces) {
      if (methods.has(methodName)) {
        return this.createInterfaceCodeLenses(document, line, methodName, [[interfaceName, methods]], files, language);
      }
    }
    return [];
  }

  private async createInterfaceCodeLenses(
    document: TextDocument,
    line: number,
    methodName: string,
    matchingInterfaces: [string, Set<string>][],
    files: Uri[],
    language: string
  ): Promise<CodeLens[]> {
    const codeLenses: CodeLens[] = [];
    const patterns = LANGUAGE_PATTERNS[language];
    
    const interfaceLocations: { name: string, location: Position, file: Uri }[] = [];
    
    // First collect all interface locations
    for (const [interfaceName] of matchingInterfaces) {
      for (const file of files) {
        if (!isPathAllowed(file.fsPath)) {
          continue;
        }
        try {
          const data = await workspace.fs.readFile(file);
          const content = Buffer.from(data).toString('utf8');
          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i];
            if (lineText.match(patterns.interfaceDef)) {
              const interfaceIndex = lineText.indexOf(interfaceName);
              if (interfaceIndex >= 0) {
                interfaceLocations.push({
                  name: interfaceName,
                  location: new Position(i, interfaceIndex),
                  file: file
                });
                break;
              }
            }
          }
        } catch (error) {
          console.error(`Error reading file ${file.fsPath}:`, error);
        }
      }
    }
    
    // If we found any interfaces, create a single CodeLens
    if (interfaceLocations.length > 0) {
      const methodIndex = document.lineAt(line).text.indexOf(methodName);
      const methodPos = new Position(line, methodIndex);
      
      if (methodIndex === -1) {
        return codeLenses;
      }
      
      if (interfaceLocations.length === 1) {
        // For single interface, pass location and file directly
        const interfaceInfo = interfaceLocations[0];
        codeLenses.push(
          new CodeLens(new Range(methodPos, methodPos), {
            title: "$(symbol-interface) Interface",
            command: "extension.goToInterface",
            arguments: [{ 
              position: methodPos, 
              methodName,
              interfaceLocation: interfaceInfo.location,
              interfaceFile: interfaceInfo.file
            }],
          })
        );
      } else {
        // For multiple interfaces, pass the array
        codeLenses.push(
          new CodeLens(new Range(methodPos, methodPos), {
            title: `$(symbol-interface) Implements ${interfaceLocations.length} interfaces`,
            command: "extension.goToInterface",
            arguments: [{ 
              position: methodPos, 
              methodName, 
              interfaces: interfaceLocations.map(i => ({
                name: i.name,
                interfaceLocation: i.location,
                interfaceFile: i.file
              }))
            }],
          })
        );
      }
    }
    
    return codeLenses;
  }

  dispose() {
    this.fileWatcher?.dispose();
    this.cache.clear();
  }
} 