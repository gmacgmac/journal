// The date-pick package: a popover, a month calendar and a strip of days, with nothing imported from outside this folder.
// README.md says how to use and theme it.
export { createCalendar, type Calendar, type CalendarLabels, type CalendarOptions } from './calendar.ts';
export { createDayStrip, type DayStrip, type DayStripOptions } from './day-strip.ts';
export { openPopover, type CloseReason, type Popover, type PopoverOptions } from './popover.ts';
export { addDays, isIsoDate, localToday, type IsoDate } from './dates.ts';
