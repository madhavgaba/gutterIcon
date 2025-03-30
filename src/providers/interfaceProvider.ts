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

export class InterfaceCodeLensProvider implements CodeLensProvider<CodeLens> {
    // @ts-ignore
  provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
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

    const matchingInterfaces = [...interfaces.entries()].filter(([_, methods]) =>
      [...methods].every((method) => structMethods.has(method))
    );

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
          const doc = await workspace.openTextDocument(file);
          for (let i = 0; i < doc.lineCount; i++) {
            const lineText = doc.lineAt(i).text;
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
      
      codeLenses.push(
        new CodeLens(new Range(methodPos, methodPos), {
          title: `$(symbol-interface) Implements ${interfaceLocations.length} interface${interfaceLocations.length > 1 ? 's' : ''}`,
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
    
    return codeLenses;
  }
} 