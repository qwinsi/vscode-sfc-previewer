// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs')
const babel = require("@babel/core");
const path = require('path');

/*
function wrap_compiled_jsx_react(compiledJsxCode) {
	let script = `const exports = {};`+ compiledJsxCode;
	script = script.replace('var _react = _interopRequireWildcard(require("react"));', '');
	script = script.replace('var _react = _interopRequireDefault(require("react"));', '');
	// make sure _react["default"] is React and _react.useMemo etc. are available
	script += `
document.addEventListener('DOMContentLoaded', () => {
	window._react = React;
	_react["default"] = React;
	const App = exports["default"];
	ReactDOM.render(React.createElement(App), document.getElementById('root'));
});
	`
	return script;
}
*/

function wrap_compiled_jsx_preact(compiledJsxCode) {
	let script = `const exports = {};`+ compiledJsxCode;
	// remove code corresponding to `import React, { useMemo } from "react";`
	script = script.replace('var _react = _interopRequireWildcard(require("react"));', '');
	// remove code corresponding to `import React from "react";`
	script = script.replace('var _react = _interopRequireDefault(require("react"));', '');
	// make sure _react["default"] is preact and _react.useMemo etc. are available
	script += `
document.addEventListener('DOMContentLoaded', () => {
	window._react = Object.assign({default: preact}, preactHooks);
	const App = exports["default"];
	preact.render(preact.createElement(App), document.getElementById('root'));
});
	`
	return script;
}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('vscode-sfc-previewer.previewSfc', async function (uri) {
		let fsPath;
		if (uri) {
			// user clicked the context menu or the top-right preview button
			fsPath = uri.fsPath;
		} else if (vscode.window.activeTextEditor) {
			// user ran from Command Palette
			fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
		} else {
			vscode.window.showErrorMessage("[jsx-to-svg] No file selected or opened.");
			return;
		}


		// The code you place here will be executed every time your command is executed
		const base_dir_url = vscode.Uri.joinPath(vscode.Uri.file(fsPath), '..');
		const file_name = path.basename(fsPath);
		const file_name_without_ext = path.basename(fsPath, '.jsx');
		const panel = vscode.window.createWebviewPanel(
			'svgRender',
			file_name_without_ext,
			vscode.ViewColumn.Beside, // show preview at the right
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(vscode.Uri.file(fsPath), '..')]
			}
		);

		const presetEnv = require('@babel/preset-env');
		const presetReact = require('@babel/preset-react');


		function render_jsx(jsx) {
			// if There is no pattern like `import React from "react";` or `import React, { useMemo } from "react";`
			// add the import for React
			if (!jsx.match(/^\s*import (\{.+\}\s*,\s*)?React(\s*,\s*\{.+\})? from ["']react["']/)) {
				jsx = 'import React from "react";\n' + jsx;
			}
			babel.transformAsync(jsx, {
				"presets": [presetEnv, presetReact],
			}).then((compiledJsx) => {
				// extract all patterns like `require("{filepath}.css")`
				const css_files = [];
				let compiled = compiledJsx.code;
				const regex = /require\(["]([^"]+\.css)["]\)/g;
				const matchesIter = compiled.matchAll(regex);
				for (const match of matchesIter) {
					css_files.push(panel.webview.asWebviewUri(vscode.Uri.joinPath(base_dir_url, match[1])).toString());
				}
				compiled = compiled.replace(regex, "/* CSS import processed */");

				const script = wrap_compiled_jsx_preact(compiled);
				panel.webview.html = getWebviewContent(script, css_files);
			}).catch((e) => {
				vscode.window.showErrorMessage(e.message)
			});
		}

		const jsx = fs.readFileSync(fsPath).toString();
		render_jsx(jsx);

		// Listen for file saved
		const panel_disposable = vscode.workspace.onDidSaveTextDocument((document) => {
			if (document.uri.fsPath === fsPath) {
				const jsx = document.getText();
				render_jsx(jsx);
			}
		});

		// remove the event listener when the panel is disposed
		panel.onDidDispose(() => {
			panel_disposable.dispose();
		});
	});

	context.subscriptions.push(disposable);
}


//   <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
//   <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
function getWebviewContent(script, cssFiles) {
	const css_fragment = cssFiles.map((cssFile) => `<link rel="stylesheet" href="${cssFile}">`).join('\n');
	// chessboard-bg: chessboard-like transparent background
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script crossorigin src="https://unpkg.com/preact@10.26.4/dist/preact.min.js"></script>
      <script src="https://unpkg.com/preact@10.26.4/hooks/dist/hooks.umd.js"></script>
      <script src="https://unpkg.com/preact@10.26.4/compat/dist/compat.umd.js"></script>
	  ${css_fragment}
	  <title>Preview SFC</title>
	  <style>
	  .chessboard-bg {
	  	background-image: conic-gradient(#ccc 0 25%, #fff 25% 50%, #ccc 50% 75%, #fff 75%);
	  	background-size: 20px 20px;
	  }
	  </style>
  </head>
  <body class="chessboard-bg">
	  <script type="module">
	  ${script}
	  </script>
	  <div id="root"></div>
  </body>
  </html>`;
}

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
