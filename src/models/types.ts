import { Position, Uri } from "vscode";

export interface InterfaceInfo {
  interfaceLocation: Position;
  interfaceFile: Uri;
}

export interface ImplementationTarget {
  methodName: string;
  position: Position;
  interfaceLocation?: Position;
  interfaceFile?: Uri;
  interfaces?: InterfaceInfo[];
}

export interface LanguagePatterns {
  interfaceDef: RegExp;
  interfaceMethod: RegExp;
  methodWithReceiver: RegExp;
  structDef: RegExp;
} 