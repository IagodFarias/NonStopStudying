// Markdown leve e seguro para as notas das tarefas: gera elementos React (nunca HTML cru).
// Suporta # títulos, listas com "-", checklists "- [ ]"/"- [x]", **negrito**, *itálico*, `código` e [links](https://...).

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;

function renderInline(text, keyPrefix) {
  const parts = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    index += 1;
    if (token.startsWith('**')) {
      parts.push(
        <strong key={key} className="font-bold text-fg">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key} className="rounded bg-shell px-1 font-mono text-[0.9em] text-amber">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('[')) {
      parts.push(
        <a key={key} href={match[2]} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2">
          {token.slice(1, token.indexOf(']'))}
        </a>,
      );
    } else {
      parts.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function toBlocks(text) {
  const blocks = [];
  let list = null;
  text.split('\n').forEach((line, index) => {
    const item = line.match(/^\s*[-*]\s+(?:\[( |x|X)\]\s+)?(.*)$/);
    if (item) {
      list = list ?? { type: 'list', key: `list-${index}`, items: [] };
      list.items.push({ key: index, checked: item[1] === undefined ? null : item[1].toLowerCase() === 'x', text: item[2] });
      return;
    }
    if (list) {
      blocks.push(list);
      list = null;
    }
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) blocks.push({ type: 'heading', key: index, text: heading[1] });
    else if (line.trim()) blocks.push({ type: 'paragraph', key: index, text: line });
  });
  if (list) blocks.push(list);
  return blocks;
}

export function MarkdownText({ text }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-fg/85">
      {toBlocks(text).map((block) => {
        if (block.type === 'heading') {
          return (
            <p key={block.key} className="pt-1 font-bold text-fg">
              {renderInline(block.text, block.key)}
            </p>
          );
        }
        if (block.type === 'list') {
          return (
            <ul key={block.key} className="space-y-1">
              {block.items.map((item) => (
                <li key={item.key} className="flex gap-2">
                  <span className={`shrink-0 ${item.checked ? 'text-online' : 'text-muted'}`}>{item.checked === null ? '•' : item.checked ? '☑' : '☐'}</span>
                  <span className={item.checked ? 'text-muted line-through' : ''}>{renderInline(item.text, `${block.key}-${item.key}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={block.key}>{renderInline(block.text, block.key)}</p>;
      })}
    </div>
  );
}
