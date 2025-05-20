# VS Code Implementation Provider Extension

A Visual Studio Code extension that provides enhanced implementation detection and navigation for Go and Java files. This extension helps developers quickly find and navigate between interface implementations and their corresponding classes.


## Demo

![Implementation Provider Demo](https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2VmbmloaXA5Z3k1aGFheDdyZnJlcGV1eWp5cnR4cmVjaWdrcnd3MyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/9Us5TVKsJhKLF1PLRT/giphy.gif)

*Watch how the extension helps you navigate between interfaces and implementations with a single click*

## Features

- **Implementation Detection**: Automatically detects interface implementations in Go and Java files
- **CodeLens Support**: Shows "Implemented by" and "Implements" CodeLens indicators above interface and implementation declarations
- **Quick Navigation**: Click on CodeLens indicators to navigate between interfaces and their implementations
- **Multi-language Support**: Works with both Go and Java files
- **Real-time Updates**: Updates implementation indicators as you type
- **Path-based Filtering**: Configure specific paths where CodeLens should be shown

## Requirements

- Visual Studio Code 1.60.0 or higher
- Go or Java files in your workspace

## Installation

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "CodeJump"
4. Click Install

## Usage

### Configuration

You can configure which paths should show CodeLens indicators:

1. Open VS Code Settings (Ctrl+, or Cmd+,)
2. Search for "CodeJump"
3. Under "CodeJump+: Allowed Paths", add glob patterns for paths where you want CodeLens to appear
   - Example: `["src/**/*.go", "pkg/**/*.java"]`
   - You must specify at least one path pattern for the extension to work
   - Use `**` for recursive directory matching
   - Use `*` for single directory/file matching

Common path patterns:
```json
{
    "codejump.allowedPaths": [
        "**/*.go",           // All Go files in any directory
        "src/**/*.go",       // All Go files in src directory and subdirectories
        "pkg/*.go",          // All Go files directly in pkg directory
        "internal/**/*",     // All files in internal directory and subdirectories
        "*.java",            // All Java files in root directory
        "src/controllers/*.go" // All Go files in src/controllers directory
    ]
}
```

Common pitfalls to avoid:
- Don't use leading `/` in patterns (e.g., use `**/*.go` instead of `/**/*.go`)
- Don't use absolute paths (e.g., use `src/**/*.go` instead of `/Users/name/project/src/**/*.go`)
- Don't use Windows-style backslashes (e.g., use `src/**/*.go` instead of `src\**\*.go`)

### For Go Files

1. Open a Go file containing an interface
2. Look for the "Implemenatations" CodeLens above interface declarations
3. Click on the CodeLens to see all implementations
4. Click on any implementation to navigate to it
5. When there's only one implementation, you'll be taken directly to it
6. When there are multiple implementations, you'll see a list to choose from

### For Java Files

1. Open a Java file containing an interface
2. Look for the "Implementations" CodeLens above interface declarations
3. Click on the CodeLens to see all implementing classes
4. Click on any implementation to navigate to it
5. When there's only one implementation, you'll be taken directly to it
6. When there are multiple implementations, you'll see a list to choose from

### Navigation Behavior

- **Single Implementation**: When there's only one implementation, clicking the CodeLens will take you directly to it
- **Multiple Implementations**: When there are multiple implementations, clicking the CodeLens will show a list of all implementations for you to choose from
- **Interface Navigation**: When viewing an implementation, clicking the "Implements" CodeLens will take you directly to the interface if there's only one, or show a list if there are multiple interfaces

## Performance Considerations

The extension is designed to be lightweight and efficient, but here are some important performance considerations:

### Impact on VS Code Performance
- The extension only activates when you open Go or Java files
- No background processes or continuous monitoring are running
- Uses VS Code's built-in CodeLens feature, which is already optimized
- Implementation detection is done on-demand when viewing interface declarations

### Resource Usage
- Lightweight text-based analysis for implementation detection
- Results are cached to improve subsequent lookups
- Minimal memory footprint

### Performance in Large Codebases
- For small to medium codebases, there should be negligible performance impact
- In very large codebases (thousands of files), you might notice:
  - A slight delay when first opening an interface file
  - Longer search times when looking for implementations across many files
  - Subsequent lookups will be faster due to caching

### Optimization Tips
1. Disable the extension when not working with Go or Java files
2. If you experience any slowdown, you can temporarily disable the extension
3. For large projects, consider working with a subset of files when possible

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

The repository will soon be open sourced.

## License

This extension is licensed under the MIT License - see the LICENSE file for details. 