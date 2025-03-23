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

interface ImplementationTarget {
  position: Position;
  methodName: string;
  interfaceLocation?: Position;
  interfaceFile?: Uri;
}

/**
 * CodeLens Provider for "Go to Implementations"
 */
class GoImplementationCodeLensProvider implements CodeLensProvider {
  // @ts-ignore
  provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
    const codeLenses: CodeLens[] = [];
    const interfaceDefRegex = /^\s*type\s+(\w+)\s+interface\s*{/;
    const interfaceMethodRegex = /^\s*(\w+)\s*\(.*?\)/;

    let inInterfaceBlock = false;
    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber).text;
      
      const defMatch = interfaceDefRegex.exec(line);
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
        const methodMatch = interfaceMethodRegex.exec(line);
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
  async provideCodeLenses(document: TextDocument, token: CancellationToken): Promise<ProviderResult<CodeLens[]>> {
    const codeLenses: CodeLens[] = [];
    const methodWithReceiverRegex = /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/;
    const structDefRegex = /^\s*type\s+(\w+)\s+struct\s*{/;

    const goFiles = await workspace.findFiles("**/*.go");

    // Collect all interfaces and their methods
    const interfaces = await this.collectInterfaces(goFiles);

    for (let i = 0; i < document.lineCount; i++) {
      const lineText = document.lineAt(i).text;

      // Struct detection
      const structMatch = structDefRegex.exec(lineText);
      if (structMatch) {
        codeLenses.push(...(await this.processStruct(document, i, structMatch[1], interfaces, goFiles)));
      }

      // Method detection
      const methodMatch = methodWithReceiverRegex.exec(lineText);
      if (methodMatch) {
        codeLenses.push(...(await this.processMethod(document, i, methodMatch[1], interfaces, goFiles)));
      }
    }
    return codeLenses;
  }

  private async collectInterfaces(goFiles: Uri[]): Promise<Map<string, Set<string>>> {
    const interfaces = new Map<string, Set<string>>();

    for (const file of goFiles) {
      try {
        const doc = await workspace.openTextDocument(file);
        let currentInterface = "";
        let inInterfaceBlock = false;

        for (let i = 0; i < doc.lineCount; i++) {
          const line = doc.lineAt(i).text;
          const match = /^\s*type\s+(\w+)\s+interface\s*{/.exec(line);

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
            const methodMatch = /^\s*(\w+)\s*\(/.exec(line);
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
    goFiles: Uri[]
  ): Promise<CodeLens[]> {
    const structMethods = new Set<string>();
    for (let j = line + 1; j < document.lineCount; j++) {
      const methodMatch = /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/.exec(document.lineAt(j).text);
      if (methodMatch) {
        structMethods.add(methodMatch[1]);
      }
    }

    const matchingInterfaces = [...interfaces.entries()].filter(([_, methods]) =>
      [...methods].every((method) => structMethods.has(method))
    );

    return this.createInterfaceCodeLenses(document, line, structName, matchingInterfaces, goFiles);
  }

  private async processMethod(
    document: TextDocument,
    line: number,
    methodName: string,
    interfaces: Map<string, Set<string>>,
    goFiles: Uri[]
  ): Promise<CodeLens[]> {
    for (const [interfaceName, methods] of interfaces) {
      if (methods.has(methodName)) {
        return this.createInterfaceCodeLenses(document, line, methodName, [[interfaceName, methods]], goFiles);
      }
    }
    return [];
  }

  private async createInterfaceCodeLenses(
    document: TextDocument,
    line: number,
    methodName: string,
    matchingInterfaces: [string, Set<string>][],
    goFiles: Uri[]
  ): Promise<CodeLens[]> {
    const codeLenses: CodeLens[] = [];
    for (const [interfaceName] of matchingInterfaces) {
      // Find the first file containing the interface definition
      for (const file of goFiles) {
        try {
          const doc = await workspace.openTextDocument(file);
          for (let i = 0; i < doc.lineCount; i++) {
            if (doc.lineAt(i).text.includes(`type ${interfaceName} interface`)) {
              const interfacePos = new Position(i, doc.lineAt(i).text.indexOf(interfaceName));
              const methodPos = new Position(line, document.lineAt(line).text.indexOf(methodName));
              codeLenses.push(
                new CodeLens(new Range(methodPos, methodPos), {
                  title: "$(symbol-interface) Interface",
                  command: "extension.goToInterface",
                  arguments: [{ position: methodPos, methodName, interfaceLocation: interfacePos, interfaceFile: file }],
                })
              );
              // Break out of both loops once we find the first occurrence
              break;
            }
          }
          // If we found the interface, break out of the file loop
          if (codeLenses.length > 0) break;
        } catch (error) {
          console.error(`Error reading file ${file.fsPath}:`, error);
        }
      }
    }
    return codeLenses;
  }
}

export function activate(context: ExtensionContext) {
  // @ts-ignore
  context.subscriptions.push(languages.registerCodeLensProvider({ language: "go" }, new GoImplementationCodeLensProvider()));
  // @ts-ignore
  context.subscriptions.push(languages.registerCodeLensProvider({ language: "go" }, new GoInterfaceCodeLensProvider()));

  // Register the commands
  context.subscriptions.push(
    commands.registerCommand('extension.goToImplementation', async (target: ImplementationTarget) => {
      const document = window.activeTextEditor?.document;
      if (!document) return;
      
      const implementations = await commands.executeCommand<Location[]>('vscode.executeImplementationProvider', document.uri, target.position);
      if (implementations && implementations.length > 0) {
        // Show all implementations in the references view
        await commands.executeCommand('editor.action.showReferences', document.uri, target.position, implementations);
        
        // Register a one-time listener for the next navigation event
        const disposable = window.onDidChangeActiveTextEditor(() => {
          // Close the references view
          commands.executeCommand('closeReferenceSearch');
          disposable.dispose();
        });
      }
    })
  );

  context.subscriptions.push(
    commands.registerCommand('extension.goToInterface', async (target: ImplementationTarget) => {
      if (target.interfaceLocation && target.interfaceFile) {
        await commands.executeCommand('vscode.open', target.interfaceFile, { selection: new Range(target.interfaceLocation, target.interfaceLocation) });
      }
    })
  );
}

export function deactivate() {}
