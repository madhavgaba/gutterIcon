import { commands } from 'vscode';
import { ImplementationHandler } from '../handlers/implementation/implementationHandler';
import { InterfaceHandler } from '../handlers/interface/interfaceHandler';

export async function registerCommands() {
  const implementationHandler = new ImplementationHandler();
  const interfaceHandler = new InterfaceHandler();

  return [
    commands.registerCommand(
      'extension.goToImplementation',
      implementationHandler.handleGoToImplementation.bind(implementationHandler)
    ),
    commands.registerCommand(
      'extension.goToInterface',
      interfaceHandler.handleGoToInterface.bind(interfaceHandler)
    )
  ];
} 