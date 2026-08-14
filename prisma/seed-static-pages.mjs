// One-off seed script: populates the StaticPage table (About, Contact,
// Privacy Policy, Terms of Service) with their initial content, so the
// admin console has something real to edit instead of an empty row. Safe
// to re-run — each page is upserted by slug, and `update: {}` means it
// won't clobber content an admin has since edited.
//
// Run with: node prisma/seed-static-pages.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const pages = [
  {
    slug: "about",
    title: "About",
    content: `
<p>The story behind the questions we keep asking.</p>
<p>Why Is It NOT Possible? is a home for a very specific kind of curiosity: not "what's possible," but the more interesting question of what isn't — and why. Every record that may never be broken, every movie-screen stunt that couldn't survive contact with real physics, every "why can't we just build that" idea, has a reason behind it. We go looking for that reason.</p>
<p>The articles here walk through the physics, biology, engineering, rules, and plain hard logic that put a ceiling on human performance, technology, and imagination — across science, technology, sports, and movies &amp; music. The goal isn't to be a killjoy about it. It's to make the boundary itself the interesting part: understanding a limit usually teaches you more than celebrating a record ever does.</p>
<p>We try to write about it the way we'd want to read it — grounded in evidence and reasoning, explained simply, without dumbing it down.</p>
`.trim(),
  },
  {
    slug: "contact",
    title: "Contact",
    content: `
<p>Article suggestions, feedback, corrections, or anything else — we'd like to hear it. Email is the fastest way to reach the team behind the site.</p>
<p><strong>Email:</strong> <a href="mailto:whyisitnotpossible2020@gmail.com">whyisitnotpossible2020@gmail.com</a></p>
`.trim(),
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    content: `
<p>This policy explains what information Why Is It NOT Possible? collects when you use the site, why we collect it, and the choices you have. It's written in plain language on purpose — if anything here is unclear, reach out and we'll clarify it.</p>

<h2>Information we collect</h2>
<p>We collect information in three ways: what you give us, what you create, and what your browser sends automatically.</p>
<ul>
<li><strong>Account information.</strong> When you register, we store your username, email address, and a securely hashed password. You can optionally add a display name, a short bio, and an avatar image URL.</li>
<li><strong>Content you create.</strong> Posts, comments, likes, bookmarks, follows, and any reports you submit are stored against your account so the site can display and attribute them correctly.</li>
<li><strong>Uploaded images.</strong> Cover images and in-post images you upload are stored with our cloud storage provider and served back through the site.</li>
<li><strong>Session data.</strong> A session cookie keeps you signed in between visits. We don't use it to track you across other websites.</li>
</ul>
<p>We don't run third-party analytics or advertising scripts on this site, so there's no ad network or analytics vendor collecting data about your visit here.</p>

<h2>How we use it</h2>
<ul>
<li>To operate your account and show your content on the site.</li>
<li>To send you email if you've followed an author and turned on notifications for new posts — you can turn this off per-author or globally at any time in Settings.</li>
<li>To review reported content and enforce our community standards.</li>
<li>To keep the site secure — for example, rate-limiting suspicious activity.</li>
</ul>
<p>We don't sell your personal information, and we don't share it with third parties for their own marketing purposes.</p>

<h2>Cookies</h2>
<p>We use a single session cookie required for you to stay logged in. It's not used for advertising or cross-site tracking. Blocking it in your browser will simply sign you out.</p>

<h2>How long we keep your data</h2>
<p>We keep your account and content for as long as your account is active. If you'd like your account deleted, contact us and we'll remove your account information; some content may be retained in an anonymized or moderation-log form where needed for the integrity of the site (for example, records of removed content that violated our terms).</p>

<h2>Your choices</h2>
<ul>
<li>Update your profile, bio, and avatar at any time from Settings.</li>
<li>Control per-author and global email notification preferences from Settings.</li>
<li>Request a copy of, correction to, or deletion of your personal information by contacting us.</li>
</ul>

<h2>Children's privacy</h2>
<p>This site is not directed at children under 13, and we don't knowingly collect information from them.</p>

<h2>Changes to this policy</h2>
<p>If we make material changes to this policy, we'll update the date at the top of this page. Continued use of the site after a change means you accept the updated policy.</p>

<h2>Contact</h2>
<p>Questions about this policy or your data? Reach out through the site's contact channel and we'll get back to you.</p>
`.trim(),
  },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    content: `
<p>These terms govern your use of Why Is It NOT Possible?. By creating an account or otherwise using the site, you agree to them. If you don't agree, please don't use the site.</p>

<h2>Your account</h2>
<p>You're responsible for keeping your login credentials secure and for anything that happens under your account. Let us know right away if you believe your account has been compromised. You must provide accurate registration information and keep it up to date.</p>

<h2>Content you post</h2>
<p>You keep ownership of anything you post — articles, comments, images, and so on. By posting it, you give us a license to host, display, and distribute it as part of running the site. You're responsible for having the rights to anything you upload, and for making sure it doesn't infringe someone else's rights or break the law.</p>
<p>We may remove content, or restrict or suspend an account, that:</p>
<ul>
<li>Is illegal, harassing, hateful, or deliberately misleading;</li>
<li>Infringes someone else's intellectual property or privacy;</li>
<li>Is spam, or manipulates the site's ranking or engagement features;</li>
<li>Otherwise violates these terms or puts the site or its users at risk.</li>
</ul>
<p>If you believe a piece of content violates these terms, you can report it directly from the post, and our moderation team will review it.</p>

<h2>Content is informational, not professional advice</h2>
<p>Articles on this site explore why certain records, feats, or ideas are difficult or unlikely in the real world. They're written for general interest and education, based on the evidence, reasoning, and editorial judgment available at the time — not as scientific, medical, financial, or other professional advice. We try to keep things accurate, but we don't guarantee that every detail is complete, current, or error-free, and opinions or predictions in an article are the author's own. Verify anything important against an authoritative source before relying on it.</p>

<h2>Acceptable use</h2>
<p>You agree not to:</p>
<ul>
<li>Attempt to gain unauthorized access to any part of the site or another user's account;</li>
<li>Interfere with the site's normal operation, including by circumventing rate limits or automated abuse protections;</li>
<li>Scrape or bulk-collect content from the site without permission;</li>
<li>Use the site to distribute malware or engage in fraud.</li>
</ul>

<h2>Intellectual property</h2>
<p>The site's name, logo, design, and original editorial content are owned by Why Is It NOT Possible? (or used under license) and are protected by applicable intellectual property law. Nothing in these terms transfers that ownership to you.</p>

<h2>Third-party links</h2>
<p>Articles or comments may link to third-party sites. We don't control and aren't responsible for their content or practices — visiting them is at your own discretion.</p>

<h2>Disclaimer and limitation of liability</h2>
<p>The site is provided "as is," without warranties of any kind, express or implied. To the fullest extent permitted by law, Why Is It NOT Possible? isn't liable for any indirect, incidental, or consequential damages arising from your use of the site.</p>

<h2>Changes to these terms</h2>
<p>We may update these terms from time to time. If we make a material change, we'll update the date at the top of this page. Continuing to use the site after a change means you accept the updated terms.</p>

<h2>Contact</h2>
<p>Questions about these terms? Reach out through the site's contact channel and we'll get back to you.</p>
`.trim(),
  },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const page of pages) {
    const existing = await prisma.staticPage.findUnique({ where: { slug: page.slug } });
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: page,
    });
    if (existing) {
      skipped++;
    } else {
      created++;
    }
  }

  console.log(`Static pages: ${created} created, ${skipped} already present.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
