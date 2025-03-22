import * as vscode from "vscode";

class GoImplementationCodeLensProvider implements vscode.CodeLensProvider<vscode.CodeLens> {
    // @ts-ignore
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
      const codeLenses: vscode.CodeLens[] = [];
      // Regex to match Go function declarations (standalone functions or methods)
      const functionRegex = /^\s*func\s+(?:\([^)]*\)\s*)?(\w+)/gm;
      const text = document.getText();
      let match: RegExpExecArray | null;
      while ((match = functionRegex.exec(text)) !== null) {
        const line = document.positionAt(match.index).line;
        const range = new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 0));
        codeLenses.push(new vscode.CodeLens(range, {
          title: "Go to Implementation",
          command: "extension.goToImplementation"
        }));
      }
      return codeLenses;
    }
  }
  

export function activate(context: vscode.ExtensionContext) {
  console.log("Go Implementation Gutter extension activated.");

  // Register the CodeLens provider for Go files.
  context.subscriptions.push(
    // @ts-ignore
    vscode.languages.registerCodeLensProvider({ language: "go" }, new GoImplementationCodeLensProvider())
  );

  // Register the command that gets executed when a CodeLens is clicked.
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.goToImplementation", async () => {
      console.log("Executing Go to Implementation command");
      // Trigger the built-in "Go to Implementation" command.
      await vscode.commands.executeCommand("editor.action.goToImplementation");
    })
  );
}

export function deactivate() {}
