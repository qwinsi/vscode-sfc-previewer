// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs')
const path = require('path');
import { render_svelte } from './svelte-render.js';
import { render_jsx } from './jsx-render.js';
import { render_vue } from './vue-render.js';

function remove_ext(filename) {
	const idx = filename.lastIndexOf(".");
	if (idx === -1) {
		return filename;
	}
	return filename.substring(0, idx);
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
		const filename = path.basename(fsPath);
		const file_name_without_ext = remove_ext(filename);
		const panel = vscode.window.createWebviewPanel(
			'svgRender',
			file_name_without_ext,
			vscode.ViewColumn.Beside, // show preview at the right
			{
				enableScripts: true,
				localResourceRoots: [
					vscode.Uri.joinPath(vscode.Uri.file(fsPath), '..'),
					context.extensionUri,
				]
			}
		);

		const content = fs.readFileSync(fsPath).toString();
		let render_func;
		if (filename.endsWith(".jsx")) {
			render_func = (jsx) => render_jsx(jsx, base_dir_url, panel);
		} else if (filename.endsWith(".svelte")) {
			render_func = (svelteCode) => render_svelte(svelteCode, context.extensionUri, panel);
		} else if (filename.endsWith(".vue")) {
			render_func = (vueCode) => render_vue(vueCode, base_dir_url, panel);
		} else {
			vscode.window.showErrorMessage(`[jsx-to-svg] Unsupported file type: ${filename}`);
			return;
		}


		panel.webview.html = render_func(content);

		// Listen for file saved
		const panel_disposable = vscode.workspace.onDidSaveTextDocument((document) => {
			if (document.uri.fsPath === fsPath) {
				const jsx = document.getText();
				panel.webview.html = render_func(jsx);
			}
		});

		// remove the event listener when the panel is disposed
		panel.onDidDispose(() => {
			panel_disposable.dispose();
		});
	});

	context.subscriptions.push(disposable);
}



// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
