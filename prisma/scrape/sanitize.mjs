// Mirrors src/lib/sanitize.ts's rules exactly. Duplicated here (rather than
// imported) because this script runs as plain Node ESM against .mjs files —
// it can't import the app's TypeScript source directly without a build step.
import sanitizeHtmlLib from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "a", "img", "strong", "em", "u", "s", "mark", "hr", "br",
  "table", "thead", "tbody", "tr", "th", "td",
  "figure", "figcaption", "div",
  "iframe", // YouTube only — enforced via allowedIframeHostnames below
];

const ALLOWED_ATTRIBUTES = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  code: ["class"],
  figure: ["class", "data-align"],
  div: ["class"],
  iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "referrerpolicy", "frameborder"],
};

const ALLOWED_CLASSES = {
  code: ["language-*"],
  figure: ["blog-img"],
  div: ["blog-gallery"],
};

export function sanitizeHtml(dirty) {
  return sanitizeHtmlLib(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedClasses: ALLOWED_CLASSES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
    allowIframeRelativeUrls: false,
  });
}
