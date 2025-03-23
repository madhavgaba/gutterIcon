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
  TextEditor,
  Uri,
  workspace
} from "vscode";

interface ImplementationTarget {
  position: Position;
  methodName: string;
  interfaceLocation?: Position;
  interfaceFile?: Uri;
}

/* 
 * Forward Provider: "Go to Implementations"
 */
class GoImplementationCodeLensProvider implements CodeLensProvider<CodeLens> {
  // @ts-ignore
  provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
    const codeLenses: CodeLens[] = [];
    const interfaceDefRegex = /^\s*type\s+(\w+)\s+interface\s*{/;
    const interfaceMethodRegex = /^\s*(\w+)\s*\(.*\)/;
    let inInterfaceBlock = false;
    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber);
      const lineText = line.text;
      const defMatch = interfaceDefRegex.exec(lineText);
      if (defMatch) {
        const interfaceName = defMatch[1];
        const startIndex = lineText.indexOf(interfaceName);
        const pos = new Position(lineNumber, startIndex);
        codeLenses.push(new CodeLens(new Range(pos, pos), {
          title: "$(arrow-right) Go to Implementations",
          command: "extension.goToImplementation",
          arguments: [{ position: pos, methodName: interfaceName }]
        }));
        inInterfaceBlock = true;
        continue;
      }
      if (inInterfaceBlock) {
        if (/^\s*}\s*$/.test(lineText)) {
          inInterfaceBlock = false;
          continue;
        }
        const methodMatch = interfaceMethodRegex.exec(lineText);
        if (methodMatch) {
          const methodName = methodMatch[1];
          const startIndex = lineText.indexOf(methodName);
          const pos = new Position(lineNumber, startIndex);
          codeLenses.push(new CodeLens(new Range(pos, pos), {
            title: "$(arrow-right) Go to Implementations",
            command: "extension.goToImplementation",
            arguments: [{ position: pos, methodName }]
          }));
        }
      }
    }
    return codeLenses;
  }
}

/* 
 * Reverse Provider: "Go to Interface"
 * For each implementation method (with a receiver) whose method name appears in an interface,
 * we search the document for an interface block that contains that method.
 * If found, we add a reverse CodeLens at the implementation line with the interface location.
 */
class GoInterfaceCodeLensProvider implements CodeLensProvider<CodeLens> {
  // @ts-ignore
  async provideCodeLenses(document: TextDocument, token: CancellationToken): Promise<ProviderResult<CodeLens[]>> {
    const codeLenses: CodeLens[] = [];
    // Regex for implementation methods with a receiver.
    // Matches lines like: "func (d *Dog) Speak() string {" or "func (d Dog) Move(distance int) error {"
    const methodWithReceiverRegex = /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/;
    // Regex for struct definitions
    const structDefRegex = /^\s*type\s+(\w+)\s+struct\s*{/;
    
    // Find all Go files in the workspace
    const goFiles = await workspace.findFiles('**/*.go');
    
    // First, collect all interfaces and their methods
    const interfaces = new Map<string, Map<string, string>>();
    for (const file of goFiles) {
      try {
        const doc = await workspace.openTextDocument(file);
        let currentInterface = '';
        let inInterfaceBlock = false;
        
        for (let i = 0; i < doc.lineCount; i++) {
          const line = doc.lineAt(i);
          const text = line.text;
          
          const interfaceDefMatch = /^\s*type\s+(\w+)\s+interface\s*{/.exec(text);
          if (interfaceDefMatch) {
            currentInterface = interfaceDefMatch[1];
            inInterfaceBlock = true;
            interfaces.set(currentInterface, new Map());
            continue;
          }
          
          if (inInterfaceBlock) {
            if (/^\s*}\s*$/.test(text)) {
              inInterfaceBlock = false;
              continue;
            }
            
            // Store the full method signature
            const methodMatch = /^\s*(\w+)\s*\((.*?)\)/.exec(text);
            if (methodMatch) {
              interfaces.get(currentInterface)?.set(methodMatch[1], methodMatch[2]);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading file ${file.fsPath}:`, error);
      }
    }
    
    // Now search for struct implementations and method implementations
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text;
      
      // Check for struct definition
      const structMatch = structDefRegex.exec(text);
      if (structMatch) {
        const structName = structMatch[1];
        let structMethods = new Map<string, string>();
        let implementedInterfaces = new Set<string>();
        
        // Collect all methods of this struct with their signatures
        for (let j = i + 1; j < document.lineCount; j++) {
          const methodLine = document.lineAt(j);
          const methodMatch = /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\((.*?)\)/.exec(methodLine.text);
          if (methodMatch) {
            structMethods.set(methodMatch[1], methodMatch[2]);
          }
        }
        
        // Check if this struct implements any interfaces
        for (const [interfaceName, interfaceMethods] of interfaces) {
          // Skip if we've already added a CodeLens for this interface
          if (implementedInterfaces.has(interfaceName)) {
            continue;
          }
          
          // Check if all interface methods are implemented with matching signatures
          const implementsInterface = Array.from(interfaceMethods.entries()).every(([methodName, interfaceSig]) => {
            const structSig = structMethods.get(methodName);
            return structSig === interfaceSig;
          });
          
          if (implementsInterface) {
            // Find the interface file and position
            for (const file of goFiles) {
              try {
                const doc = await workspace.openTextDocument(file);
                let found = false;
                
                for (let j = 0; j < doc.lineCount; j++) {
                  const interfaceLine = doc.lineAt(j);
                  const interfaceMatch = /^\s*type\s+(\w+)\s+interface\s*{/.exec(interfaceLine.text);
                  if (interfaceMatch && interfaceMatch[1] === interfaceName) {
                    const startIndex = interfaceLine.text.indexOf(interfaceName);
                    const interfacePos = new Position(j, startIndex);
                    const structStartIndex = text.indexOf(structName);
                    const structPos = new Position(i, structStartIndex);
                    
                    codeLenses.push(new CodeLens(new Range(structPos, structPos), {
                      title: `$(arrow-left) Go to Interface (${interfaceName})`,
                      command: "extension.goToInterface",
                      arguments: [{
                        position: structPos,
                        methodName: interfaceName,
                        interfaceLocation: interfacePos,
                        interfaceFile: file
                      }]
                    }));
                    
                    implementedInterfaces.add(interfaceName);
                    found = true;
                    console.log(`Found interface ${interfaceName} for struct ${structName} in ${file.fsPath}`);
                    break;
                  }
                }
                
                if (found) break;
              } catch (error) {
                console.error(`Error reading file ${file.fsPath}:`, error);
              }
            }
          }
        }
      }
      
      // Check for method implementation
      const methodMatch = methodWithReceiverRegex.exec(text);
      if (methodMatch) {
        const methodName = methodMatch[1];
        let interfaceFound = false;
        
        // Search through all Go files for the interface
        for (const file of goFiles) {
          try {
            const doc = await workspace.openTextDocument(file);
            const docText = doc.getText();
            
            // Search for interface blocks containing this method
            const interfaceDefRegex = /^\s*type\s+(\w+)\s+interface\s*{/;
            const interfaceMethodRegex = /^\s*(\w+)\s*\(.*\)/;
            let inInterfaceBlock = false;
            let currentInterfaceName = '';
            
            for (let j = 0; j < doc.lineCount; j++) {
              const interfaceLine = doc.lineAt(j);
              const interfaceText = interfaceLine.text;
              
              const defMatch = interfaceDefRegex.exec(interfaceText);
              if (defMatch) {
                currentInterfaceName = defMatch[1];
                inInterfaceBlock = true;
                continue;
              }
              
              if (inInterfaceBlock) {
                if (/^\s*}\s*$/.test(interfaceText)) {
                  inInterfaceBlock = false;
                  continue;
                }
                
                const methodMatch = interfaceMethodRegex.exec(interfaceText);
                if (methodMatch && methodMatch[1] === methodName) {
                  // Found the interface! Create a CodeLens
                  const startIndex = interfaceText.indexOf(methodName);
                  const interfacePos = new Position(j, startIndex);
                  const implStartIndex = text.indexOf(methodName);
                  const implPos = new Position(i, implStartIndex);
                  
                  codeLenses.push(new CodeLens(new Range(implPos, implPos), {
                    title: `$(arrow-left) Go to Interface (${currentInterfaceName}.${methodName})`,
                    command: "extension.goToInterface",
                    arguments: [{
                      position: implPos,
                      methodName,
                      interfaceLocation: interfacePos,
                      interfaceFile: file
                    }]
                  }));
                  
                  interfaceFound = true;
                  console.log(`Found interface ${currentInterfaceName} for ${methodName} in ${file.fsPath}`);
                  break;
                }
              }
            }
            
            if (interfaceFound) break;
          } catch (error) {
            console.error(`Error reading file ${file.fsPath}:`, error);
          }
        }
        
        if (!interfaceFound) {
          console.log(`No interface found for ${methodName} at line ${i}`);
        }
      }
    }
    return codeLenses;
  }
}

// Command for forward navigation.
commands.registerCommand("extension.goToImplementation", async (target: ImplementationTarget) => {
  console.log("Executing Go to Implementation command at position:", target.position);
  const editor = window.activeTextEditor;
  if (editor) {
    const start = target.position;
    const end = new Position(target.position.line, target.position.character + target.methodName.length);
    editor.selection = new Selection(start, end);
    editor.revealRange(new Range(start, end));
    await commands.executeCommand("editor.action.goToImplementation");
  }
});

// Command for reverse navigation.
commands.registerCommand("extension.goToInterface", async (target: ImplementationTarget) => {
  console.log("Executing Go to Interface command. Navigating to interface at:", target.interfaceLocation);
  if (target.interfaceLocation && target.interfaceFile) {
    try {
      const doc = await workspace.openTextDocument(target.interfaceFile);
      await window.showTextDocument(doc);
      const editor = window.activeTextEditor;
      if (editor) {
        const pos = target.interfaceLocation;
        editor.selection = new Selection(pos, pos);
        editor.revealRange(new Range(pos, pos));
        console.log(`Navigated to interface at line ${pos.line} in ${target.interfaceFile.fsPath}`);
      }
    } catch (error) {
      console.error("Error navigating to interface:", error);
    }
  }
});

// Gutter decoration for visual flair.
let gutterDecoration = window.createTextEditorDecorationType({
  // @ts-ignore
  gutterIconPath: Uri.joinPath(window.activeTextEditor ? window.activeTextEditor.document.uri : Uri.parse(""), "dummy"),
  gutterIconSize: "contain"
});

function updateGutterDecorations(editor: TextEditor, context: ExtensionContext) {
  const ranges: Range[] = [];
  const interfaceDefRegex = /^\s*type\s+\w+\s+interface\s*{/;
  const interfaceMethodRegex = /^\s*\w+\s*\(.*\)/;
  const methodWithReceiverRegex = /^\s*func\s+\([^)]*\)\s*(\w+)\s*\(.*\)/;
  for (let i = 0; i < editor.document.lineCount; i++) {
    const line = editor.document.lineAt(i);
    if (interfaceDefRegex.test(line.text) ||
        interfaceMethodRegex.test(line.text) ||
        methodWithReceiverRegex.test(line.text)) {
      ranges.push(new Range(new Position(i, 0), new Position(i, 0)));
    }
  }
  editor.setDecorations(gutterDecoration, ranges);
}

export function activate(context: ExtensionContext) {
  console.log("Go Implementation Gutter extension activated.");
  context.subscriptions.push(
    //@ts-ignore
    languages.registerCodeLensProvider({ language: "go" }, new GoImplementationCodeLensProvider())
  );
  context.subscriptions.push(
    // @ts-ignore
    languages.registerCodeLensProvider({ language: "go" }, new GoInterfaceCodeLensProvider())
  );
  gutterDecoration = window.createTextEditorDecorationType({
    // @ts-ignore
    gutterIconPath: Uri.joinPath(context.extensionUri, "media", "intellij-go-to-implementation.svg"),
    gutterIconSize: "contain"
  });
  if (window.activeTextEditor) {
    updateGutterDecorations(window.activeTextEditor, context);
  }
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(editor => {
      if (editor) updateGutterDecorations(editor, context);
    })
  );
  context.subscriptions.push(
    window.onDidChangeTextEditorSelection(event => {
      updateGutterDecorations(event.textEditor, context);
    })
  );
}

export function deactivate() {}
