// One-off seed script: imports the 17 Science articles scraped from
// whyisitnotpossible.com into the local Postgres DB via Prisma Client
// directly — no HTTP calls to the running backend, just a local DB write.
//
// Run with: node prisma/seed-science.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function estimateReadingTime(htmlContent) {
  const text = htmlContent.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Body markup convention: blank-line-separated paragraphs; lines starting
// with "## " become <h2>, "### " become <h3>.
function bodyToHtml(raw) {
  const blocks = raw
    .trim()
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      if (block.startsWith("### ")) return `<h3>${escapeHtml(block.slice(4).trim())}</h3>`;
      if (block.startsWith("## ")) return `<h2>${escapeHtml(block.slice(3).trim())}</h2>`;
      return `<p>${escapeHtml(block.replace(/\s*\n\s*/g, " ").trim())}</p>`;
    })
    .join("");
}

const articles = [
  {
    title: "Why Humans Cannot Survive Without Sleep",
    subtitle: "Sleep is not empty time — it's the body's essential night shift for survival.",
    tags: ["Health", "Human Body", "Human Limits", "Neuroscience", "Sleep"],
    body: `
Sleep looks like a pause. That is the mistake. From the outside, a sleeping person seems to be doing nothing. No talking, no work, almost no movement except breathing. It feels like the body has simply switched off for a few hours.

Inside, though, the body is anything but idle. The brain sorts information, the immune system adjusts, hormones shift, tissues repair, and waste products are cleared.

Sleep is not empty time. It is the body protecting itself from collapse. That is why humans cannot simply "adapt" to life without sleep. We can skip a meal and survive. We can lose one night of sleep and still drag ourselves through the next day. But if sleep is removed again and again, the system starts breaking in places willpower cannot reach.

## Sleep Is Not Just Rest

Rest reduces effort. Sleep changes the body's operating mode. During sleep, the brain does not go silent. It shifts into a different rhythm, moving through lighter sleep, deep sleep, and REM sleep — each stage serving a different biological purpose.

Deep sleep is strongly linked with physical recovery: heart rate slows, blood pressure drops, and growth and repair processes become more active. REM works differently — the brain becomes highly active, and this stage is most closely connected with dreaming, memory processing, emotional regulation, and learning.

## The Brain Needs Sleep to Clean Itself

The brain is one of the most energy-hungry organs in the body, and while it works, it produces waste. During sleep, fluid movement around brain cells — the glymphatic system — appears to help clear those leftovers from waking hours.

If that cleaning window keeps getting cut short, the brain pays for it. Focus drops. Memory becomes weaker. Reaction time slows. Sleep loss does not just make a person "tired." It makes the brain less reliable.

## Memory Depends on Sleep

A full day throws too much information at the brain, and sleep helps sort what matters from what does not. Learning does not end when the book closes — a major part of it happens later, when the brain strengthens useful memories and connects them with older knowledge.

## The Body Repairs Itself at Night

Sleep is not only about the brain. Muscles recover, tissues rebuild, hormones shift, and the immune system adjusts its response. Every day leaves damage at a microscopic level, and sleep gives the body a chance to deal with it before the next day begins.

## Sleep Protects Emotional Control

One of the first things sleep loss hits is emotional control. Small problems feel larger, stress becomes harder to manage, and the brain loses some of its normal brake system. A tired brain does not only think slower — it feels the world differently.

## What Happens When Sleep Is Removed?

One bad night is enough to show a visible cost: attention drops, memory weakens, reflexes slow. After repeated sleep loss, the immune system weakens, blood pressure can rise, and the risk of long-term health problems increases.

The body has no clean replacement for sleep. Caffeine can hide tiredness for a while — it cannot clean the brain.

## Why We Cannot Evolve Past Sleep

A sleeping animal cannot hunt, defend itself, or search for food, so sleep looks like a design flaw. But evolution kept it anyway, because the cost of not sleeping is even worse.

## Final Takeaway

Sleep is not laziness or wasted time. It is the body's night shift — when the brain clears waste, the body repairs damage, memories settle, and the immune system regains strength. That is why humans cannot live without it.
`,
  },
  {
    title: "Why Faster-Than-Light Travel Is Probably Impossible",
    subtitle: "Physics built into space, time, matter and energy makes light speed an absolute limit, not an engineering problem.",
    tags: ["Faster Than Light Travel", "Physics Limits", "Relativity", "Science", "Space Travel"],
    body: `
Faster-than-light travel sounds simple in science fiction: build a better engine, find a stronger fuel and keep accelerating. Physics does not work that way. The speed of light is not a limit caused by weak engines or poor technology — it is built into the relationship between space, time, matter and energy.

In a vacuum, light travels at exactly 299,792,458 metres per second. Massless particles move at that speed; objects with mass can only approach it.

## Light Speed Is Not an Engineering Record

Light speed in a vacuum remains the same for every observer, regardless of how fast the observer or the source is moving. This is one of the basic rules of Einstein's special theory of relativity. A spacecraft can keep accelerating and get closer to light speed, but it can never close the final gap.

## The Energy Requirement Keeps Rising

As an object with mass approaches light speed, each further increase in speed requires far more energy. Particle accelerators show this: scientists can push tiny particles extremely close to light speed, but adding more energy produces only a tiny increase in speed. Reaching light speed would require an unlimited amount of energy.

## Travelling Close to Light Speed Is Still Possible

Relativity still allows a spacecraft to travel extremely close to light speed. For the crew, time would pass more slowly than on Earth — time dilation, an effect measured in experiments. But the spacecraft would still lose a race against a beam of light, and travelling that fast would create serious engineering problems of its own, from dust impacts to radiation.

## Faster-Than-Light Travel Can Reverse Cause and Effect

Faster-than-light travel would interfere with causality — the rule that a cause must happen before its effect. Allow faster-than-light communication, and a signal could arrive before it was sent, or a reply could arrive before the original message.

## Could a Warp Drive Avoid the Limit?

A warp drive would not accelerate a ship through space beyond light speed — instead it would compress spacetime in front of the ship and expand it behind. General relativity contains mathematical solutions that resemble this idea, like the Alcubierre warp metric, but writing down a possible spacetime shape is not the same as building it. No one knows how to create such a bubble, steer it, or stop it at a destination.

## Wormholes Have Similar Problems

General relativity allows wormhole-like solutions, but no traversable wormhole has ever been observed. Many models require negative energy or exotic matter to keep one stable, and wormholes can also be turned into theoretical time machines, running into the same causality problem.

## Quantum Entanglement Does Not Provide a Shortcut

Measurements of entangled particles can produce correlations that appear immediately, but those correlations cannot be used to send a controlled message faster than light — the results still have to be compared through ordinary communication.

## A Better Engine Would Not Be Enough

Near-light-speed travel may be possible one day. Faster-than-light travel is another matter: current physics gives us no way past the energy limit or the causality problem. Unless new evidence changes that, light speed remains the limit.
`,
  },
  {
    title: "Why Can't Humans Run 100 km/h? The Biological and Physics Limits Explained",
    subtitle: "Biological and physics limits prevent humans from reaching speeds more than twice as fast as current records.",
    tags: ["Human Limits", "Human Speed", "Physics Limits", "Running", "Sports Science"],
    body: `
Could humans run 100 km/h if training, shoes and tracks kept improving? The numbers say no. At 100 km/h, 100 metres would be gone in 3.6 seconds. Usain Bolt's 9.58-second world record is astonishing, but his top speed during that race was about 44.7 km/h — a runner would have to move more than twice as fast as the fastest human ever measured.

## Where the Stride Starts to Fail

A sprinter can go faster only by taking longer steps, taking them more often, or some balance of both — and each improvement works against the other. At 100 km/h, the foot would be gone almost as soon as it landed, leaving the muscles too little time to produce force for the next stride, and the leg would still have to stop, reverse direction, and swing forward again faster than human legs can manage.

## Why More Strength Would Not Solve It

More muscle or stronger bones create another problem: weight. Thicker bones and larger muscles make the legs harder to swing, not easier. A cheetah solves the problem with four limbs and a flexible spine; humans run upright with far less movement through the back.

## The Legs Reach Their Limit First

At 100 km/h a runner would face roughly five times the drag Bolt faced at his peak. But the lungs would not fail first — a 100-metre sprint relies on energy already stored in the muscles, so the decisive problem is mechanical: the feet cannot stay on the ground long enough, and the legs cannot cycle fast enough.

## Could Humans Run 100 km/h Someday?

Training methods improve, tracks become quicker, and shoes return energy more efficiently, but those gains are measured in fractions of a second. Biomechanist Peter Weyand has suggested humans might theoretically reach somewhere around 56 to 64 km/h under ideal conditions — well short of 100.

## Final Takeaway

Records may fall, but 100 km/h is not simply a distant version of today's sprinting. Reaching it would mean changing the body itself, not merely improving the runner.
`,
  },
  {
    title: "Why We Can't Hack the Human Brain Like a Computer",
    subtitle: "The brain is a living organ, not software — memories aren't files, and minds can't be copied like data.",
    tags: ["Brain Technology", "Human Brain", "Human Limits", "Neuroscience", "Technology Limits"],
    body: `
## The Brain Is Not Computer Software

Computers deliver predictable outputs, whereas individuals may interpret identical information differently based on mood, stress, fatigue, or prior experiences. Experience physically reshapes neural connections — learning, habits, trauma, and prolonged stress all modify these pathways.

## Memories Are Not Stored as Files

Memories don't exist as complete recordings in a single brain location. A single memory incorporates visual imagery, auditory elements, emotional responses, and later-added significance, and during recall the brain reconstructs these components — not always precisely. No standardized memory format exists for transfer between individuals.

## Why 86 Billion Neurons Is Only Part of the Problem

The human brain contains about 86 billion neurons, yet the real challenge involves their interconnections, which continuously strengthen, weaken, emerge, and disappear. This ongoing transformation, called neuroplasticity, means brain scans capture only partial information.

## The Brain Also Depends on Chemistry and the Body

Brain function isn't purely electrical. Neurons employ chemical messengers, hormones influence behavior and mood, and bodily signals modify attention and emotion. Thoughts and emotions develop through activity spanning the entire brain and body.

## What Brain-Computer Interfaces Can Actually Do

Brain-computer interfaces currently assist some paralyzed individuals with cursor movement, letter selection, or device control, and deep brain stimulation alleviates symptoms in certain neurological disorders. These systems target narrow, specific tasks — nowhere close to reading or managing an entire mind.

## Why Mind Uploading Is Still Science Fiction

Serious mind uploading would require capturing far more than brain wiring — recording neural activity, chemical changes, and connections as they transform continuously. Even if such replication succeeded, would it be the original individual or a new system with identical memories? The biological person would persist independently.

## There Is No Single Entry Point to the Mind

Computers possess identifiable storage areas, passwords, and ports. The brain lacks equivalents — memories, emotions, and decisions involve multiple regions functioning together, and modifying one region's activity can unexpectedly influence other functions.

## Final Takeaway

Brain implants currently help individuals communicate or control devices, yet this differs fundamentally from accessing and editing a mind. Contemporary science cannot duplicate, eliminate, or rewrite an entire human mind.
`,
  },
  {
    title: "Why Can't Humans See Infrared or Ultraviolet?",
    subtitle: "",
    tags: ["Human Limits", "Human Vision", "Infrared Light", "Science", "Ultraviolet Light"],
    body: `
## What Human Eyes Can Detect

Human eyes typically respond to wavelengths from about 380 to 700 nanometres, with violet at one end and red at the other. Ultraviolet exists beyond violet, while infrared lies beyond red. At the eye's rear, rods and cones contain visual pigments that absorb photons and convert light into neural signals — but most infrared wavelengths lack sufficient photon energy to trigger that reaction.

## Why Ultraviolet Is Filtered Out

The primary barrier to ultraviolet detection isn't the retina but the eye's front surface. The cornea and natural lens absorb almost all UV before it reaches the photoreceptors — a filtering mechanism that also protects the eye, since ultraviolet damages living tissue.

## Why Infrared Feels Like Heat

Objects emit thermal radiation primarily in the infrared range. This radiation warms skin, yet thermoreceptors detect temperature changes rather than creating infrared imagery. Thermal cameras use specialised sensors calibrated for these wavelengths to visualise warm objects in darkness — something the human eye simply cannot do.
`,
  },
  {
    title: "Why Can't Humans Live for 200 Years? (Biological Limits of Lifespan)",
    subtitle: "The body repairs itself daily but accumulates damage everywhere simultaneously — in DNA, cells, organs, and the brain — making extended lifespans biologically implausible.",
    tags: ["Aging", "Biology", "Human Lifespan", "Human Limits", "Longevity"],
    body: `
The body constantly undergoes self-repair yet remains imperfect. Minor cellular errors persist and compound over decades.

## Your Cells Cannot Divide Forever

Cells that divide to replace damaged tissue eventually reach limits. Telomeres — protective chromosome endings — shorten with each division, and once too short, cells stop dividing or die, reducing tissue renewal. This same mechanism guards against uncontrolled cancer growth.

## Damage Builds Up Every Day

Cellular injury occurs continuously from sunlight, pollution, metabolic waste, copying mistakes, and misfolded proteins. While the body repairs much of it, some persists — and beyond age 100, maintaining system stability becomes increasingly difficult.

## Some Parts of the Body Do Not Reset

Medicine can replace certain components like heart valves, kidneys, and joints, but most body systems resist complete replacement. Neurons are not replaced like skin cells, and the networks supporting memory and identity develop over a lifetime.

## Energy Itself Has a Price

Mitochondria generate cellular energy inefficiently, creating oxidative stress over time. Damaged mitochondria reduce cellular efficiency, establishing a paradox where survival mechanisms contribute to aging damage.

## Cancer Becomes Harder to Avoid

Extended lifespans increase cellular mutation accumulation. While most mutations prove harmless or get repaired, prolonged living escalates cancer probability, and the body must balance tissue renewal against dangerous cellular proliferation.

## Why 120 to 150 Years Is Already Extreme

Jeanne Calment holds the verified lifespan record at 122 years, 164 days. Scientific models suggest biological ceilings around 120-150 years, as bodies progressively lose stress recovery capacity.

## Evolution Did Not Build Us for 200 Years

Evolution prioritizes reproductive success and offspring survival, not indefinite longevity. Human biology comprises competing compromises where enhanced cancer protection reduces renewal, while increased renewal elevates cancer risk.

## Final Takeaway

Aging represents many small failures piling up together rather than a single catastrophic failure. A 200-year existence would require solving multiple interconnected biological problems simultaneously.
`,
  },
  {
    title: "Why You Can't Truly Multitask And What Your Brain Does Instead",
    subtitle: "",
    tags: ["Focus", "Human Brain", "Human Limits", "Multitasking"],
    body: `
True multitasking is not possible, but it feels real because we experience it every day. The human brain can move between demanding tasks quickly, but it cannot give both tasks full attention at the same moment. What we call multitasking is usually fast task switching.

## The Multitasking Myth

The confusion begins because switching is fast — you glance at a notification, return to a paragraph, answer someone, and continue as if the focus was never broken. When two serious tasks compete, attention has to move away from one of them.

## What the Brain Actually Does

Each switch forces a small reset. The mind leaves one thread, picks up another, and then has to find its way back. Notifications, tab changes and quick replies keep interrupting that rhythm, which is why you sometimes need a few seconds to remember where you stopped.

## Why Multitasking Makes Work Slower

Focused work builds momentum — once the mind settles, details stay longer and ideas connect more naturally. Multitasking breaks that rhythm too early, and the real loss is the effort needed to regain the same focus.

## Why Mistakes Increase

Mistakes become more likely when attention keeps breaking. Serious work needs continuity, and if that continuity keeps breaking, accuracy naturally falls.

## Why It Feels So Tiring

Multitasking is tiring because switching is work. The mind is managing distractions, unfinished thoughts, and the constant return to where it stopped — that is why a day full of messages and half-finished tasks can feel exhausting even without hard physical work.

## Why the Brain Cannot Truly Multitask

Executive control, the brain's system for handling goals, distractions and working memory, has limits — it cannot give every demand the same priority at once. This is not a discipline problem; it is built into attention itself.

## When Doing Two Things Works

Some combinations work, like walking while talking, because one task is mostly automatic. The brain can pair an automatic action with another activity, but it cannot give full attention to two complex tasks at the same time.

## The Better Way to Work

The better answer is not extreme discipline but fewer interruptions. For many people, a focused block of 25 to 50 minutes is more useful than two distracted hours.

## Final Takeaway

True multitasking is usually fast switching mistaken for doing everything at once. Serious work still asks for one clear stretch of attention.
`,
  },
  {
    title: "Why We Can't Remember Every Moment of Our Life",
    subtitle: "",
    tags: ["Brain Science", "Human Limits", "Human Memory", "Neuroscience", "Psychology"],
    body: `
It is impossible to remember every moment of our life. Most moments are too ordinary to stay. We usually talk about memory as if the mind keeps a private recording. It does not — memory is closer to a rough note than a video file.

## The Brain Throws Away More Than It Keeps

The brain cannot treat every detail as important. Keeping all of it would only slow the mind down. The brain does not store life like files on a hard drive — it keeps what may matter later, and the weaker details fade.

## Memory Gets Rebuilt

We think we replay the past. Most of the time, we rebuild it, pulling together fragments — a place, a face, a feeling, a few details — sometimes borrowing from nearby memories without noticing. Every recall can change a memory slightly.

## The Brain Also Cleans Itself Up

From childhood onward, the brain keeps changing its connections. Pathways used often get stronger; others weaken and are trimmed. Without that cleanup, the mind would be full of noise.

## What You Notice Has a Better Chance

Many moments are forgotten because we never properly noticed them in the first place. Memory often begins with attention — if a moment entered weakly, it usually stays weak. Emotion helps a moment stick.

## The Body Puts a Limit on Memory Too

Even with training and memory tricks, perfect recall is not possible. Neurons have limits, synapses change, and chemistry affects what stays and what comes back. Even people with unusually strong autobiographical memory still forget and misremember.

## Final Takeaway

We can't remember every moment because the brain does not keep life as a full recording. Forgetting is not always failure — sometimes it is what keeps memory useful.
`,
  },
  {
    title: "Why Cameras Cannot Capture the World Exactly as Human Eyes See It",
    subtitle: "Vision is not a single fixed exposure — eyes continuously adapt while cameras record limited moments.",
    tags: ["Camera", "Digital Cameras", "Dynamic Range", "Human Vision", "Photography"],
    body: `
Cameras cannot capture the world exactly as human eyes see it because vision is not a single fixed exposure. Stand inside a dim room on a bright afternoon and look through the window — you can see the furniture around you and also the clouds outside. Take a photograph from the same position, though, and you will have to choose what to expose for.

## Why Cameras Cannot Capture the World Exactly

A digital sensor measures the light that reaches each part of its surface, and software then adjusts colour, noise, sharpness and contrast. But the sensor does not know what it is looking at — it cannot know that a face in shadow matters more than a bright cloud behind it.

## Human Vision Does Not Have Infinite Dynamic Range

At any one moment, very bright areas can overwhelm the eye and detail can disappear in deep shadow. Its much larger overall range comes from adaptation as lighting conditions change, not from handling everything at once.

## The Pupil Is Only the First Adjustment

The pupil narrows in bright light and expands in darkness, but this accounts for only part of the eye's adjustment — much of it happens in the photoreceptors and retinal circuits, which is why your eyes take a few minutes to adjust in a dark cinema.

## The Retina Adjusts to Local Contrast

The same amount of light can appear different depending on the brightness around it, which is one reason we can look from a shaded doorway towards a bright wall without the whole view suddenly appearing too dark or too bright.

## Only a Small Part of Our Vision Is Sharp

Fine detail is concentrated in the fovea, a small area near the centre of vision. Rapid eye movements called saccades bring different parts of the scene into sharp central vision without us noticing each jump.

## The Brain Does Not Build a Perfect Internal Photograph

The brain does not keep a complete, high-resolution record of everything we look at. What we notice depends on the task — a driver, a mechanic and a photographer can look at the same street and focus on completely different details.

## What HDR Can and Cannot Do

HDR combines different exposures so bright skies and dark foregrounds can both retain detail, but the result still has to fit within the brightness range of a screen, and the camera or editor must decide how bright the shadows and highlights should appear.

## Final Takeaway

A camera may capture more detail than the eye, but it cannot record exactly what mattered to the person who was standing there — that is why even an excellent photograph may not match the scene as we remember seeing it.
`,
  },
  {
    title: "Why Time Travel to the Past Is Probably Impossible",
    subtitle: "",
    tags: ["Physics Limits", "Relativity", "Science", "Space Time", "Time Travel"],
    body: `
In fiction, time travel to the past looks simple: build a machine, step inside, go back, and one small change rewrites everything that follows. Physics does not give the idea that much room.

Relativity allows a limited version of time travel — fast motion and strong gravity can make clocks disagree, so one observer can move into the future differently from another. The past is where the real trouble starts, because going backward would mean letting cause and effect run in the wrong order.

## The Core Truth

Future travel is about clocks running at different rates. Past travel is about something much harder: causes appearing after their effects. Once that happens, history is no longer a stable chain.

## Why Time Travel to the Past Breaks Causality

The grandfather paradox shows the danger clearly: if you erase the events that produced you, who exactly made the trip? Physicists have proposed self-consistent timelines and branching realities, but these ideas do not give us a working time machine.

## Wormholes Are Math, Not Machines

General relativity does contain strange mathematical paths, including closed timelike curves, but that does not mean nature lets us build or use them. A traversable wormhole would likely need exotic conditions, including negative energy, which we cannot create or control.

## Entropy Gives Time Its Everyday Direction

Ice melts, smoke spreads, bodies age, and broken things do not usually rebuild themselves. That one-way feeling is tied to entropy — going backward would mean fighting the direction real processes normally take.

## There Is No Evidence Anyone Has Done It

We have no confirmed traveller, no verified message from the future, and no experiment showing controllable travel into the past.

## The Universe May Protect History

Stephen Hawking called this the chronology protection conjecture — the idea that nature may stop time machines from forming in the first place. Closed time loops may become unstable before anyone can use them.

## Final Takeaway

The future is reachable — we move into it every second. The past is different: it is the chain of events that made the present possible. Time travel to the past may not be a technology problem at all. It may be impossible because cause and effect cannot simply break.
`,
  },
  {
    title: "Why Teleportation Is Impossible",
    subtitle: "The person who arrives may not be you.",
    tags: ["Physics Limits", "Quantum Physics", "Science", "Technology Limits", "Teleportation"],
    body: `
Step into a machine in Delhi. A second later, someone walks out in London with your face, your voice and every memory you had before the machine was switched on. Everyone calls it teleportation. But nothing may have travelled.

## A Body Cannot Simply Be Scanned and Rebuilt

A transporter would need more than a record of your body's shape — it would have to capture a living moment, blood moving, cells reacting, signals passing through the brain. The body changes continuously, and even a small mistake could alter a memory or damage a vital brain function.

## The Mind Is Not a File

A brain is not a hard drive. A memory depends on activity spread across different parts of the brain, and it is also affected by chemicals, hormones, sleep, pain and the condition of the rest of the body. Rebuilding the body would be only half the job.

## Quantum Teleportation Is Not the Movie Version

Quantum teleportation transfers information about the state of a quantum system — matter itself does not disappear from one place and reappear in another. The no-cloning theorem means an unknown quantum state cannot be copied perfectly while leaving the original untouched.

## The Copy Would Believe It Was You

The person in London would remember entering the machine in Delhi and would naturally believe the journey had worked — that is exactly what a perfect copy would say. If the original brain was destroyed in Delhi, its activity ended there.

## What If the Original Body Survived?

If the machine failed to destroy the body in Delhi, one version would remain there while another woke up in London — two people whose lives would immediately move in different directions. The transporter would not have moved one person between two places; it would have created a second person with the same past.

## Would a Wormhole Count as Real Teleportation?

A wormhole would avoid this identity problem because your actual body would pass through it, acting as a shortcut between distant points in space. The problem is that usable wormholes exist only in theory.

## Final Takeaway

Movie teleportation tries to solve distance by turning a human being into information. The machine could not prove that your own experience continued after the original brain was destroyed — it may create another version of you somewhere else. That does not mean the first one travelled.
`,
  },
  {
    title: "Why Flying Like Superheroes Is Physically Impossible",
    subtitle: "",
    tags: ["aerodynamics", "human flight", "Movie Science", "physics of flight", "superhero flight"],
    body: `
Flying like superheroes looks simple because films leave out everything that makes real flight possible. A person leaves the ground with no wings, rotor, runway or visible engine. Real flight is messier.

## Flight Needs an Upward Force

Gravity pulls the body downward — to hover, the upward force must at least equal the person's weight. Birds use wings, helicopters use rotors, and rockets push exhaust downward. A superhero has no such mechanism.

## The Human Body Is Not Built to Fly

Birds have large wings, light skeletons, powerful flight muscles and tails for control. Humans have arms, not wings — too small to create enough lift, while the torso and legs add weight and drag.

## Hovering Is the Most Unrealistic Part

To hold a person in the air, something must keep pushing air downward — that airflow would move dust, paper and nearby clothing, and a jet powerful enough to do it would also be loud and hot.

## Air Becomes a Problem at High Speed

At high speed, a bare face would be hit by powerful airflow, rain, dust and insects, making it difficult to see or breathe normally. A human body, with exposed limbs and loose clothing, is a poor shape for cutting through air.

## How Would the Body Turn?

Aircraft control pitch, roll and yaw with wings and control surfaces. A human body has none of those controls — a crosswind or small imbalance could make it roll or tumble.

## The Body Would Not Survive the Motion

Rapid changes in speed would put heavy forces on the body. Fighter pilots train for high-g conditions because acceleration can disturb blood flow, vision and consciousness.

## Landing Would Still Cause an Impact

A fast descent must be slowed before impact. If the force is strong enough to crack concrete, it also acts on the hero — that is why skydivers use parachutes and aircraft use landing gear.

## Energy Has to Come from Somewhere

Flight takes a lot of power. A person hovering or carrying someone would need far more power than the human body can produce, and any hidden power source would add weight that demands still more lift.

## Final Takeaway

Real flight needs lift, power, control and a way to slow down safely. A human body has none of those systems — we can build machines that carry people through the sky, but a person cannot simply rise and fly like a superhero.
`,
  },
  {
    title: "Why Solar Panels Can Never Convert 100% of Sunlight into Electricity",
    subtitle: "",
    tags: ["Energy Efficiency", "Physics Limits", "Renewable Energy", "Solar Energy", "Thermodynamics"],
    body: `
Most solar panels use silicon. When light reaches a silicon cell, it can knock electrons loose and start an electric current — but only if the photon carries enough energy, a minimum physicists call the bandgap. A photon above it can free an electron, but the cell cannot use all the extra energy, which is released as heat.

## Why One Layer Stops Near 33%

In 1961, physicists William Shockley and Hans Queisser calculated how well an ideal solar cell with one light-absorbing layer could perform. Even in their idealised model, the maximum efficiency was only about 33% — the Shockley–Queisser limit, one of the best-known limits on solar panel efficiency.

## More Layers Capture More Light

Stacking materials with different bandgaps lets each layer absorb a different part of the spectrum, which is why laboratory multijunction cells have exceeded 45% efficiency. But each added layer can reflect light, add resistance, or give electrons another chance to recombine — even a theoretical cell with many perfectly matched layers would remain below 100%.

## A Rooftop Panel Loses More

The theoretical limit applies to the cell itself. A finished panel loses more to reflection from the glass, metal contacts covering part of the surface, wiring resistance, and the inverter that converts direct current into usable electricity. Heat matters too — silicon loses voltage as its temperature rises.

## Why Solar Panel Efficiency Cannot Reach 100%

Researchers are developing tandem cells and new semiconductor materials to capture a larger share of sunlight, but they cannot make every part of sunlight equally useful. Solar panels can become much better than they are now. They cannot reach 100% efficiency because the remaining losses begin with the physics of light itself.
`,
  },
  {
    title: "Why No Engine Can Convert 100% of Fuel Energy into Work",
    subtitle: "",
    tags: ["Energy Efficiency", "Fuel Efficiency", "Physics Limits", "Science", "Thermodynamics"],
    body: `
Petrol, diesel and gas store chemical energy. When the fuel burns, the gases inside the engine become extremely hot and their pressure rises, pushing the pistons or turbine blades. The energy that is not turned into work leaves in the exhaust, warms the engine, or passes into the surroundings.

## Why Some Heat Must Leave the Engine

A heat engine needs a hot side and a cooler side, and it produces power while heat moves between them — but that temperature difference cannot last unless some heat is allowed to escape. The Second Law of Thermodynamics requires this; it is not a sign of poor engineering.

## Even an Ideal Engine Cannot Reach 100%

The Carnot engine is a theoretical model that sets the highest possible efficiency between a hot source and a cold sink, and even that completely reversible cycle falls short of 100%. Reaching 100% would require the cold side to be at absolute zero.

## Where the Rest of the Energy Goes

Real engines add losses of their own: hot exhaust carries energy away, the cooling system removes more heat, and friction in the bearings, seals and gears takes another share. Efficiency also changes with driving conditions.

## Can Waste Heat Be Recovered?

Some of it can — turbochargers use energy from the exhaust, and combined-cycle power plants use hot exhaust to make steam. But waste heat is usually cooler and less concentrated by the time it leaves the engine, and the recovery equipment brings losses of its own.

## Final Takeaway

An engine can use less fuel and waste less heat, but it cannot turn every bit of fuel energy into motion. Some heat must leave for the cycle to continue — that is why engine efficiency can improve, but it can never reach 100%.
`,
  },
  {
    title: "Why Landing on the Sun Is Impossible – The Physics and Heat Explained",
    subtitle: "The Sun lacks a solid surface and spacecraft cannot overcome orbital velocity and extreme heat to land on it.",
    tags: ["Heat", "Physics Limits", "Science", "Space Science", "The Sun"],
    body: `
Landing on the Sun is impossible, but heat is only part of the reason. The Sun is about 150 million kilometres from Earth — we have sent spacecraft far beyond that. But a spacecraft leaving Earth is already racing sideways around the Sun; it cannot simply drop straight down, and even if it reached the Sun, there would be no surface waiting for it.

## The Sun Has No Solid Ground

The Sun is a huge ball of plasma. What looks like its surface is the photosphere, about 5,500°C, but it is not a crust — a spacecraft would keep sinking into hotter and denser plasma until it was destroyed.

## Why a Spacecraft Cannot Fall Straight Into the Sun

Earth travels around the Sun at roughly 107,000 kilometres per hour, and a spacecraft launched from Earth carries that speed with it. Unless it cancels most of it, the spacecraft will continue orbiting the Sun instead of falling into it — cancelling that speed takes enormous energy.

## The Heat Would Destroy the Spacecraft

Above the photosphere lies the corona, where temperatures can reach around two million degrees Celsius. Parker Solar Probe uses a carbon-composite heat shield about 11.4 centimetres thick, whose Sun-facing side can reach nearly 1,377°C while the instruments stay protected behind it — but inside the photosphere, that protection would no longer work.

## What Parker Solar Probe Actually Did

During its closest pass on December 24, 2024, Parker came within about 6.1 million kilometres of the Sun's visible surface, travelling at roughly 692,000 kilometres per hour. It flew through the corona — often described as "touching the Sun" — but it did not land, and continued around it.

## Could We Still Fly Into It?

A probe could be sent on a final path into the Sun and transmit data until its systems failed, but that would be a controlled plunge, not a landing. A spacecraft can orbit the Sun or plunge into it. It cannot land, because there is nowhere solid to stop.
`,
  },
  {
    title: "Why We Can't See the Entire Universe – The Science Behind the Observable Universe",
    subtitle: "Light travel time and cosmic expansion create an insurmountable observational boundary.",
    tags: ["Astronomy", "Cosmology", "Physics", "Science", "Space Science"],
    body: `
## Looking Farther Means Looking Back in Time

Light requires time to traverse cosmic distances. Sunlight takes roughly eight minutes to reach Earth, so we observe the Sun as it existed eight minutes prior. The universe's age of 13.8 billion years means light from some regions has not had enough time to reach us, so those regions remain unseen.

## Why the Observable Universe Is About 92 Billion Light-Years Wide

Although the universe is 13.8 billion years old, we can observe approximately 46 billion light-years in each direction because space kept expanding while the light travelled towards us, producing an observable universe diameter of about 92 billion light-years.

## There Is No Wall at the Edge

The observable universe's edge represents no physical boundary — it is not a wall or the end of space. An observer in another galaxy would perceive a different observable region entirely.

## Faster Than Light Does Not Always Mean Invisible

Distant galaxies recede faster than light because space itself expands, not through local space travel. The Hubble sphere marks where recession reaches light speed, but this does not represent the observable universe's edge.

## The Event Horizon Sets Another Limit

Cosmic expansion accelerates, meaning light emitted today from some distant regions will never reach us — the cosmic event horizon. Ancient light from galaxies beyond this threshold may still arrive, but new emissions from those regions will remain forever unreachable.

## A Better Telescope Cannot Fix This

The James Webb Space Telescope detects faint infrared radiation from early galaxies but cannot transcend observable universe limits — no telescope can detect light that never reaches Earth.

## Why We Will Never See Everything

The universe has a finite age, light has a finite speed, and space is still expanding. Improved instruments will reveal fainter galaxies and older light, but vast regions will perpetually remain beyond our observational horizon.
`,
  },
  {
    title: "Why Humans Can't Survive on Mars Without Domes",
    subtitle: "Mars lacks the atmospheric pressure, breathable air, radiation protection, and temperature stability that human bodies require for survival.",
    tags: ["Human Survival", "Mars Colonies", "Mars Domes", "Space Colonies", "Space Science"],
    body: `
From far away, Mars looks like the next world humans might try to reach. Up close, though, it is not a waiting home. Mars is a low-pressure, high-radiation world with almost no breathable air, severe cold, and dust storms that can block sunlight for days.

## Mars Has No Breathable Air

Mars's atmosphere is mostly carbon dioxide, with only tiny traces of oxygen — useless to human lungs. The body also needs the right pressure around it, which is why a dome or habitat would have to hold its own breathable atmosphere.

## Radiation Makes the Surface Dangerous

Earth protects life with a thick atmosphere and a global magnetic field. Mars does not offer the same protection, so solar and cosmic radiation reach the surface much more easily. A permanent colony would need serious shielding, using thick materials, Martian soil, or underground construction.

## Mars Is Far Too Cold for Normal Life

The average temperature on Mars is far below what the human body can handle, and nights can be even harsher. A human settlement would need controlled indoor temperatures all the time.

## Dust Storms Can Shut Everything Down

Some Martian storms can grow across huge regions and, in rare cases, affect the entire planet — blocking sunlight, covering solar panels, and interfering with the machines a colony would depend on.

## Low Pressure Is One of the Biggest Dangers

Mars has extremely low atmospheric pressure compared with Earth, and the human body cannot function normally in it. Every realistic Mars settlement depends on pressurized spaces.

## Why Domes Are Not Optional

A real Mars colony would need protected spaces for breathable air, pressure, temperature control, radiation shielding, water recycling, and food production — a dome, a sealed habitat, or a base built partly underground.

## Final Takeaway

Humans may one day live on Mars, but not in the open. The air cannot be breathed, the pressure is too low, the radiation is harsh, and the cold can damage both people and equipment. A dome is not a luxury in a Mars colony — it is the barrier that makes human life possible there.
`,
  },
];

async function main() {
  const author = await prisma.user.findUnique({ where: { email: "phase0@test.local" } });
  if (!author) {
    throw new Error('Seed user "phase0@test.local" not found — log in/register that user first.');
  }

  const category = await prisma.category.upsert({
    where: { slug: "science" },
    update: {},
    create: {
      name: "Science",
      slug: "science",
      description: "Physics, space, biology, energy, and the real limits of nature.",
    },
  });

  let created = 0;
  let skipped = 0;

  for (const [index, article] of articles.entries()) {
    const slug = slugify(article.title);

    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) {
      skipped++;
      console.log(`- skip (already exists): ${article.title}`);
      continue;
    }

    const content = bodyToHtml(article.body);
    const readingTime = estimateReadingTime(content);
    const publishedAt = new Date(Date.now() - index * 24 * 60 * 60 * 1000);

    const post = await prisma.post.create({
      data: {
        title: article.title,
        subtitle: article.subtitle || null,
        slug,
        content,
        excerpt: article.subtitle || null,
        status: "published",
        featured: index < 3,
        authorId: author.id,
        categoryId: category.id,
        readingTime,
        publishedAt,
        createdAt: publishedAt,
        updatedAt: publishedAt,
      },
    });

    for (const tagName of article.tags) {
      const tagSlug = slugify(tagName);
      const tag = await prisma.tag.upsert({
        where: { slug: tagSlug },
        update: {},
        create: { name: tagName, slug: tagSlug },
      });
      await prisma.postTag.upsert({
        where: { postId_tagId: { postId: post.id, tagId: tag.id } },
        update: {},
        create: { postId: post.id, tagId: tag.id },
      });
    }

    created++;
    console.log(`+ created: ${article.title} (${readingTime} min read)`);
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped} (already present).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
