// All quiz content, taken from the proposal "The Hidden Energy System".
// This file is the single source of truth: the server engine reads answers and
// hints from it, and the host screen receives it (minus nothing) over the socket.
// Players never receive `answer`, `hint` (until they spend one) or `reveal`.

export const GAME_TITLE = 'The Hidden Energy System';
export const ANSWER_SECONDS = 20;
export const STARTING_HINTS = 2;

export const ROUNDS = [
  {
    id: 1,
    name: 'The Hidden Sugar Challenge',
    tagline: "Think you know what's in your food?",
    theme: 'Awareness',
    points: 100,
    discovery: 'Not all carbohydrates taste sweet.',
  },
  {
    id: 2,
    name: 'The Energy Crisis',
    tagline: "What happens inside your body when you eat... and when you don't?",
    theme: 'Energy',
    points: 200,
    discovery: 'Your body has more than one way to power itself.',
  },
  {
    id: 3,
    name: 'The Hidden Repair System',
    tagline: 'What happens when your cells start recycling?',
    theme: 'Repair',
    points: 300,
    discovery: "Your body doesn't just consume energy. It maintains and recycles itself.",
  },
];

const FOOD_PROMPT = 'Does this meal contain a high or low amount of digestible carbohydrates?';
const BINARY = [
  { letter: 'HIGH', text: 'High carb' },
  { letter: 'LOW', text: 'Low carb' },
];

export const QUESTIONS = [
  // ---------------- ROUND 1 ----------------
  {
    n: 1, round: 1, kind: 'binary', food: 'acai',
    title: 'Açaí Bowl',
    caption: 'Banana, granola and honey.',
    prompt: FOOD_PROMPT,
    options: BINARY,
    answer: 'HIGH',
    hint: 'Banana, granola and honey are all sugar or starch.',
    reveal: {
      headline: 'High carb',
      text: 'Banana, granola and honey are all carbs. A bowl can look healthy and still be full of sugar and starch.',
      callouts: ['Banana', 'Granola', 'Honey'],
    },
  },
  {
    n: 2, round: 1, kind: 'binary', food: 'burger',
    title: 'Bacon Cheeseburger',
    caption: 'Mayonnaise and lettuce wrap.',
    prompt: FOOD_PROMPT,
    options: BINARY,
    answer: 'LOW',
    hint: "There's no bun. Meat, cheese and bacon have almost no carbs.",
    reveal: {
      headline: 'Low carb',
      text: 'The lettuce takes the place of the bun. Beef, bacon, cheese and mayo have almost no carbs.',
      callouts: ['No bun here', 'Lettuce wrap'],
    },
  },
  {
    n: 3, round: 1, kind: 'binary', food: 'quinoa',
    title: 'Quinoa Salad',
    caption: 'Chickpeas, sweet potatoes and avocado.',
    prompt: FOOD_PROMPT,
    options: BINARY,
    answer: 'HIGH',
    hint: 'Quinoa, chickpeas and sweet potato are all starchy.',
    reveal: {
      headline: 'High carb',
      text: 'Quinoa, chickpeas and sweet potato are all full of starch. Only the avocado is low carb.',
      callouts: ['Quinoa', 'Chickpeas', 'Sweet potato'],
    },
  },
  {
    n: 4, round: 1, kind: 'binary', food: 'alfredo',
    title: 'Chicken Alfredo',
    caption: 'Creamy sauce and zucchini noodles.',
    prompt: FOOD_PROMPT,
    options: BINARY,
    answer: 'LOW',
    hint: 'Those noodles are zucchini, not pasta.',
    reveal: {
      headline: 'Low carb',
      text: 'Normal pasta is mostly starch. These noodles are zucchini, which is mostly water, so the same dish has far fewer carbs.',
      callouts: ['Zucchini noodles', 'Creamy sauce and chicken'],
    },
  },

  // ---------------- ROUND 2 ----------------
  {
    n: 5, round: 2, kind: 'mc',
    prompt: 'What does insulin do after you eat?',
    options: [
      { letter: 'A', text: 'Helps your body process sugar (glucose) and turn it into energy.', scene: 'sugarIntoCells' },
      { letter: 'B', text: 'Prevents sugar from entering your blood.', scene: 'sugarBarrier' },
      { letter: 'C', text: "Tells your stomach you've eaten enough for the day.", scene: 'stomachFull' },
      { letter: 'D', text: 'All of the above.', all: true },
    ],
    answer: 'A',
    hint: "Insulin's job is to get sugar out of your blood and into your cells to use for energy.",
    reveal: {
      scene: 'revealInsulin',
      text: 'Insulin is the signal that food has arrived. It helps your cells take in sugar (glucose) and turn it into energy, now or later.',
    },
  },
  {
    n: 6, round: 2, kind: 'mc',
    prompt: 'What happens when your body becomes resistant to insulin?',
    options: [
      { letter: 'A', text: 'Your pancreas immediately stops making insulin.', scene: 'pancreasStops' },
      { letter: 'B', text: 'Controlling blood sugar becomes harder, increasing your risk of type 2 diabetes.', scene: 'sugarPileUp' },
      { letter: 'C', text: 'You become immune to the consequences of eating too many donuts.', scene: 'donutShield' },
      { letter: 'D', text: 'All of the above.', all: true },
    ],
    answer: 'B',
    hint: 'Resistant means insulin works less well, so keeping blood sugar steady gets harder.',
    reveal: {
      scene: 'revealResistance',
      text: 'Your cells stop listening to insulin, so your body has to make more and more of it. If it can\'t keep up, blood sugar rises and type 2 diabetes can follow.',
    },
  },
  {
    n: 7, round: 2, kind: 'mc',
    prompt: 'What exactly is ketosis?',
    options: [
      { letter: 'A', text: 'When your body turns fat into an alternative fuel called ketones.', scene: 'fatToKetones' },
      { letter: 'B', text: 'When your body runs out of energy.', scene: 'emptyBattery' },
      { letter: 'C', text: 'When eating more fat automatically makes you lose more weight.', scene: 'butterScale' },
      { letter: 'D', text: 'All of the above.', all: true },
    ],
    answer: 'A',
    hint: 'Ketones are made from fat. Only one answer is true.',
    reveal: {
      scene: 'revealKetosis',
      text: 'When carbs run low, your liver turns fat into ketones. Ketones are a backup fuel, and your brain can run on them.',
    },
  },
  {
    n: 8, round: 2, kind: 'mc',
    prompt: 'Why is ketosis so valuable?',
    options: [
      { letter: 'A', text: 'It provides your brain with an alternative to sugar.', scene: 'ketoneBrain' },
      { letter: 'B', text: 'It can reduce hunger and help you go longer between meals.', scene: 'hungerMeter' },
      { letter: 'C', text: 'It helps your body use stored fat when food is scarce.', scene: 'fatReserves' },
      { letter: 'D', text: 'All of the above.', all: true },
    ],
    answer: 'D',
    hint: 'More than one answer can be right.',
    reveal: {
      scene: 'revealAllKetosis',
      text: "You don't only run on your last meal. Your body can also run on the energy it has already stored.",
    },
  },

  // ---------------- ROUND 3 ----------------
  {
    n: 9, round: 3, kind: 'mc',
    prompt: 'What is autophagy?',
    options: [
      { letter: 'A', text: 'The creation of new cells.', scene: 'cellDivide' },
      { letter: 'B', text: 'The breakdown and recycling of damaged cell components.', scene: 'autophagosome' },
      { letter: 'C', text: "Your body eating its own cells because it's hungry.", scene: 'hungryCell' },
      { letter: 'D', text: 'All of the above.', all: true },
    ],
    answer: 'B',
    hint: 'Think recycling: old, broken parts get taken apart and reused.',
    reveal: {
      scene: 'revealAutophagy',
      text: 'Your cells recycle. They break down old, broken parts and reuse the pieces to build new ones.',
    },
  },
  {
    n: 10, round: 3, kind: 'mc', serious: true,
    prompt: 'Which diseases have been linked to problems with cellular recycling?',
    options: [
      { letter: 'A', text: "Alzheimer's disease.", scene: 'brainPlaques' },
      { letter: 'B', text: 'Cancer.', scene: 'abnormalCells' },
      { letter: 'C', text: 'Type 2 diabetes.', scene: 'glucoseCells' },
      { letter: 'D', text: 'All of the above.', all: true },
    ],
    answer: 'D',
    hint: 'More than one answer can be right.',
    reveal: {
      scene: 'revealDiseases',
      text: 'Three very different diseases have one thing in common: the cell\'s recycling stops working well.',
    },
  },
  {
    n: 11, round: 3, kind: 'mc',
    prompt: 'What can activate more cellular recycling?',
    options: [
      { letter: 'A', text: 'Eating extra protein.', scene: 'proteinFlood' },
      { letter: 'B', text: 'Fasting.', scene: 'nutrientShortage' },
      { letter: 'C', text: 'Taking a nap after an enormous meal.', scene: 'napPlates' },
      { letter: 'D', text: 'All of the above.', all: true },
    ],
    answer: 'B',
    hint: 'Cells recycle more when food stops coming in.',
    reveal: {
      scene: 'revealScarcity',
      text: 'When less food comes in, cells recycle more. They make the most of what they already have.',
    },
  },
  {
    n: 12, round: 3, kind: 'mc',
    prompt: 'What happened when scientists genetically increased autophagy in mice?',
    options: [
      { letter: 'A', text: 'They lived longer.', scene: 'timelineLonger' },
      { letter: 'B', text: 'They aged at the same rate.', scene: 'timelinesEqual' },
      { letter: 'C', text: 'They became exceptionally good at solving mazes.', scene: 'mouseMaze' },
      { letter: 'D', text: 'All of the above.', all: true },
    ],
    answer: 'A',
    hint: 'Better cell cleanup kept the mice younger for longer.',
    reveal: {
      scene: 'revealLifespan',
      text: 'The mice lived longer. Could better cell maintenance help people age better too? Scientists are still finding out.',
      note: 'This was a study in mice. It does not prove that people would live longer.',
    },
  },

  // ---------------- FINAL BONUS ----------------
  {
    n: 13, round: 'bonus', kind: 'number',
    title: 'Bonus question',
    prompt: "In Dr. Sarah Hallberg's study, what percentage of insulin-treated participants who remained in the program reduced or stopped insulin after one year?",
    min: 0, max: 100, unit: '%',
    answer: 94,
    hint: null, // the proposal lists hints for questions 1-12 only
    reveal: {
      scene: 'revealNinetyFour',
      text: 'After one year, 94% of the people on insulin who stayed in the program used less insulin or none at all.',
      note: 'This result does not mean that all participants were cured.',
    },
  },
];

export const REGULAR_MAX_XP = ROUNDS.reduce((s, r) => s + r.points * 4, 0); // 2,400

// ---------- betting ----------
// Everyone starts with $100,000. Each question you may bet nothing or a fixed
// stake: 0%, 10%, 15%, 25% or 50% of what you have. Right: win the stake. Wrong or no answer: lose it. Three right
// answers in a row pay a $100,000 streak bonus (the count then starts again).
export const START_MONEY = 100_000;
// Bets are a share of what you have now: 0%, 10%, 15%, 25% or 50% (max).
export const BET_PCTS = [0, 10, 15, 25, 50];
export const STREAK_LEN = 3;
export const STREAK_BONUS = 50_000;
export const BONUS_PRIZE = 300_000; // closest guess on the bonus question; a perfect tie pays everyone tied
// A player who is broke (or nearly) still gets one bet to play for: the
// comeback bet. Right adds $10,000 and counts toward the $50,000 streak;
// wrong costs only what they have left, so nobody goes below $0.
export const COMEBACK_BET = 10000;
export function betChoices(balance) {
  const seen = new Set();
  const list = BET_PCTS.map((pct) => ({ pct, amount: Math.floor((Math.max(0, balance) * pct) / 100 / 1000) * 1000 }))
    .filter((c) => (seen.has(c.amount) ? false : seen.add(c.amount)));
  if (list.length === 1) list.push({ pct: 0, amount: COMEBACK_BET, comeback: true });
  return list;
}
export function betOptions(balance) { return betChoices(balance).map((c) => c.amount); }

export function pointsFor(q) {
  if (q.round === 'bonus') return 0;
  return ROUNDS.find((r) => r.id === q.round).points;
}

// The whole show as an ordered list of steps. The host walks this list; the
// server remembers the host's position so a reloaded host screen can resume.
export function buildSteps() {
  const steps = [{ type: 'lobby' }, { type: 'howto' }];
  for (const r of ROUNDS) {
    steps.push({ type: 'roundIntro', round: r.id });
    for (const q of QUESTIONS.filter((x) => x.round === r.id)) steps.push({ type: 'question', n: q.n });
    steps.push({ type: 'discovery', round: r.id });
    steps.push({ type: 'leaderboard', round: r.id });
  }
  steps.push({ type: 'bonusIntro' });
  steps.push({ type: 'question', n: 13 });
  steps.push({ type: 'podium' });
  steps.push({ type: 'finale' });
  return steps;
}

// What a phone is allowed to see about a question.
export function publicQuestion(q) {
  return {
    n: q.n,
    round: q.round,
    kind: q.kind,
    title: q.title || null,
    prompt: q.prompt,
    options: q.options ? q.options.map((o) => ({ letter: o.letter, text: o.text, ...(o.all ? { all: true } : {}) })) : null,
    min: q.min, max: q.max, unit: q.unit,
    points: pointsFor(q),
    hasHint: !!q.hint,
  };
}
