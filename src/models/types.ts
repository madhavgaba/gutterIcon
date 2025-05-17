import { Position, Uri, Range } from "vscode";

export interface InterfaceInfo {
  name: string;
  interfaceLocation: Position;
  interfaceFile: Uri;
}

export interface ImplementationTarget {
  methodName: string;
  position: Position;
  interfaceLocation?: Position;
  interfaceFile?: Uri;
  interfaces?: InterfaceInfo[];
  implementations?: { uri: Uri, range: Range }[];
}

export interface LanguagePatterns {
  interfaceDef: RegExp;
  interfaceMethod: RegExp;
  methodWithReceiver: RegExp;
  structDef: RegExp;
} 