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
} from "vscode";
import { LANGUAGE_PATTERNS } from '../patterns/languagePatterns';
import { isPathAllowed } from '../utils/pathUtils';

export class InterfaceCodeLensProvider {
    // @ts-ignore
  provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
    console.log("[CodeJump+] InterfaceCodeLensProvider called for", document.uri.fsPath);
    
    // Check if the file path is allowed
    if (!isPathAllowed(document.uri.fsPath)) {
      console.log("[CodeJump+] File path not allowed:", document.uri.fsPath);
      return [];
    }

    const codeLenses: CodeLens[] = [];
    const language = document.languageId;
    const patterns = LANGUAGE_PATTERNS[language];
    
    if (!patterns) return codeLenses;

    return (async () => {
      const filePattern = language === 'go' ? '**/*.go' : '**/*.java';
      const goFiles = await workspace.findFiles(filePattern);
      const interfaces = await this.collectInterfaces(goFiles, language);

      for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;

        // Struct/Class detection
        const structMatch = patterns.structDef.exec(lineText);
        if (structMatch) {
          const lenses = await this.processStruct(document, i, structMatch[1], interfaces, goFiles, language);
          codeLenses.push(...lenses);
        }

        // Method detection
        const methodMatch = patterns.methodWithReceiver.exec(lineText);
        if (methodMatch) {
          const lenses = await this.processMethod(document, i, methodMatch[1], interfaces, goFiles, language);
          codeLenses.push(...lenses);
        }
      }

      return codeLenses;
    })();
  }

  private async collectInterfaces(goFiles: Uri[], language: string): Promise<Map<string, Set<string>>> {
    const interfaces = new Map<string, Set<string>>();
    const patterns = LANGUAGE_PATTERNS[language];

    for (const file of goFiles) {
      try {
        // Use fs.readFile for efficiency
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
    return interfaces;
  }

  private async processStruct(
    document: TextDocument,
    line: number,
    structName: string,
    interfaces: Map<string, Set<string>>,
    goFiles: Uri[],
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

    return this.createInterfaceCodeLenses(document, line, structName, matchingInterfaces, goFiles, language);
  }

  private async processMethod(
    document: TextDocument,
    line: number,
    methodName: string,
    interfaces: Map<string, Set<string>>,
    goFiles: Uri[],
    language: string
  ): Promise<CodeLens[]> {
    for (const [interfaceName, methods] of interfaces) {
      if (methods.has(methodName)) {
        return this.createInterfaceCodeLenses(document, line, methodName, [[interfaceName, methods]], goFiles, language);
      }
    }
    return [];
  }

  private async createInterfaceCodeLenses(
    document: TextDocument,
    line: number,
    methodName: string,
    matchingInterfaces: [string, Set<string>][],
    goFiles: Uri[],
    language: string
  ): Promise<CodeLens[]> {
    const codeLenses: CodeLens[] = [];
    const patterns = LANGUAGE_PATTERNS[language];
    
    const interfaceLocations: { name: string, location: Position, file: Uri }[] = [];
    
    // First collect all interface locations
    for (const [interfaceName] of matchingInterfaces) {
      for (const file of goFiles) {
        try {
          // Use fs.readFile for efficiency
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
        console.log(`[CodeJump+] Could not find method name "${methodName}" in line: ${document.lineAt(line).text}`);
        return codeLenses;
      }
      console.log(`[CodeJump+] Creating CodeLens for ${methodName} at line ${line}`);
      
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
} 