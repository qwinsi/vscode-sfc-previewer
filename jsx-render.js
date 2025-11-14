const sucrase = require('sucrase');
const vscode = require('vscode');

/*
function wrap_compiled_jsx_react(compiledJsxCode) {
    let script = `const exports = {};`+ compiledJsxCode;
    // remove code corresponding to `import React, { useMemo } from "react";` or `import React from "react";`
    script = script.replace("var _react = require('react');", "");
    script = script.replace("var _react2 = _interopRequireDefault(_react);", "");
    // make sure _react2["default"] is React and _react.useMemo etc. are available
    script += `
document.addEventListener('DOMContentLoaded', () => {
    window._react2 = { default: React };
    window._react = React;
    const App = exports["default"];
    ReactDOM.render(React.createElement(App), document.getElementById('root'));
});
    `
    return script;
}
*/

function wrap_compiled_jsx_preact(compiledJsxCode) {
    let script = `const exports = {};`+ compiledJsxCode;
    // remove code corresponding to `import React, { useMemo } from "react";` or `import React from "react";`
    script = script.replace("var _react = require('react');", "");
    script = script.replace("var _react2 = _interopRequireDefault(_react);", "");
    // make sure _react2["default"] is preact and _react.useMemo etc. are available
    script += `
document.addEventListener('DOMContentLoaded', () => {
    window._react2 = { default: preact };
    window._react = preactHooks;
    const App = exports["default"];
    preact.render(preact.createElement(App), document.getElementById('root'));
});
    `
    return script;
}

//   <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
//   <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
function getWebviewContent(script, cssFiles) {
	const css_fragment = cssFiles.map((cssFile) => `<link rel="stylesheet" href="${cssFile}">`).join('\n');
	// chessboard-bg: chessboard-like transparent background
	return `<!DOCTYPE html>
  <html>
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

/**
 *
 * @param {string} jsx
 * @returns {string} html content
 */
export function render_jsx(jsx, baseDirUrl, panel) {
    // if There is no pattern like `import React from "react";` or `import React, { useMemo } from "react";`
    // add the import for React
    if (!jsx.match(/^\s*import (\{.+\}\s*,\s*)?React(\s*,\s*\{.+\})? from ["']react["']/)) {
        jsx = 'import React from "react";\n' + jsx;
    }

    const compiledJsx = sucrase.transform(jsx, {
        transforms: ["jsx", "imports"],
        jsxPragma: "React.createElement",
        jsxFragmentPragma: "React.Fragment",
    });

    // extract all patterns like `require("{filepath}.css")` or `require('{filepath}.css')`
    const css_files = [];
    let compiled = compiledJsx.code;
    const regex = /require\(["']([^"']+\.css)["']\)/g;
    const matchesIter = compiled.matchAll(regex);
    for (const match of matchesIter) {
        css_files.push(panel.webview.asWebviewUri(vscode.Uri.joinPath(baseDirUrl, match[1])).toString());
    }
    compiled = compiled.replace(regex, "/* CSS import processed */");

    const script = wrap_compiled_jsx_preact(compiled);
    return getWebviewContent(script, css_files);
}
