/**
 * Shared constants used across the admin panel.
 * Keep this in sync with backend/src/lib/constants.js
 */

// ── Communities ───────────────────────────────────────────────────────────────
// "birthday" removed — it is an event type, not a community.
// Use "universal" for non-community-specific templates.
export const COMMUNITIES = [
  { value: 'hindu',     label: 'Hindu' },
  { value: 'muslim',    label: 'Muslim' },
  { value: 'sikh',      label: 'Sikh' },
  { value: 'christian', label: 'Christian' },
  { value: 'jain',      label: 'Jain' },
  { value: 'parsi',     label: 'Parsi' },
  { value: 'universal', label: 'Universal' },
];

export const COMMUNITY_VALUES = COMMUNITIES.map(c => c.value);

// ── Event Types ───────────────────────────────────────────────────────────────
// Used in Template.bestFor (comma-separated) and Event.eventType.
export const EVENT_TYPE_GROUPS = [
  {
    group: 'Wedding & Related',
    items: [
      { id: 'Wedding',    label: 'Wedding' },
      { id: 'Engagement', label: 'Engagement' },
      { id: 'Reception',  label: 'Reception' },
      { id: 'Sangeet',    label: 'Sangeet' },
      { id: 'Haldi',      label: 'Haldi' },
      { id: 'Mehendi',    label: 'Mehendi / Mehndi' },
    ],
  },
  {
    group: 'Religious Ceremonies',
    items: [
      { id: 'Nikah',            label: 'Nikah' },
      { id: 'Anand Karaj',      label: 'Anand Karaj' },
      { id: 'Thread Ceremony',  label: 'Thread Ceremony (Janeu)' },
      { id: 'Naming Ceremony',  label: 'Naming Ceremony (Naamkaran)' },
      { id: 'Griha Pravesh',    label: 'Griha Pravesh' },
    ],
  },
  {
    group: 'Celebrations',
    items: [
      { id: 'Birthday',       label: 'Birthday' },
      { id: 'First Birthday', label: 'First Birthday' },
      { id: 'Baby Shower',    label: 'Baby Shower (Godh Bharai)' },
      { id: 'House Warming',  label: 'House Warming' },
      { id: 'Anniversary',    label: 'Anniversary' },
      { id: 'Retirement',     label: 'Retirement' },
    ],
  },
];

// Flat list of all event type IDs
export const ALL_EVENT_TYPES = EVENT_TYPE_GROUPS.flatMap(g => g.items);

// ── Languages ─────────────────────────────────────────────────────────────────
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ur', label: 'Urdu' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'mr', label: 'Marathi' },
  { code: 'kn', label: 'Kannada' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'ta', label: 'Tamil' },
];
