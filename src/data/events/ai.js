/**
 * Artificial Intelligence — department config & event data.
 * Edit CONFIG.coordinators, CONFIG.endpoint, and EVENTS here.
 */

export const CONFIG = {
  dept: 'Artificial Intelligence & Data Science',
  slug: 'ai',

  /*
   * WHERE REGISTRATIONS GO.
   * Leave '' and registrations are only saved in the visitor's own browser
   * (fine for testing, NOT enough for the real fest — you will not receive them).
   * For real use paste a URL that accepts a POST, e.g.
   *   - a Google Apps Script web-app URL that appends the JSON to a Google Sheet, or
   *   - a Formspree / Getform endpoint.
   * The page sends JSON: {dept, eventId, event, name, email, phone, college, team, regId, time}.
   */
  endpoint: '',

  /** Department contacts shown under "Questions?" (PLACEHOLDERS) */
  coordinators: [
    { name: 'Coordinator Name', phone: '+91 00000 00000' },
    { name: 'Coordinator Name', phone: '+91 00000 00000' },
  ],
};

/**
 * EVENTS — PLACEHOLDER DATA, replace with the real events.
 * type   : 'Competition' | 'Workshop' | 'Talk'   (drives the filter buttons)
 * team   : max team size (1 = individual)
 * fee    : text shown on the card ('Free', '₹100' …)
 * regUrl : OPTIONAL. If set (e.g. a Google Form link) the Register button opens
 *          that link instead of the built-in form.
 */
export const EVENTS = [
  {
    id: 'model-arena',
    type: 'Competition',
    title: 'Model Arena',
    date: '7 Oct',
    time: '10:30 AM',
    venue: 'AI Lab',
    team: 2,
    fee: '₹100',
    desc: 'Same dataset, same clock. Build the most accurate model and take the top of the leaderboard.',
  },
  {
    id: 'prompt-wars',
    type: 'Competition',
    title: 'Prompt Wars',
    date: '7 Oct',
    time: '3:00 PM',
    venue: 'Seminar Hall',
    team: 1,
    fee: '₹50',
    desc: 'Head-to-head prompt challenges. Get the best result out of the machine in the fewest tries.',
  },
  {
    id: 'vision-lab',
    type: 'Workshop',
    title: 'Vision Lab',
    date: '7 Oct',
    time: '11:00 AM',
    venue: 'AI Lab',
    team: 1,
    fee: 'Free',
    desc: 'Build an image-recognition pipeline from scratch and see how it learns.',
  },
  {
    id: 'ai-talk',
    type: 'Talk',
    title: 'Where AI Goes Next',
    date: '7 Oct',
    time: '10:00 AM',
    venue: 'Main Auditorium',
    team: 1,
    fee: 'Free',
    desc: 'An open talk on what is changing in AI and what it means for engineers.',
  },
];
