/**
 * Lightweight markdown -> React renderer for AI Mentor & Assistant replies.
 *
 * Safely renders headings (#..####), horizontal rules (---), bold (**...**),
 * inline code (`...`), ordered/unordered lists, code blocks, AND real vector
 * SVG trading diagrams (```svg ... ``` or inline <svg>...</svg>) after strict
 * XSS sanitization.
 */
import { Fragment } from 'react';

/**
 * Strip dangerous tags/attributes from model-generated SVG before rendering.
 */
function sanitizeSvg(rawSvg) {
  let clean = String(rawSvg || '').trim();
  if (!clean.toLowerCase().includes('<svg')) return '';
  clean = clean
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(iframe|object|embed|link|meta)[^>]*>([\s\S]*?<\/\1>)?/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
  // Ensure responsive sizing inside chat bubbles
  clean = clean.replace(/<svg\b([^>]*)>/i, (full, attrs) => {
    const hasClass = /\bclass\s*=/.test(attrs);
    const updatedAttrs = hasClass
      ? attrs.replace(/\bclass\s*=\s*(["'])/, '$1w-full h-auto max-w-full block ')
      : `${attrs} class="w-full h-auto max-w-full block"`;
    return `<svg${updatedAttrs}>`;
  });
  return clean;
}

/** Renders inline **bold** and `code` spans within a line of text. */
function renderInline(text, keyPrefix) {
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

function SvgDiagramBlock({ svgHtml }) {
  const safe = sanitizeSvg(svgHtml);
  if (!safe) return null;
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950 p-2.5 shadow-lg">
      <div
        className="min-w-[320px] max-w-full"
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    </div>
  );
}

/**
 * Render a markdown string into a list of React block elements.
 * @param {string} md
 */
export function renderMarkdown(md) {
  const lines = String(md || '').split('\n');
  const blocks = [];
  let list = null; // { ordered, items: [] }
  let codeFence = null; // { lang, lines: [] }
  let inlineSvgLines = null;

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
    const trimmed = line.trim();

    // Handle fenced code / SVG blocks (```svg ... ```)
    if (codeFence) {
      if (trimmed.startsWith('```')) {
        const joined = codeFence.lines.join('\n');
        if (codeFence.lang === 'svg' || joined.toLowerCase().includes('<svg')) {
          blocks.push(<SvgDiagramBlock key={`svg-${idx}`} svgHtml={joined} />);
        } else {
          blocks.push(
            <pre
              key={`pre-${idx}`}
              className="my-2 overflow-x-auto rounded-lg bg-slate-900/90 p-3 font-mono text-xs text-slate-100 border border-slate-700/60"
            >
              <code>{joined}</code>
            </pre>
          );
        }
        codeFence = null;
      } else {
        codeFence.lines.push(raw);
      }
      return;
    }

    // Handle raw inline <svg>...</svg> outside code fences
    if (inlineSvgLines) {
      inlineSvgLines.push(raw);
      if (trimmed.toLowerCase().includes('</svg>')) {
        blocks.push(<SvgDiagramBlock key={`isvg-${idx}`} svgHtml={inlineSvgLines.join('\n')} />);
        inlineSvgLines = null;
      }
      return;
    }

    if (trimmed.startsWith('```')) {
      flushList();
      const lang = trimmed.slice(3).trim().toLowerCase();
      codeFence = { lang, lines: [] };
      return;
    }

    if (trimmed.toLowerCase().startsWith('<svg')) {
      flushList();
      if (trimmed.toLowerCase().includes('</svg>')) {
        blocks.push(<SvgDiagramBlock key={`isvg-${idx}`} svgHtml={raw} />);
      } else {
        inlineSvgLines = [raw];
      }
      return;
    }

    // Blank line -> break the current list / paragraph.
    if (!trimmed) {
      flushList();
      return;
    }

    // Horizontal rule (---)
    if (/^-{3,}$/.test(trimmed)) {
      flushList();
      blocks.push(<hr key={`hr-${idx}`} className="my-3 border-slate-200 dark:border-slate-700/60" />);
      return;
    }

    // Headings (#, ##, ###, ####)
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const cls =
        level === 1
          ? 'text-base font-bold'
          : level === 2
            ? 'text-sm font-bold'
            : 'text-sm font-semibold';
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
