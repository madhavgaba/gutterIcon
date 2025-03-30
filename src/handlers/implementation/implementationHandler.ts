import { commands, window, Location, Uri, Position } from 'vscode';
import { ImplementationTarget } from '../../models/types';
import { JavaImplementationService } from '../../services/java/javaImplementationService';
import { GoImplementationService } from '../../services/go/goImplementationService';

export class ImplementationHandler {
  private javaService: JavaImplementationService;
  private goService: GoImplementationService;

  constructor() {
    this.javaService = new JavaImplementationService();
    this.goService = new GoImplementationService();
  }

  public async handleGoToImplementation(target: ImplementationTarget): Promise<void> {
    const document = window.activeTextEditor?.document;
    if (!document) return;

    const language = document.languageId;
    const implementations = language === 'java' 
      ? await this.javaService.findImplementations(target)
      : await this.goService.findImplementations(document.uri, target.position);

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
      const disposable = window.onDidChangeActiveTextEditor(() => {
        commands.executeCommand('closeReferenceSearch');
        disposable.dispose();
      });
    }
  }
} 