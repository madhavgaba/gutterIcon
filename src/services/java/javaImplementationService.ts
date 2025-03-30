import { workspace, Location, Position, Range, Uri } from 'vscode';
import { ImplementationTarget } from '../../models/types';
import { LANGUAGE_PATTERNS } from '../../patterns/languagePatterns';

export class JavaImplementationService {
  public async findImplementations(target: ImplementationTarget): Promise<Location[]> {
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
    
    return implementations;
  }
} 