import { describe, it, expect } from "vitest";
import { buildNewPostEmail, articleTeaser } from "./new-post-email.js";

const SITE = "https://whyisitnotpossible.com";
const author = { name: "Editorial" };

const basePost = {
  slug: "perpetual-motion",
  title: "Why Is It Not Possible to Build a Perpetual Motion Machine?",
  subtitle: "Can a machine keep running forever?",
  excerpt: null,
  content: "<p>First paragraph of the article.</p><h2>Heading</h2><p>Second &amp; final paragraph.</p>",
  coverImageUrl: "https://cdn.example/post.jpg",
  readingTime: 8,
  category: { name: "Science", slug: "science", coverImageUrl: "https://cdn.example/science.jpg" },
};

describe("buildNewPostEmail", () => {
  it("uses the post's cover as the hero image, linked to the post", () => {
    const { html } = buildNewPostEmail({ author, post: basePost, siteUrl: SITE });
    expect(html).toContain('src="https://cdn.example/post.jpg"');
    expect(html).toContain(`href="${SITE}/blog/perpetual-motion"`);
    expect(html).toContain("8 min read");
    expect(html).toContain(`href="${SITE}/category/science"`);
  });

  it("falls back to the category cover when the post has none", () => {
    const { html } = buildNewPostEmail({ author, post: { ...basePost, coverImageUrl: null }, siteUrl: SITE });
    expect(html).toContain('src="https://cdn.example/science.jpg"');
  });

  it("omits the hero entirely when there is no image at all", () => {
    const { html } = buildNewPostEmail({
      author,
      post: { ...basePost, coverImageUrl: null, category: { name: "Science", slug: "science", coverImageUrl: null } },
      siteUrl: SITE,
    });
    // Only the header logo remains — no hero image.
    expect(html.match(/<img\b/g)).toHaveLength(1);
    expect(html).toContain(`src="${SITE}/email-logo-on-brand.png"`);
  });

  it("makes legacy relative image paths absolute (email has no base URL)", () => {
    const { html } = buildNewPostEmail({
      author: { name: "Editorial", avatarUrl: "/api/uploads/me.png" },
      post: { ...basePost, coverImageUrl: "/api/uploads/old.png" },
      siteUrl: SITE,
    });
    expect(html).toContain(`src="${SITE}/api/uploads/old.png"`);
    expect(html).toContain(`src="${SITE}/api/uploads/me.png"`);
  });

  it("shows only the article's opening paragraph and a continue-reading button", () => {
    const { html, text } = buildNewPostEmail({ author, post: basePost, siteUrl: SITE });
    expect(html).toContain("First paragraph of the article.");
    expect(html).not.toContain("Second &amp; final paragraph.");
    expect(html).not.toContain("Heading");
    expect(html).toContain("Continue reading &rarr;");
    expect(text).toContain(`Continue reading: ${SITE}/blog/perpetual-motion`);
  });

  it("lists up to three related posts under 'More from <category>'", () => {
    const related = [1, 2, 3, 4].map((n) => ({ slug: `rel-${n}`, title: `Related ${n}`, coverImageUrl: null, readingTime: n }));
    const { html, text } = buildNewPostEmail({ author, post: basePost, related, siteUrl: SITE });
    expect(html).toContain("More from");
    expect(html).toContain(`href="${SITE}/blog/rel-3"`);
    expect(html).not.toContain("rel-4");
    expect(text).toContain(`- Related 1: ${SITE}/blog/rel-1`);
  });

  it("uses author initials when there is no avatar", () => {
    const { html } = buildNewPostEmail({ author: { name: "Why Is It NOT Possible? Editorial" }, post: basePost, siteUrl: SITE });
    expect(html).toContain(">WI</td>");
  });

  it("escapes user-written text so it can't break or inject markup", () => {
    const { html, text } = buildNewPostEmail({
      author: { name: "Tom & <Jerry>" },
      post: { ...basePost, title: 'Fast > "slow" <script>alert(1)</script>' },
      siteUrl: SITE,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("Tom &amp; &lt;Jerry&gt;");
    expect(html).toContain("Fast &gt; &quot;slow&quot; &lt;script&gt;");
    // The plain-text part is not HTML, so it keeps the original characters.
    expect(text).toContain('Fast > "slow"');
  });

  it("includes the unsubscribe info and keeps the subject format", () => {
    const { text, subject } = buildNewPostEmail({ author, post: basePost, siteUrl: SITE });
    expect(subject).toBe(`Editorial published a new post: ${basePost.title}`);
    expect(text).toContain(`${SITE}/settings?tab=notifications`);
  });
});

describe("articleTeaser", () => {
  it("decodes entities and strips inline tags", () => {
    expect(articleTeaser('<p>It&#8217;s <a href="x">fast</a> &amp; light&nbsp;now.</p>')).toEqual(["It’s fast & light now."]);
  });

  it("cuts the last paragraph at a word boundary with an ellipsis", () => {
    const long = "word ".repeat(200).trim();
    const [p] = articleTeaser(`<p>${long}</p>`, 100);
    expect(p.endsWith("word…")).toBe(true);
    expect(p.length).toBeLessThanOrEqual(101);
  });

  it("returns nothing for empty content", () => {
    expect(articleTeaser("")).toEqual([]);
    expect(articleTeaser(null)).toEqual([]);
  });
});
