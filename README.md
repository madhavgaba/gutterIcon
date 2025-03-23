# VS Code Implementation Provider Extension

A Visual Studio Code extension that provides enhanced implementation detection and navigation for Go and Java files. This extension helps developers quickly find and navigate between interface implementations and their corresponding classes.

## Features

- **Implementation Detection**: Automatically detects interface implementations in Go and Java files
- **CodeLens Support**: Shows "Implemented by" and "Implements" CodeLens indicators above interface and implementation declarations
- **Quick Navigation**: Click on CodeLens indicators to navigate between interfaces and their implementations
- **Multi-language Support**: Works with both Go and Java files
- **Real-time Updates**: Updates implementation indicators as you type

## Requirements

- Visual Studio Code 1.60.0 or higher
- Go or Java files in your workspace

## Installation

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "Implementation Provider"
4. Click Install

## Usage

### For Go Files

1. Open a Go file containing an interface
2. Look for the "Implemented by" CodeLens above interface declarations
3. Click on the CodeLens to see all implementations
4. Click on any implementation to navigate to it

### For Java Files

1. Open a Java file containing an interface
2. Look for the "Implemented by" CodeLens above interface declarations
3. Click on the CodeLens to see all implementing classes
4. Click on any implementation to navigate to it

## Extension Settings

This extension contributes the following settings:

* `implementationProvider.enable`: Enable/disable the extension
* `implementationProvider.debug`: Enable debug logging

## Known Issues

- Implementation detection may take a few seconds for large codebases
- Some complex interface implementations might not be detected
- Performance may vary depending on the size of your workspace

## Release Notes

### 1.0.0

Initial release of the Implementation Provider extension with support for:
- Go interface implementation detection
- Java interface implementation detection
- CodeLens indicators for navigation
- Basic implementation detection logic

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the MIT License - see the LICENSE file for details. 