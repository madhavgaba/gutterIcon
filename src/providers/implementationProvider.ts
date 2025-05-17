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
} from "vscode";
import type { CodeLensProvider, ProviderResult } from "vscode";
import { LANGUAGE_PATTERNS } from '../patterns/languagePatterns';
import { GoImplementationService } from '../services/go/goImplementationService';

export class ImplementationCodeLensProvider {
  private goService: GoImplementationService;

  constructor() {
    this.goService = new GoImplementationService();
  }

  provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
    console.log("[CodeJump+] ImplementationCodeLensProvider called for", document.uri.fsPath);
    try {
      const language = document.languageId;
      const patterns = LANGUAGE_PATTERNS[language];
      if (!patterns) return [];

      // For Java, we need to search for implementations in other files (async)
      if (language === 'java') {
        return this.provideJavaCodeLenses(document, patterns);
      }

      // For Go, use our custom implementation service
      return new Promise<CodeLens[]>(async (resolve) => {
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
        resolve(codeLenses);
      });
    } catch (error) {
      console.error('Error providing code lenses:', error);
      return [];
    }
  }

  private async createGoImplementationCodeLens(document: TextDocument, lineNumber: number, name: string, line: string): Promise<CodeLens | undefined> {
    const pos = new Position(lineNumber, line.indexOf(name));
    try {
      const implementations = await commands.executeCommand<Location[]>('vscode.executeImplementationProvider', document.uri, pos);
      const count = implementations ? implementations.length : 0;
      return this.createCodeLens(document, lineNumber, name, count);
    } catch (error) {
      console.error(`Error getting implementations for ${name}:`, error);
      return this.createCodeLens(document, lineNumber, name, 0);
    }
  }

  private async provideJavaCodeLenses(document: TextDocument, patterns: any): Promise<CodeLens[]> {
    const codeLenses: CodeLens[] = [];
    const filePattern = '**/*.java';
    const javaFiles = await workspace.findFiles(filePattern);
    console.log(`Found ${javaFiles.length} Java files`);
    
    const interfaces = await this.collectJavaInterfaces(javaFiles, patterns);
    console.log('Found interfaces:', Array.from(interfaces.entries()).map(([name, methods]) => `${name}: ${Array.from(methods).join(', ')}`));

    let inInterfaceBlock = false;
    let currentInterface = "";

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber).text;
      
      const defMatch = patterns.interfaceDef.exec(line);
      if (defMatch) {
        currentInterface = defMatch[1];
        console.log(`Found interface definition: ${currentInterface}`);
        const implementations = await this.findJavaImplementations(currentInterface, javaFiles, patterns);
        console.log(`Found ${implementations.length} implementations for interface ${currentInterface}`);
        if (implementations.length > 0) {
          // Use fs.readFile to find the class definition line for each implementation
          const locations = [];
          for (const impl of implementations) {
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
          console.log(`Found interface method: ${methodName}`);
          const implementations = await this.findJavaMethodImplementations(methodName, interfaces, javaFiles, patterns);
          console.log(`Found ${implementations.length} implementations for method ${methodName}`);
          if (implementations.length > 0) {
            const codeLens = this.createCodeLens(document, lineNumber, methodName, implementations.length);
            if (codeLens) codeLenses.push(codeLens);
          }
        }
      }
    }
    return codeLenses;
  }

  private async collectJavaInterfaces(javaFiles: Uri[], patterns: any): Promise<Map<string, Set<string>>> {
    const interfaces = new Map<string, Set<string>>();
    
    for (const file of javaFiles) {
      try {
        const doc = await workspace.openTextDocument(file);
        let currentInterface = "";
        let inInterfaceBlock = false;

        for (let i = 0; i < doc.lineCount; i++) {
          const line = doc.lineAt(i).text;
          const match = patterns.interfaceDef.exec(line);

          if (match) {
            currentInterface = match[1];
            console.log(`Found interface in ${file.fsPath}: ${currentInterface}`);
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
              console.log(`Found interface method in ${currentInterface}: ${methodName}`);
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
            console.log(`Checking class ${currentClass} in ${file.fsPath}`);
            // Extract interfaces from implements clause
            const implementsMatch = line.match(/implements\s+([^{]+)/);
            if (implementsMatch) {
              implementsInterfaces = implementsMatch[1].split(',').map(i => i.trim());
              console.log(`Class ${currentClass} implements: ${implementsInterfaces.join(', ')}`);
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
              console.log(`Found method ${methodName} in class ${currentClass}`);
              // Check if any of the implemented interfaces have this method
              for (const interfaceName of implementsInterfaces) {
                const interfaceMethods = interfaces.get(interfaceName);
                if (interfaceMethods?.has(methodName)) {
                  console.log(`Method ${methodName} in ${currentClass} implements interface ${interfaceName}`);
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
      console.log(`[CodeJump+] Could not find method name "${methodName}" in line: ${lineText}`);
      return undefined;
    }
    const pos = new Position(line, methodIndex);
    console.log(`[CodeJump+] Creating CodeLens for ${methodName} at line ${line}`);
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
} 