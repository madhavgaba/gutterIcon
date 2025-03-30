import { commands, Location, Uri, Position } from 'vscode';

export class GoImplementationService {
  public async findImplementations(documentUri: Uri, position: Position): Promise<Location[]> {
    const implementations = await commands.executeCommand<Location[]>(
      'vscode.executeImplementationProvider',
      documentUri,
      position
    );
    
    return implementations || [];
  }
} 