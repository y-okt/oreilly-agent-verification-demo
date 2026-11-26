// ヘルプ。開いたときにだけ読み込まれる。色付けは TypeScript の定義だけを登録する。
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import { Marked } from 'marked';
import helpText from '../help.md?raw';

hljs.registerLanguage('ts', typescript);

const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      const html = lang && hljs.getLanguage(lang) ? hljs.highlight(text, { language: lang }).value : text.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`);
      return `<pre><code class="hljs">${html}</code></pre>`;
    },
  },
});

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="ヘルプ" onClick={(e) => e.stopPropagation()}>
        <div className="help-body" dangerouslySetInnerHTML={{ __html: marked.parse(helpText) as string }} />
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
