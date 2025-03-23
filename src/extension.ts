import {
  CodeLens,
  CodeLensProvider,
  TextDocument,
  CancellationToken,
  Range,
  Position,
  ProviderResult,
  languages,
  commands,
  ExtensionContext,
  Selection,
  window,
  workspace,
  Uri,
  Location,
} from "vscode";
import { ImplementationCodeLensProvider } from './providers/implementationProvider';
import { InterfaceCodeLensProvider } from './providers/interfaceProvider';
import { registerCommands } from './utils/commands';

interface ImplementationTarget {
  position: Position;
  methodName: string;
  interfaceLocation?: Position;
  interfaceFile?: Uri;
}

interface LanguagePatterns {
  interfaceDef: RegExp;
  interfaceMethod: RegExp;
  methodWithReceiver: RegExp;
  structDef: RegExp;
}

const LANGUAGE_PATTERNS: { [key: string]: LanguagePatterns } = {
  go: {
    interfaceDef: /^\s*type\s+(\w+)\s+interface\s*{/,
    interfaceMethod: /^\s*(\w+)\s*\(.*?\)/,
    methodWithReceiver: /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/,
    structDef: /^\s*type\s+(\w+)\s+struct\s*{/,
  },
  java: {
    interfaceDef: /^\s*(?:public\s+)?interface\s+(\w+)\s*{/,
    interfaceMethod: /^\s*(?:public\s+)?(?:abstract\s+)?(?:default\s+)?(?:static\s+)?(?:<[^>]+>\s*)?(\w+)\s*\(/,
    methodWithReceiver: /^\s*(?:public\s+)?(?:private\s+)?(?:protected\s+)?(?:static\s+)?(?:<[^>]+>\s*)?(\w+)\s*\(/,
    structDef: /^\s*(?:public\s+)?class\s+(\w+)\s*{/,
  },
};

/**
 * CodeLens Provider for "Go to Implementations"
 */
class GoImplementationCodeLensProvider implements CodeLensProvider {
  // @ts-ignore
  provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
    const codeLenses: CodeLens[] = [];
    const language = document.languageId;
    const patterns = LANGUAGE_PATTERNS[language];
    
    if (!patterns) return codeLenses;

    let inInterfaceBlock = false;
    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber).text;
      
      const defMatch = patterns.interfaceDef.exec(line);
      if (defMatch) {
        const interfaceName = defMatch[1];
        codeLenses.push(this.createCodeLens(document, lineNumber, interfaceName));
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
          codeLenses.push(this.createCodeLens(document, lineNumber, methodMatch[1]));
        }
      }
    }
    return codeLenses;
  }

  private createCodeLens(document: TextDocument, line: number, methodName: string): CodeLens {
    const pos = new Position(line, document.lineAt(line).text.indexOf(methodName));
    return new CodeLens(new Range(pos, pos), {
      title: "$(symbol-method) Implemented by",
      command: "extension.goToImplementation",
      arguments: [{ position: pos, methodName }],
    });
  }
}

/**
 * CodeLens Provider for "Go to Interface"
 */
class GoInterfaceCodeLensProvider implements CodeLensProvider {
  // @ts-ignore
  provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
    const codeLenses: CodeLens[] = [];
    const language = document.languageId;
    const patterns = LANGUAGE_PATTERNS[language];
    
    if (!patterns) return codeLenses;

    const filePattern = language === 'go' ? '**/*.go' : '**/*.java';
    workspace.findFiles(filePattern).then(goFiles => {
      // Collect all interfaces and their methods
      this.collectInterfaces(goFiles, language).then(interfaces => {
        for (let i = 0; i < document.lineCount; i++) {
          const lineText = document.lineAt(i).text;

          // Struct/Class detection
          const structMatch = patterns.structDef.exec(lineText);
          if (structMatch) {
            this.processStruct(document, i, structMatch[1], interfaces, goFiles, language).then(lenses => {
              codeLenses.push(...lenses);
            });
          }

          // Method detection
          const methodMatch = patterns.methodWithReceiver.exec(lineText);
          if (methodMatch) {
            this.processMethod(document, i, methodMatch[1], interfaces, goFiles, language).then(lenses => {
              codeLenses.push(...lenses);
            });
          }
        }
      });
    });

    return codeLenses;
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
    
    for (const [interfaceName] of matchingInterfaces) {
      // Find the first file containing the interface definition
      for (const file of goFiles) {
        try {
          const doc = await workspace.openTextDocument(file);
          for (let i = 0; i < doc.lineCount; i++) {
            if (doc.lineAt(i).text.match(patterns.interfaceDef)) {
              const interfacePos = new Position(i, doc.lineAt(i).text.indexOf(interfaceName));
              const methodPos = new Position(line, document.lineAt(line).text.indexOf(methodName));
              codeLenses.push(
                new CodeLens(new Range(methodPos, methodPos), {
                  title: "$(symbol-interface) Interface",
                  command: "extension.goToInterface",
                  arguments: [{ position: methodPos, methodName, interfaceLocation: interfacePos, interfaceFile: file }],
                })
              );
              return codeLenses;
            }
          }
        } catch (error) {
          console.error(`Error reading file ${file.fsPath}:`, error);
        }
      }
    }
    return codeLenses;
  }
}

export function activate(context: ExtensionContext) {
  // Register providers for both Go and Java
  const supportedLanguages = ['go', 'java'];
  supportedLanguages.forEach(lang => {
    context.subscriptions.push(
      // @ts-ignore
      languages.registerCodeLensProvider({ language: lang }, new ImplementationCodeLensProvider())
    );
    context.subscriptions.push(
      // @ts-ignore
      languages.registerCodeLensProvider({ language: lang }, new InterfaceCodeLensProvider())
    );
  });

  // Register commands
  registerCommands().then(commands => {
    context.subscriptions.push(...commands);
  });
}

export function deactivate() {}
