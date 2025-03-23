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
  Uri
} from "vscode";

interface ImplementationTarget {
  position: Position;
  methodName: string;
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
 * First collects interface method names.
 * Then, for each implementation method (with a receiver) whose name is in an interface,
 * adds a CodeLens.
 */
class GoInterfaceCodeLensProvider implements CodeLensProvider<CodeLens> {
  // @ts-ignore
  provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
    const codeLenses: CodeLens[] = [];
    const interfaceMethods = new Set<string>();

    const interfaceDefRegex = /^\s*type\s+\w+\s+interface\s*{/;
    const interfaceMethodRegex = /^\s*(\w+)\s*\(.*\)/;
    let inInterfaceBlock = false;
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text;
      if (interfaceDefRegex.test(text)) {
        inInterfaceBlock = true;
        continue;
      }
      if (inInterfaceBlock) {
        if (/^\s*}\s*$/.test(text)) {
          inInterfaceBlock = false;
          continue;
        }
        const match = interfaceMethodRegex.exec(text);
        if (match) {
          const methodName = match[1];
          interfaceMethods.add(methodName);
          console.log(`Collected interface method: ${methodName} (line ${i})`);
        }
      }
    }
    console.log("Interface methods collected:", Array.from(interfaceMethods));

    // Relaxed regex for implementation methods with a receiver.
    // Matches lines like:
    //   func (d *Dog) Speak() string {
    //   func (d Dog) Move(distance int) error {
    const methodWithReceiverRegex = /^\s*func\s+\(\s*[\w\*\s]+\)\s+(\w+)\s*\(/;
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text;
      const match = methodWithReceiverRegex.exec(text);
      if (match) {
        const methodName = match[1];
        if (interfaceMethods.has(methodName)) {
          const startIndex = text.indexOf(methodName);
          const pos = new Position(i, startIndex);
          codeLenses.push(new CodeLens(new Range(pos, pos), {
            title: "$(arrow-left) Go to Interface",
            command: "extension.goToInterface",
            arguments: [{ position: pos, methodName }]
          }));
          console.log(`Added Go to Interface CodeLens for method: ${methodName} at line ${i}`);
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

// Custom command for reverse navigation.
commands.registerCommand("extension.goToInterface", async (target: ImplementationTarget) => {
  console.log("Executing custom Go to Interface command for method:", target.methodName);
  const editor = window.activeTextEditor;
  if (editor) {
    const docText = editor.document.getText();
    // Use a regex with the 's' flag to search for an interface block containing the method name.
    const regex = new RegExp(`type\\s+(\\w+)\\s+interface\\s*{[^}]*\\b${target.methodName}\\b`, 's');
    const match = regex.exec(docText);
    if (match) {
      const index = match.index;
      const pos = editor.document.positionAt(index);
      editor.selection = new Selection(pos, pos);
      editor.revealRange(new Range(pos, pos));
      console.log(`Found interface block for ${target.methodName} at line ${pos.line}`);
    } else {
      console.log(`No interface block found for ${target.methodName}. Falling back.`);
      await commands.executeCommand("editor.action.goToTypeDefinition");
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
    // @ts-ignore
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
