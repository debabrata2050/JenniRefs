# 📚 JenniRefs - Chrome/Edge Extension

A browser extension that automatically tracks and copies references from Jenni AI.

## Features

- **Auto-detection**: Automatically detects references on Jenni AI
- **Live tracking**: Monitors for new references added dynamically
- **DOI Detection**: Converts DOI text to clickable links (works with all citation styles)
- **Search**: Filter references by keyword
- **Copy**: Copy individual references, URLs, or all at once
- **Theme**: Light and Dark mode support

## Installation

1. Open Chrome/Edge and navigate to `chrome://extensions/` or `edge://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `reference-tracker` folder
5. The extension icon will appear in your toolbar

## Usage

1. Navigate to Jenni AI (https://jenni.ai)
2. Work on your document with references
3. Click the extension icon to see tracked references
4. Use the search box to filter references
5. Click a reference to expand it
6. Use action buttons to copy text, URLs, or open links

## Buttons

| Button | Function |
|--------|----------|
| 🔄 | Refresh - rescan the page |
| 📋 | Copy All - copy all references |
| 🔗 | Copy All URLs - copy all reference URLs |
| 🗑️ | Clear - remove tracked references |
| ⚙️ | Settings - theme and credits |

## Files

- `manifest.json` - Extension configuration
- `popup.html/js/css` - Popup UI components
- `content.js` - Page content scanner
- `settings.html/js/css` - Settings page

## Permissions

- `activeTab` - Access current tab content
- `scripting` - Inject content script
- `storage` - Store tracked references and settings

## Credits

Built with ❤️
