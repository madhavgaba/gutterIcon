import { commands, Location, Uri, Position, workspace, Range } from 'vscode';
import { LANGUAGE_PATTERNS } from '../../patterns/languagePatterns';

export class GoImplementationService {
  public async findImplementations(documentUri: Uri, position: Position): Promise<Location[]> {
    const implementations: Location[] = [];
    const filePattern = '**/*.go';
    const goFiles = await workspace.findFiles(filePattern);
    
    // Get the current document to find the interface/method name
    const currentDoc = await workspace.openTextDocument(documentUri);
    const line = currentDoc.lineAt(position.line).text;
    const patterns = LANGUAGE_PATTERNS['go'];
    
    // Check if we're on an interface definition or method
    const interfaceMatch = patterns.interfaceDef.exec(line);
    const methodMatch = patterns.interfaceMethod.exec(line);
    
    if (interfaceMatch) {
      const interfaceName = interfaceMatch[1];
      // Get all methods in the interface
      const interfaceMethods = new Set<string>();
      let inInterfaceBlock = true;
      for (let i = position.line + 1; i < currentDoc.lineCount; i++) {
        const lineText = currentDoc.lineAt(i).text;
        if (/^\s*}\s*$/.test(lineText)) {
          break;
        }
        const methodMatch = patterns.interfaceMethod.exec(lineText);
        if (methodMatch) {
          interfaceMethods.add(methodMatch[1]);
        }
      }

      // Search for structs that implement this interface
      for (const file of goFiles) {
        try {
          const data = await workspace.fs.readFile(file);
          const content = Buffer.from(data).toString('utf8');
          const lines = content.split(/\r?\n/);
          let structMethods = new Set<string>();
          let currentStruct = '';
          let structStartLine = -1;
          
          for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i];
            const structMatch = patterns.structDef.exec(lineText);
            
            if (structMatch) {
              currentStruct = structMatch[1];
              structMethods = new Set<string>();
              structStartLine = i;
              continue;
            }
            
            const methodMatch = patterns.methodWithReceiver.exec(lineText);
            if (methodMatch && currentStruct) {
              structMethods.add(methodMatch[1]);
            }

            // Check if we've found all interface methods
            if (structMethods.size > 0 && [...interfaceMethods].every(method => structMethods.has(method))) {
              const pos = new Position(structStartLine, lines[structStartLine].indexOf(currentStruct));
              implementations.push(new Location(file, new Range(pos, pos)));
              break;
            }
          }
        } catch (error) {
          console.error(`Error reading file ${file.fsPath}:`, error);
        }
      }
    } else if (methodMatch) {
      const methodName = methodMatch[1];
      // Search for structs that implement this method
      for (const file of goFiles) {
        try {
          const data = await workspace.fs.readFile(file);
          const content = Buffer.from(data).toString('utf8');
          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i];
            const methodMatch = patterns.methodWithReceiver.exec(lineText);
            if (methodMatch && methodMatch[1] === methodName) {
              const pos = new Position(i, lineText.indexOf(methodName));
              implementations.push(new Location(file, new Range(pos, pos)));
            }
          }
        } catch (error) {
          console.error(`Error reading file ${file.fsPath}:`, error);
        }
      }
    }
    
    return implementations;
  }
} 