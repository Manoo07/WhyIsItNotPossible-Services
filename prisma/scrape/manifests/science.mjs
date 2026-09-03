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
  "https://whyisitnotpossible.com/why-humans-cannot-survive-without-sleep/",
  "https://whyisitnotpossible.com/why-cant-humans-run-100-kmh/",
  "https://whyisitnotpossible.com/why-cant-humans-see-infrared-or-ultraviolet/",
  "https://whyisitnotpossible.com/why-cant-humans-live-for-200-years/",
  "https://whyisitnotpossible.com/why-time-travel-to-the-past-is-probably-impossible/",
  "https://whyisitnotpossible.com/hack-the-human-brain-like-a-computer/",
  "https://whyisitnotpossible.com/why-we-cant-see-the-entire-universe/",
  "https://whyisitnotpossible.com/why-cameras-cannot-capture-the-world/",
  "https://whyisitnotpossible.com/why-humans-cant-survive-on-mars-without-domes/",
  "https://whyisitnotpossible.com/why-landing-on-the-sun-is-impossible/",
  "https://whyisitnotpossible.com/solar-panel-efficiency-100-percent-impossible/",
  "https://whyisitnotpossible.com/why-impossible-remember-every-moment-life/",
  "https://whyisitnotpossible.com/100-percent-of-fuel-energy-into-work/",
  "https://whyisitnotpossible.com/why-true-multitasking-is-not-possible/",
  "https://whyisitnotpossible.com/why-teleportation-is-impossible/",
  "https://whyisitnotpossible.com/faster-than-light-travel-impossible/",
  "https://whyisitnotpossible.com/why-flying-like-superheroes-is-impossible/",
];
