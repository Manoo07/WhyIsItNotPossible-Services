// Current live URLs — most of these were renamed on whyisitnotpossible.com
// after the original (hand-typed, not scraped) import in seed-science.mjs.
// This manifest lets `run.mjs science` and `run.mjs science --update` use
// the same real scrape pipeline the other categories already use, instead
// of that one-off hardcoded seed.
//
// NOTE: this DB's dev copy already has these 17 posts under their OLD
// (pre-rename) slugs, refreshed in place by refresh-science.mjs — running
// `run.mjs science` here would create 17 duplicates under the new slugs,
// since matching is by slug. This manifest is for bootstrapping a database
// that doesn't have them yet (e.g. production) from a clean slate.
export const categoryMeta = {
  name: "Science",
  slug: "science",
  description: "The hard limits of biology, physics, and the human body.",
};

export const urls = [
  "https://sandybrown-dotterel-689149.hostingersite.com/why-humans-cannot-survive-without-sleep/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-cant-humans-run-100-kmh/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-cant-humans-see-infrared-or-ultraviolet/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-cant-humans-live-for-200-years/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-time-travel-to-the-past-is-probably-impossible/",
  "https://sandybrown-dotterel-689149.hostingersite.com/hack-the-human-brain-like-a-computer/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-we-cant-see-the-entire-universe/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-cameras-cannot-capture-the-world/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-humans-cant-survive-on-mars-without-domes/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-landing-on-the-sun-is-impossible/",
  "https://sandybrown-dotterel-689149.hostingersite.com/solar-panel-efficiency-100-percent-impossible/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-impossible-remember-every-moment-life/",
  "https://sandybrown-dotterel-689149.hostingersite.com/100-percent-of-fuel-energy-into-work/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-true-multitasking-is-not-possible/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-teleportation-is-impossible/",
  "https://sandybrown-dotterel-689149.hostingersite.com/faster-than-light-travel-impossible/",
  "https://sandybrown-dotterel-689149.hostingersite.com/why-flying-like-superheroes-is-impossible/",
];
