import { commands, window, Range, Location } from 'vscode';
import { ImplementationTarget } from '../../models/types';

export class InterfaceHandler {
  public async handleGoToInterface(target: ImplementationTarget): Promise<void> {
    if (target.interfaces && target.interfaces.length > 0) {
      await this.handleMultipleInterfaces(target);
    } else if (target.interfaceLocation && target.interfaceFile) {
      await this.handleSingleInterface(target);
    }
  }

  private async handleMultipleInterfaces(target: ImplementationTarget): Promise<void> {
    // Create locations for all interfaces
    // @ts-ignore
    const locations = target.interfaces.map(i => 
      new Location(i.interfaceFile, new Range(i.interfaceLocation, i.interfaceLocation))
    );
    
    // Show references view using the current document and position
    const document = window.activeTextEditor?.document;
    if (document) {
      await commands.executeCommand(
        'editor.action.showReferences',
        document.uri,
        target.position,
        locations
      );
      
      // Close references view when editor changes
      const disposable = window.onDidChangeActiveTextEditor(() => {
        commands.executeCommand('closeReferenceSearch');
        disposable.dispose();
      });
    }
  }

  private async handleSingleInterface(target: ImplementationTarget): Promise<void> {
    await commands.executeCommand('vscode.open', target.interfaceFile, {
      // @ts-ignore
      selection: new Range(target.interfaceLocation, target.interfaceLocation)
    });
  }
} 