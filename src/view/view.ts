// The view entry: one export, `mount`, and one stylesheet (spec § The view). `mount` is typed by the seam's own
// declaration (`src/seam-types.ts`), so the build fails when the view and the types it publishes part.
import type * as Seam from '../seam-types.ts';
import { mountJournal } from './journal.ts';
import './journal.css';
// The date-pick package's sheet: the build nests it under `.journal` (bin/scope-css.ts).
import '../ui/date-pick/date-pick.css';

export const mount: typeof Seam.mount = (root, host) => mountJournal(root, host);
