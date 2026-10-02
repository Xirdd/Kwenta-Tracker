// The icon library for custom budget categories.
//
// Kwenta is a vanilla-JS app (no React), so "Lucide React" isn't an option —
// instead this is a small self-contained set of Lucide-style line icons
// (24x24 viewBox, stroke-based, same as every icon in categories.js). No new
// dependency, nothing extra to bundle or precache.
//
// What gets stored on a category is only the icon's string id (e.g.
// "dumbbell"), never the SVG itself — so the library can be reworked later
// without touching saved data, and an unknown/removed id falls back safely
// to DEFAULT_ICON_ID.

export const DEFAULT_ICON_ID = "tag";

export const ICON_GROUPS = [
  {
    id: "fitness",
    label: "Fitness",
    icons: [
      {
        id: "dumbbell",
        label: "Gym",
        paths: `<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3.5 9v6"/><path d="M20.5 9v6"/><path d="M6.5 12h11"/>`,
      },
      {
        id: "activity",
        label: "Activity",
        paths: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
      },
    ],
  },
  {
    id: "food",
    label: "Food",
    icons: [
      {
        id: "utensils",
        label: "Dining",
        paths: `<path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2"/><path d="M6 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7"/>`,
      },
      {
        id: "coffee",
        label: "Coffee",
        paths: `<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>`,
      },
      {
        id: "cart",
        label: "Groceries",
        paths: `<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>`,
      },
    ],
  },
  {
    id: "health",
    label: "Health",
    icons: [
      {
        id: "heart",
        label: "Health",
        paths: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
      },
      {
        id: "pill",
        label: "Medicine",
        paths: `<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>`,
      },
      {
        id: "cross",
        label: "Medical",
        paths: `<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>`,
      },
    ],
  },
  {
    id: "shopping",
    label: "Shopping",
    icons: [
      {
        id: "bag",
        label: "Shopping",
        paths: `<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
      },
      {
        id: "tag",
        label: "Tag",
        paths: `<path d="M20.59 13.41 13 21l-9-9V4h8l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.5"/>`,
      },
      {
        id: "gift",
        label: "Gifts",
        paths: `<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>`,
      },
      {
        id: "shirt",
        label: "Clothes",
        paths: `<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>`,
      },
      {
        id: "scissors",
        label: "Grooming",
        paths: `<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>`,
      },
    ],
  },
  {
    id: "home",
    label: "Home & bills",
    icons: [
      {
        id: "home",
        label: "Home",
        paths: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
      },
      {
        id: "file",
        label: "Bills",
        paths: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
      },
      {
        id: "zap",
        label: "Electricity",
        paths: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
      },
      {
        id: "droplet",
        label: "Water",
        paths: `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>`,
      },
      {
        id: "wifi",
        label: "Internet",
        paths: `<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`,
      },
      {
        id: "phone",
        label: "Gadgets",
        paths: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
      },
      {
        id: "wrench",
        label: "Repairs",
        paths: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
      },
    ],
  },
  {
    id: "transport",
    label: "Transport & travel",
    icons: [
      {
        id: "navigation",
        label: "Transport",
        paths: `<polygon points="3 11 22 2 13 21 11 13 3 11"/>`,
      },
      {
        id: "car",
        label: "Car",
        paths: `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>`,
      },
      {
        id: "plane",
        label: "Travel",
        paths: `<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>`,
      },
    ],
  },
  {
    id: "life",
    label: "Life",
    icons: [
      {
        id: "paw",
        label: "Pets",
        paths: `<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>`,
      },
      {
        id: "users",
        label: "Family",
        paths: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
      },
      {
        id: "book",
        label: "Education",
        paths: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
      },
      {
        id: "music",
        label: "Music",
        paths: `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
      },
      {
        id: "play",
        label: "Fun",
        paths: `<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>`,
      },
      {
        id: "star",
        label: "Favorites",
        paths: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
      },
    ],
  },
  {
    id: "money",
    label: "Money",
    icons: [
      {
        id: "card",
        label: "Card",
        paths: `<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>`,
      },
      {
        id: "trending",
        label: "Savings",
        paths: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`,
      },
      {
        id: "repeat",
        label: "Subscriptions",
        paths: `<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>`,
      },
      {
        id: "briefcase",
        label: "Work",
        paths: `<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
      },
    ],
  },
];

const ICON_INDEX = new Map(
  ICON_GROUPS.flatMap((g) => g.icons).map((i) => [i.id, i]),
);

// The inner SVG markup for an icon id — unknown/missing ids get the tag icon,
// so a category can never render blank.
export function iconPaths(id) {
  return (ICON_INDEX.get(id) || ICON_INDEX.get(DEFAULT_ICON_ID)).paths;
}

export function isKnownIcon(id) {
  return ICON_INDEX.has(id);
}
