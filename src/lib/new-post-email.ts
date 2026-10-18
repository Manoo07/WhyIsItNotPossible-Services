// The "new post from an author you follow" email. Kept separate from
// notification.service.ts so the delivery logic stays readable and the
// template can be unit-tested on its own.
//
// Modeled on Medium's story emails: hero image, title, author byline, then
// the opening of the article itself cut off mid-thought (the strongest pull
// to click through), and a "More from <category>" list underneath.
//
// Email HTML is not web HTML: Gmail/Outlook strip <style> blocks and most
// layout CSS, so this uses nested tables and inline styles only, a fixed
// 600px width, and table-based ("bulletproof") buttons that still render as
// buttons in Outlook. Images are blocked by default in many clients, so
// nothing essential is image-only — the wordmark and byline are text, and
// images carry meaningful alt text.

// Mirrors the website's design tokens exactly so the email reads as part of
// the site — keep in sync with whyisitnotpossible-ui/apps/blog/src/index.css
// (light theme): --primary, --foreground, --muted-foreground, --border,
// --background, and the two font stacks (--app-font-sans / --app-font-serif;
// the site's "serif" is SF Pro Display, not an actual serif face).
const ORANGE = "#F97015"; // --primary
const ORANGE_TINT = "#FEF1E8"; // bg-primary/10 on white (avatar fallback)
const INK = "#0E1525"; // --foreground
const BODY = "#374151"; // article prose body text
const MUTED = "#6B6561"; // --muted-foreground
const PAGE_BG = "#FBFAF9"; // --background
const BORDER = "#DDD9D5"; // --border
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const FONT_DISPLAY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";
// Cards on the site are rounded-xl (--radius + 4px); buttons rounded-md.
const CARD_RADIUS = "16px";
const BUTTON_RADIUS = "10px";
// PNG twin of the site's white header logo (emails can't render SVG),
// published by the frontend at /email-logo-on-brand.png.
const LOGO_PATH = "/email-logo-on-brand.png";

// One short paragraph, ~3-4 lines at the email's 600px width — enough to
// hook, short enough that the reader has to click to finish the thought.
const TEASER_MAX_CHARS = 220;
const TEASER_MAX_PARAGRAPHS = 1;

export interface RelatedPostSummary {
  slug: string;
  title: string;
  coverImageUrl?: string | null;
  readingTime?: number | null;
}

export interface NewPostEmailInput {
  author: { name: string; avatarUrl?: string | null };
  post: {
    slug: string;
    title: string;
    subtitle?: string | null;
    excerpt?: string | null;
    content?: string | null;
    coverImageUrl?: string | null;
    readingTime?: number | null;
    category?: { name: string; slug?: string | null; coverImageUrl?: string | null } | null;
  };
  // Other recent posts in the same category, newest first (max 3 shown).
  related?: RelatedPostSummary[];
  // Site origin, no trailing slash — e.g. https://whyisitnotpossible.com
  siteUrl: string;
}

export interface NewPostEmail {
  subject: string;
  html: string;
  text: string;
}

// Everything interpolated into the HTML goes through this — titles and
// author names are user-written and may contain & < > " characters.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

// Tags out, entities decoded back to characters — the result is plain text,
// re-escaped (once) by escapeHtml wherever it lands in the HTML.
function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

// The article's opening paragraphs as plain text, stopping once there's
// enough to hook the reader; the last one is cut at a word boundary with an
// ellipsis so it reads as "to be continued".
export function articleTeaser(contentHtml: string | null | undefined, maxChars = TEASER_MAX_CHARS): string[] {
  if (!contentHtml) return [];
  const paragraphs = [...contentHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => htmlToText(m[1]))
    .filter((t) => t.length > 0);

  const out: string[] = [];
  let used = 0;
  for (const para of paragraphs) {
    if (out.length >= TEASER_MAX_PARAGRAPHS) break;
    const room = maxChars - used;
    if (room < 80) break;
    if (para.length <= room) {
      out.push(para);
      used += para.length;
      continue;
    }
    const cut = para.slice(0, room);
    const atWord = cut.slice(0, Math.max(cut.lastIndexOf(" "), 0)) || cut;
    out.push(`${atWord.replace(/[\s,.;:!?—–-]+$/, "")}…`);
    break;
  }
  return out;
}

// Email clients have no base URL to resolve a relative path against, so
// legacy "/api/uploads/..." images must be made absolute.
function absoluteUrl(url: string, siteUrl: string): string {
  return /^https?:\/\//i.test(url) ? url : `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function button(href: string, label: string): string {
  return `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="${ORANGE}" style="border-radius:${BUTTON_RADIUS};">
                          <a href="${escapeHtml(href)}" class="btn-link" style="display:inline-block;padding:8px 16px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:500;color:#FFFFFF;text-decoration:none;border-radius:${BUTTON_RADIUS};">${label}</a>
                        </td>
                      </tr>
                    </table>`;
}

export function buildNewPostEmail({ author, post, related = [], siteUrl }: NewPostEmailInput): NewPostEmail {
  const e = escapeHtml;
  const postUrl = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`;
  const preferencesUrl = `${siteUrl}/settings?tab=notifications`;
  const categoryUrl = post.category?.slug ? `${siteUrl}/category/${encodeURIComponent(post.category.slug)}` : null;

  // The article's own cover first; a category banner is the next best
  // visual; with neither, the email simply has no hero rather than a
  // generic stock image.
  const heroSrc = post.coverImageUrl || post.category?.coverImageUrl || null;
  const hero = heroSrc ? absoluteUrl(heroSrc, siteUrl) : null;

  const summary = (post.subtitle || post.excerpt || "").trim();
  const teaser = articleTeaser(post.content);
  const readTime = post.readingTime ? `${post.readingTime} min read` : null;
  const relatedShown = related.slice(0, 3);

  const subject = `${author.name} published a new post: ${post.title}`;

  // ---- Plain-text part --------------------------------------------------
  const text = [
    `${author.name} just published a new post.`,
    "",
    post.category ? post.category.name.toUpperCase() : null,
    post.title,
    summary || null,
    [`By ${author.name}`, readTime].filter(Boolean).join(" · "),
    "",
    ...teaser.flatMap((p) => [p, ""]),
    `Continue reading: ${postUrl}`,
    ...(relatedShown.length
      ? [
          "",
          `More from ${post.category?.name ?? "Why Is It NOT Possible?"}:`,
          ...relatedShown.map((r) => `- ${r.title}: ${siteUrl}/blog/${encodeURIComponent(r.slug)}`),
        ]
      : []),
    "",
    `You are receiving this email because you follow ${author.name}.`,
    `Manage notification preferences: ${preferencesUrl}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  // ---- HTML part ----------------------------------------------------------
  const heroRow = hero
    ? `<tr>
          <td style="padding:0;">
            <a href="${e(postUrl)}" style="display:block;">
              <img src="${e(hero)}" width="600" alt="${e(post.title)}"
                style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />
            </a>
          </td>
        </tr>`
    : "";

  const categoryLine = post.category
    ? `<p style="margin:0 0 12px 0;font-family:${FONT};font-size:14px;line-height:20px;font-weight:600;letter-spacing:0.025em;text-transform:uppercase;color:${ORANGE};">${
        categoryUrl
          ? `<a href="${e(categoryUrl)}" style="color:${ORANGE};text-decoration:none;">${e(post.category.name)}</a>`
          : e(post.category.name)
      }</p>`
    : "";

  const summaryLine = summary
    ? `<p class="subtitle" style="margin:0 0 20px 0;font-family:${FONT_DISPLAY};font-size:18px;line-height:28px;font-style:italic;color:${MUTED};">${e(summary)}</p>`
    : "";

  const avatar = author.avatarUrl
    ? `<img src="${e(absoluteUrl(author.avatarUrl, siteUrl))}" width="40" height="40" alt="${e(author.name)}"
          style="display:block;width:40px;height:40px;border-radius:20px;border:0;object-fit:cover;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="40" height="40" align="center" valign="middle" bgcolor="${ORANGE_TINT}"
            style="width:40px;height:40px;border-radius:20px;font-family:${FONT};font-size:14px;font-weight:500;color:${ORANGE};">${e(initials(author.name))}</td>
        </tr></table>`;

  const bylineRow = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px 0;">
                      <tr>
                        <td valign="middle" style="padding-right:12px;">${avatar}</td>
                        <td valign="middle" style="font-family:${FONT};font-size:14px;line-height:20px;">
                          <span style="font-weight:500;color:${INK};">${e(author.name)}</span><br />
                          <span style="color:${MUTED};">${e(
                            [post.category ? `in ${post.category.name}` : null, readTime].filter(Boolean).join(" · "),
                          )}</span>
                        </td>
                      </tr>
                    </table>`;

  const teaserBlock = teaser.length
    ? `<tr>
          <td class="pad" style="padding:0 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid ${BORDER};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="pad" style="padding:22px 28px 4px 28px;">
            ${teaser
              .map(
                (p) =>
                  `<p class="teaser" style="margin:0 0 16px 0;font-family:${FONT_DISPLAY};font-size:18px;line-height:29px;color:${BODY};">${e(p)}</p>`,
              )
              .join("\n            ")}
          </td>
        </tr>`
    : "";

  const relatedBlock = relatedShown.length
    ? `<tr>
            <td style="padding:28px 0 0 0;">
              <p style="margin:0 0 12px 4px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:600;letter-spacing:0.025em;text-transform:uppercase;color:${INK};">
                More from ${categoryUrl ? `<a href="${e(categoryUrl)}" style="color:${ORANGE};text-decoration:none;">${e(post.category!.name)}</a>` : "Why Is It NOT Possible?"}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;border:1px solid ${BORDER};border-radius:${CARD_RADIUS};">
                ${relatedShown
                  .map((r, i) => {
                    const url = `${siteUrl}/blog/${encodeURIComponent(r.slug)}`;
                    const thumb = r.coverImageUrl
                      ? `<a href="${e(url)}"><img src="${e(absoluteUrl(r.coverImageUrl, siteUrl))}" width="112" height="72" alt=""
                          style="display:block;width:112px;height:72px;border-radius:6px;border:0;object-fit:cover;" /></a>`
                      : `<div style="width:112px;height:72px;border-radius:6px;background-color:#F3EDE7;"></div>`;
                    return `<tr>
                  <td class="rel-row" style="padding:16px;${i > 0 ? `border-top:1px solid ${BORDER};` : ""}">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="112" valign="top" class="rel-thumb" style="padding-right:16px;">${thumb}</td>
                        <td valign="top" style="font-family:${FONT};">
                          <a href="${e(url)}" class="rel-title" style="display:block;font-family:${FONT_DISPLAY};font-size:16px;line-height:22px;font-weight:700;color:${INK};text-decoration:none;">${e(r.title)}</a>
                          ${r.readingTime ? `<span style="display:block;margin-top:6px;font-size:12px;line-height:16px;color:${MUTED};">${r.readingTime} min read</span>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;
                  })
                  .join("\n                ")}
              </table>
            </td>
          </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${e(post.title)}</title>
  <!-- Phone layout (Gmail, Apple Mail and Outlook mobile honor this; older
       desktop Outlook ignores it and keeps the 600px desktop layout). -->
  <style>
    /* Long unbroken words (URLs, long names) wrap instead of overflowing. */
    .title, .subtitle, .teaser, .rel-title { word-break: break-word; overflow-wrap: anywhere; }
    @media only screen and (max-width: 620px) {
      .outer { padding: 12px 8px !important; }
      .brand { padding: 12px 16px !important; }
      .wordmark { font-size: 18px !important; }
      .pad { padding-left: 20px !important; padding-right: 20px !important; }
      .intro { padding-top: 22px !important; }
      .title { font-size: 24px !important; line-height: 30px !important; }
      .subtitle { font-size: 16px !important; line-height: 24px !important; }
      .teaser { font-size: 17px !important; line-height: 27px !important; }
      .btn { width: 100% !important; }
      .btn-link { display: block !important; padding: 11px 16px !important; }
      .rel-row { padding: 14px !important; }
      .rel-thumb { width: 84px !important; padding-right: 12px !important; }
      .rel-thumb img, .rel-thumb div { width: 84px !important; height: 56px !important; }
      .rel-title { font-size: 15px !important; line-height: 21px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
  <!-- Inbox preview line (hidden in the body itself). -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${e(summary || teaser[0] || `${author.name} just published a new post.`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
    <tr>
      <td align="center" class="outer" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          <!-- Brand bar — same as the site's Navbar: 56px orange bar, 28px
               white logo, 20px bold wordmark. -->
          <tr>
            <td bgcolor="${ORANGE}" class="brand" style="background-color:${ORANGE};border-radius:${CARD_RADIUS} ${CARD_RADIUS} 0 0;padding:14px 24px;">
              <a href="${e(siteUrl)}" style="text-decoration:none;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:8px;">
                      <img src="${e(siteUrl + LOGO_PATH)}" width="28" height="28" alt=""
                        style="display:block;width:28px;height:28px;border:0;" />
                    </td>
                    <td valign="middle" class="wordmark" style="font-family:${FONT_DISPLAY};font-size:20px;line-height:28px;font-weight:700;letter-spacing:-0.025em;color:#FFFFFF;">Why Is It NOT Possible?</td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          <!-- Article card -->
          <tr>
            <td style="background-color:#FFFFFF;border:1px solid ${BORDER};border-top:0;border-radius:0 0 ${CARD_RADIUS} ${CARD_RADIUS};overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${heroRow}
                <tr>
                  <td class="pad intro" style="padding:28px 28px 24px 28px;">
                    <p style="margin:0 0 18px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${MUTED};">New from ${e(author.name)}</p>
                    ${categoryLine}
                    <h1 class="title" style="margin:0 0 12px 0;font-family:${FONT_DISPLAY};font-size:30px;line-height:36px;font-weight:700;color:${INK};">
                      <a href="${e(postUrl)}" style="color:${INK};text-decoration:none;">${e(post.title)}</a>
                    </h1>
                    ${summaryLine}
                    ${bylineRow}
                  </td>
                </tr>
                ${teaserBlock}
                <tr>
                  <td class="pad" style="padding:${teaser.length ? "4px" : "0"} 28px 28px 28px;">
                    ${button(postUrl, teaser.length ? "Continue reading &rarr;" : "Read the article &rarr;")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${relatedBlock}
          <!-- Footer -->
          <tr>
            <td style="padding:24px 8px 0 8px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};text-align:center;">
              You're receiving this email because you follow ${e(author.name)} on Why Is It NOT Possible?<br />
              <a href="${e(preferencesUrl)}" style="color:${MUTED};text-decoration:underline;">Manage notification preferences</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
