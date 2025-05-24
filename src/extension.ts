import {
  languages,
  ExtensionContext,
  workspace
} from "vscode";
import { ImplementationCodeLensProvider } from './providers/implementationProvider';
import { InterfaceCodeLensProvider } from './providers/interfaceProvider';
import { registerCommands } from './utils/commands';
import { resetCache, clearOldCacheEntries } from './utils/pathUtils';

export function activate(context: ExtensionContext) {
  console.log("CodeJump+ extension activated");
  
  // Register configuration change listener
  context.subscriptions.push(
    workspace.onDidChangeConfiguration(resetCache)
  );

  // Set up periodic cache clearing (every 5 minutes)
  const cacheClearInterval = setInterval(() => {
    clearOldCacheEntries();
  }, 5 * 60 * 1000);

  // Clean up interval on deactivation
  context.subscriptions.push({
    dispose: () => clearInterval(cacheClearInterval)
  });

  // Always register our custom CodeLens providers for Go and Java.
  // These do NOT rely on gopls or the Go extension, so they work regardless of user Go config.
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      { language: 'go' },
      new ImplementationCodeLensProvider() as any
    )
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      { language: 'go' },
      new InterfaceCodeLensProvider() as any
    )
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      { language: 'java' },
      new ImplementationCodeLensProvider() as any
    )
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      { language: 'java' },
      new InterfaceCodeLensProvider() as any
    )
  );
  // Register extension commands
  registerCommands();
}

export function deactivate() {}
