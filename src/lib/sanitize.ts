import sanitizeHtmlLib from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a",
  "img",
  "strong",
  "em",
  "u",
  "s",
  "mark",
  "hr",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
  "div",
];

// No iframe/script here — embed providers get added incrementally,
// scoped to exact allowlisted hostnames, as each embed type is built.
const ALLOWED_ATTRIBUTES: sanitizeHtmlLib.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  // Tiptap's CodeBlockLowlight round-trips the code-block language via
  // `<code class="language-xxx">` — allow only that exact pattern.
  code: ["class"],
  // ImageNode/GalleryNode round-trip alignment + grouping via a fixed,
  // enumerable set of semantic classes — see allowedClasses below.
  figure: ["class", "data-align"],
  div: ["class"],
};

const ALLOWED_CLASSES: sanitizeHtmlLib.IOptions["allowedClasses"] = {
  code: ["language-*"],
  figure: ["blog-img"],
  div: ["blog-gallery"],
};

export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedClasses: ALLOWED_CLASSES,
    allowedSchemes: ["http", "https", "mailto"],
  });
}

// Strips every tag, leaving plain text — used for the publish-gate's
// minimum-content-length check (formatting markup shouldn't count).
export function stripHtml(html: string): string {
  return sanitizeHtmlLib(html, { allowedTags: [], allowedAttributes: {} });
}
