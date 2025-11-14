import { compile } from 'svelte/compiler';
const vscode = require('vscode');

const SVELTE_SFC = "svelte_sfc";

function wrap_compiled_svelte(compiledCode, extensionDirUrl, panel) {
    compiledCode = compiledCode.replace("import 'svelte/internal/flags/legacy'", "");
    compiledCode = compiledCode.replace("import * as $ from 'svelte/internal/client'", "");

    let code = "";
    code += `import "${panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionDirUrl, "./svelte/internal/flags/legacy.js"))}";\n`;
    code += `import * as $ from "${panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionDirUrl, "./svelte/internal/client.js"))}";\n`;
    code += compiledCode;
    code += `
     $.mount(${SVELTE_SFC}, {
  target: document.getElementById('root'),
})
    `;
    return code;
}

//   <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
//   <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
function getWebviewContent(script, css) {
	// chessboard-bg: chessboard-like transparent background
	return `<!DOCTYPE html>
  <html>
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Preview SFC</title>
	  <style>
	  .chessboard-bg {
	  	background-image: conic-gradient(#ccc 0 25%, #fff 25% 50%, #ccc 50% 75%, #fff 75%);
	  	background-size: 20px 20px;
	  }
	  </style>
	  <style>
      ${css ? css : ""}
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

/**
 *
 * @param {string} jsx
 * @returns {string} html content
 */
export function render_svelte(svelteCode, extensionDirUrl, panel) {
    const compiled = compile(svelteCode, {
        name: SVELTE_SFC,
        discloseVersion: false,
        compatibility: {
            componentApi: 5
        },
        css: "external",
    });
    const script = wrap_compiled_svelte(compiled.js.code, extensionDirUrl, panel);
    return getWebviewContent(script, compiled.css?.code);
}
