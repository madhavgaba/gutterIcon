import { commands, window, Location, Uri, Position } from 'vscode';
import { ImplementationTarget } from '../../models/types';
import { GoImplementationService } from '../../services/go/goImplementationService';

export class ImplementationHandler {
  private goService: GoImplementationService;

  constructor() {
    this.goService = new GoImplementationService();
  }

  public async handleGoToImplementation(target: ImplementationTarget): Promise<void> {
    const document = window.activeTextEditor?.document;
    if (!document) return;

    const language = document.languageId;
    let implementations: Location[] = [];

    if (language === 'go') {
      implementations = await this.goService.findImplementations(document.uri, target.position);
    } else {
      // For Java, use the existing implementations from the CodeLens
      if (target.implementations) {
        implementations = target.implementations.map(impl => 
          new Location(impl.uri, impl.range)
        );
      }
    }

    if (implementations && implementations.length > 0) {
      await this.navigateToImplementations(implementations, document.uri, target.position);
    }
  }

  private async navigateToImplementations(
    implementations: Location[],
    documentUri: Uri,
    position: Position
  ): Promise<void> {
    if (implementations.length === 1) {
      // If there's only one implementation, navigate directly to it
      const implementation = implementations[0];
      await commands.executeCommand('vscode.open', implementation.uri, { 
        selection: implementation.range 
      });
    } else {
      // If there are multiple implementations, show the references view
      await commands.executeCommand(
        'editor.action.showReferences',
        documentUri,
        position,
        implementations
      );
      
      // Close references view when editor changes
      const disposable = window.onDidChangeActiveTextEditor(() => {
        commands.executeCommand('closeReferenceSearch');
        disposable.dispose();
      });
    }
  }
} 