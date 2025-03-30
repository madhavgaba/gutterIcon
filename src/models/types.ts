import { Position, Uri } from "vscode";

export interface ImplementationTarget {
  position: Position;
  methodName: string;
  interfaceLocation?: Position;
  interfaceFile?: Uri;
  interfaces?: Array<{
    name: string;
    interfaceLocation: Position;
    interfaceFile: Uri;
  }>;
}

export interface LanguagePatterns {
  interfaceDef: RegExp;
  interfaceMethod: RegExp;
  methodWithReceiver: RegExp;
  structDef: RegExp;
} 