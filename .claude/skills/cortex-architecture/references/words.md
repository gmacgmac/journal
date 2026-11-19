# Words: One Home per Sentence

Every sentence a person or an agent reads lives in a words file, never in the code that shows
or sends it. The same thing is said the same way everywhere, wording is reviewed as a set, and
changing it later is one edit, not a hunt through screens.

This is not translation. It is the step that makes translation cheap later: every sentence
already has one home and one name.

## What counts

Any sentence someone reads, wherever it appears:

- **People**: headings, labels, buttons, placeholders, tooltips, alt text and screen-reader
  labels, empty states, notifications, errors, confirmations, emails.
- **Agents**: tool and parameter descriptions, tool results and refusals, system and injected
  messages, any text added to what the agent receives.

## Homes

A home is a words file, or a folder of them, where a part's text lives.

- One words file per area (a screen, a feature). Each part of the codebase that sends text (app,
  server, agent tools) has its own words folder.
- Shared text lives in one words file both parts can import. Where they can't, each keeps a copy
  and a test holds the copies equal (rule 1 in the skill).
- One project doc lists every home, and a test holds that list and the code equal, both ways. A
  new home is a line in both, in the same change.
- A file that can't import words (a static page, a platform config file, a shell hook) is listed
  as a home, with its reason.

## A words file

- Plain code. No imports except other words files: nothing from the app or its UI framework.
- A header says which area it belongs to and, if the project tracks approvals, where the wording
  was approved.
- Fixed text is an exported constant. Text that carries a value is an exported function returning
  a string.
- Each entry is a whole sentence. Values are passed in, never glued on by the caller.
- A sentence with a link or emphasis stays whole, with markers the screen fills in
  (`Read the {guide}`), never split around the link.
- Plural, count and branch logic lives here, not in the screen.
- A short comment above an entry says where it shows and when.
- A words file with logic gets a sibling test of its behaviour (counts, branches). The test never
  restates the sentences.

## What stays in code

Strings no person or agent reads stay in code: log lines, API descriptions only a developer
reads, SQL, identifiers, keys. These are excluded by rule. An API or tool description an agent
reads is agent text and has a home. A tool generated from the API spec takes its description from
a words file, through the route declaration.

Anything else left in code is named one literal at a time, with its reason, never by pattern. A
sentence someone reads never goes on that list. It moves to its home.

## The test

Added once text spans several files. It reads each part's code and fails on a sentence outside
its homes.

It spots a sentence by a rule the project tunes. A good start: any string literal or template
text with two words separated by a space, plus any text, however short, in a place people or
agents read (markup text; label, placeholder, title and alt attributes; tool and parameter
descriptions). Comments and the excluded kinds don't count.

It also fails when the homes doc and its list differ, when a home is gone, or when an exemption
names a literal that no longer exists.

## Adopting it in an existing project

Move text one area at a time, copied exactly, with no rewording during a move. Rewording is a
separate change. Add each part to the test's scan once it is clean.

## Changing words

New wording is drafted and approved as a set, then copied into the words files exactly as
approved. `cortex-word-review` is a local page for that approval, row by row. How the project writes (style guide, length limits, who reviews) lives in project docs,
not here.
