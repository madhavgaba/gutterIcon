import { commands, window, Range, Location, Uri, Position, workspace } from 'vscode';
import { ImplementationTarget } from '../models/types';
import { LANGUAGE_PATTERNS } from '../patterns/languagePatterns';

interface QuickPickItem {
  label: string;
  detail: string;
  interfaceLocation: Position;
  interfaceFile: Uri;
}

export async function registerCommands() {
  return [
    commands.registerCommand('extension.goToImplementation', async (target: ImplementationTarget & { implementations?: { uri: Uri, range: Range }[] }) => {
      const document = window.activeTextEditor?.document;
      if (!document) return;
      
      // If implementations are provided, use them directly
      if (target.implementations && target.implementations.length > 0) {
        if (target.implementations.length === 1) {
          const impl = target.implementations[0];
          await commands.executeCommand('vscode.open', impl.uri, { selection: impl.range });
        } else {
          await commands.executeCommand('editor.action.showReferences', document.uri, target.position, target.implementations.map(i => new Location(i.uri, i.range)));
          const disposable = window.onDidChangeActiveTextEditor(() => {
            commands.executeCommand('closeReferenceSearch');
            disposable.dispose();
          });
        }
        return;
      }
      
      const language = document.languageId;
      if (language === 'java') {
        // For Java, use our custom implementation detection
        const filePattern = '**/*.java';
        const javaFiles = await workspace.findFiles(filePattern);
        const implementations: Location[] = [];
        
        for (const file of javaFiles) {
          try {
            const doc = await workspace.openTextDocument(file);
            let currentClass = "";
            let inClassBlock = false;
            
            for (let i = 0; i < doc.lineCount; i++) {
              const line = doc.lineAt(i).text;
              const match = LANGUAGE_PATTERNS.java.structDef.exec(line);
              
              if (match) {
                currentClass = match[1];
                if (line.includes(`implements ${target.methodName}`)) {
                  const pos = new Position(i, line.indexOf(currentClass));
                  implementations.push(new Location(file, new Range(pos, pos)));
                }
                inClassBlock = true;
                continue;
              }
              
              if (inClassBlock) {
                if (/^\s*}\s*$/.test(line)) {
                  inClassBlock = false;
                  continue;
                }
                
                const methodMatch = LANGUAGE_PATTERNS.java.methodWithReceiver.exec(line);
                if (methodMatch && methodMatch[1] === target.methodName) {
                  const pos = new Position(i, line.indexOf(target.methodName));
                  implementations.push(new Location(file, new Range(pos, pos)));
                }
              }
            }
          } catch (error) {
            console.error(`Error reading file ${file.fsPath}:`, error);
          }
        }
        
        if (implementations.length > 0) {
          if (implementations.length === 1) {
            // If there's only one implementation, navigate directly to it
            const implementation = implementations[0];
            await commands.executeCommand('vscode.open', implementation.uri, { selection: implementation.range });
          } else {
            // If there are multiple implementations, show the references view
            await commands.executeCommand('editor.action.showReferences', document.uri, target.position, implementations);
            const disposable = window.onDidChangeActiveTextEditor(() => {
              commands.executeCommand('closeReferenceSearch');
              disposable.dispose();
            });
          }
        }
      } else {
        // For Go, use the built-in implementation provider
        const implementations = await commands.executeCommand<Location[]>('vscode.executeImplementationProvider', document.uri, target.position);
        if (implementations && implementations.length > 0) {
          if (implementations.length === 1) {
            // If there's only one implementation, navigate directly to it
            const implementation = implementations[0];
            await commands.executeCommand('vscode.open', implementation.uri, { selection: implementation.range });
          } else {
            // If there are multiple implementations, show the references view
            await commands.executeCommand('editor.action.showReferences', document.uri, target.position, implementations);
            const disposable = window.onDidChangeActiveTextEditor(() => {
              commands.executeCommand('closeReferenceSearch');
              disposable.dispose();
            });
          }
        }
      }
    }),

    commands.registerCommand('extension.goToInterface', async (target: ImplementationTarget) => {
      if (target.interfaces && target.interfaces.length > 0) {
        // Create locations for all interfaces
        const locations = target.interfaces.map(i => 
          new Location(i.interfaceFile, new Range(i.interfaceLocation, i.interfaceLocation))
        );
        
        // Show references view using the current document and position
        const document = window.activeTextEditor?.document;
        if (document) {
          await commands.executeCommand('editor.action.showReferences', document.uri, target.position, locations);
          
          // Close references view when editor changes
          const disposable = window.onDidChangeActiveTextEditor(() => {
            commands.executeCommand('closeReferenceSearch');
            disposable.dispose();
          });
        }
      } else if (target.interfaceLocation && target.interfaceFile) {
        // Backward compatibility for single interface
        await commands.executeCommand('vscode.open', target.interfaceFile, {
          selection: new Range(target.interfaceLocation, target.interfaceLocation)
        });
      }
    })
  ];
} 