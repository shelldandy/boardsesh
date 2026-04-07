export const PAGE_LIMIT = 20;
export const MAX_PAGE_SIZE = 100; // Maximum page size to prevent excessive database queries

// Threshold for proactive fetching of suggestions
// When suggestedClimbs falls below this, we fetch more automatically
// Set to 10 to keep a healthy buffer of suggestions available
export const SUGGESTIONS_THRESHOLD = 10;
