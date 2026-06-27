import { compileScript, compileStyle, compileTemplate, parse } from '@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js';
const vscode = require('vscode');

const VUE_SFC_ID = "vue_sfc";
const VUE_RUNTIME_URL = "https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js";

function rewrite_vue_imports(code) {
    return code.replace(/from\s+["']vue["']/g, `from "${VUE_RUNTIME_URL}"`);
}

function collect_css(descriptor, baseDirUrl, panel) {
    const css = [];
    const hasScopedStyle = descriptor.styles.some((style) => style.scoped);

    for (const style of descriptor.styles) {
        if (style.src) {
            css.push(`<link rel="stylesheet" href="${panel.webview.asWebviewUri(vscode.Uri.joinPath(baseDirUrl, style.src))}">`);
            continue;
        }

        const compiled = compileStyle({
            id: `data-v-${VUE_SFC_ID}`,
            source: style.content,
            filename: descriptor.filename,
            scoped: style.scoped,
        });

        if (compiled.errors.length > 0) {
            throw compiled.errors[0];
        }

        css.push(`<style>${compiled.code}</style>`);
    }

    return {
        css: css.join('\n'),
        scopedId: hasScopedStyle ? `data-v-${VUE_SFC_ID}` : undefined,
    };
}

function compile_vue_script(descriptor) {
    if (!descriptor.script && !descriptor.scriptSetup) {
        return { code: "const __sfc_main = {};", bindings: undefined };
    }

    const compiled = compileScript(descriptor, {
        id: VUE_SFC_ID,
    });
    let script = compiled.content;

    script = rewrite_vue_imports(script);
    script = script.replace(/\bexport\s+default\s+/, "const __sfc_main = ");
    return { code: script, bindings: compiled.bindings };
}

function compile_vue_template(descriptor, scopedId, bindingMetadata) {
    if (!descriptor.template) {
        return "function render() { return null; }";
    }

    const compiled = compileTemplate({
        id: VUE_SFC_ID,
        source: descriptor.template.content,
        filename: descriptor.filename,
        scoped: Boolean(scopedId),
        compilerOptions: {
            mode: "module",
            bindingMetadata,
        },
    });

    if (compiled.errors.length > 0) {
        throw compiled.errors[0];
    }

    return rewrite_vue_imports(compiled.code).replace(/\bexport\s+function\s+render\b/, "function render");
}

function escape_html(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function get_error_content(error) {
    return `<!DOCTYPE html>
  <html>
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Preview SFC</title>
  </head>
  <body>
      <pre style="white-space: pre-wrap; color: #b00020;">${escape_html(error.message || error)}</pre>
  </body>
  </html>`;
}

function getWebviewContent(script, css) {
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
      ${css}
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
 * @param {string} vueCode
 * @returns {string} html content
 */
export function render_vue(vueCode, baseDirUrl, panel) {
    try {
        const parsed = parse(vueCode, {
            filename: "Preview.vue",
        });

        if (parsed.errors.length > 0) {
            throw parsed.errors[0];
        }

        const descriptor = parsed.descriptor;
        const { css, scopedId } = collect_css(descriptor, baseDirUrl, panel);
        const script = compile_vue_script(descriptor);
        const render = compile_vue_template(descriptor, scopedId, script.bindings);
        const scopedIdFragment = scopedId ? `\n__sfc_main.__scopeId = "${scopedId}";` : "";
        const appScript = `
${script.code}
${render}
__sfc_main.render = render;${scopedIdFragment}

import { createApp } from "${VUE_RUNTIME_URL}";
createApp(__sfc_main).mount("#root");
`;

        return getWebviewContent(appScript, css);
    } catch (error) {
        return get_error_content(error);
    }
}