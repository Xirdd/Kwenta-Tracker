export const CATEGORIES = [
  { id: 'food', label: 'Food & Groceries', color: '#e2604a' },
  { id: 'transport', label: 'Transport', color: '#d4a72c' },
  { id: 'bills', label: 'Bills & Utilities', color: '#3fa377' },
  { id: 'rent', label: 'Rent', color: '#5b7fde' },
  { id: 'load', label: 'Load & Internet', color: '#b26fd1' },
  { id: 'health', label: 'Health', color: '#4fb8c9' },
  { id: 'shopping', label: 'Shopping', color: '#e893a8' },
  { id: 'fun', label: 'Entertainment', color: '#f0a93f' },
  { id: 'savings', label: 'Savings', color: '#7fae3f' },
  { id: 'family', label: 'Family Support', color: '#c77b3f' },
  { id: 'other', label: 'Others', color: '#8c8c7a' },
];

export function catInfo(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

export const INCOME_CATEGORIES = [
  { id: 'bonus', label: 'Bonus / 13th Month', color: '#d4a72c' },
  { id: 'freelance', label: 'Freelance / Side Hustle', color: '#3fa377' },
  { id: 'allowance', label: 'Allowance', color: '#5b7fde' },
  { id: 'other', label: 'Other Income', color: '#8c8c7a' },
];

export function incCatInfo(id) {
  return INCOME_CATEGORIES.find((c) => c.id === id) || INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1];
}
