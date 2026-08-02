/**
 * Ultra-light markdown -> React renderer for mentor replies.
 *
 * The project has no markdown dependency, and mentor answers only use a small
 * subset (headings, bold, inline code, bullet/numbered lists, paragraphs). This
 * renders that subset safely without dangerouslySetInnerHTML — every piece of
 * text goes through React as plain children, so there's no XSS surface.
 */
import { Fragment } from 'react';

/** Renders inline **bold** and `code` spans within a line of text. */
function renderInline(text, keyPrefix) {
  // Split on **bold** and `code`, keeping the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/**
 * Render a markdown string into a list of React block elements.
 * @param {string} md
 */
export function renderMarkdown(md) {
  const lines = String(md || '').split('\n');
  const blocks = [];
  let list = null; // { ordered, items: [] }

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => (
      <li key={i} className="ml-1">
        {renderInline(it, `li-${blocks.length}-${i}`)}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`ol-${blocks.length}`} className="my-2 list-decimal space-y-1 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
          {items}
        </ul>
      )
    );
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();

    // Blank line -> break the current list / paragraph.
    if (!line.trim()) {
      flushList();
      return;
    }

    // Headings (#, ##, ###)
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const cls = level === 1 ? 'text-base font-bold' : level === 2 ? 'text-sm font-bold' : 'text-sm font-semibold';
      blocks.push(
        <p key={`h-${idx}`} className={`mt-2 ${cls}`}>
          {renderInline(heading[2], `h-${idx}`)}
        </p>
      );
      return;
    }

    // Ordered list item
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ol[1]);
      return;
    }

    // Unordered list item
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(ul[1]);
      return;
    }

    // Paragraph
    flushList();
    blocks.push(
      <p key={`p-${idx}`} className="my-1 leading-relaxed">
        {renderInline(line, `p-${idx}`)}
      </p>
    );
  });

  flushList();
  return blocks;
}
