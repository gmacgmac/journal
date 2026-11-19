// The person's routes' read limits, in one place: the engine refuses a read past them (engine/routes.ts) and the view
// reads within them (a long range or every page, in parts: view/print.ts).

/** The most days one `GET days` may ask for. */
export const MAX_RANGE_DAYS = 93;
/** The most pages one `GET pages` may ask for. */
export const MAX_PAGES = 31;
