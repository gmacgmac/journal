# Contracts: One Source, Tested End to End

Every contract has one source. Types, handlers, docs, clients and agent tools are generated from
it or tested against it, and a test fails when code and source disagree. **Change the source
first.**

**Take the links that fit.** The chain below is the full form. A project uses the links it has:
no API, skip the routes; no agent tools, skip MCP; no file formats, skip the schemas.

## The chain

```
JSON Schema (data / file formats, versioned)
   → code types + validators
   → route declarations → OpenAPI spec (served)
   → generated client · generated docs · MCP tools
```

Each arrow is either generation or a test. A link may be hand-written on purpose — a client
another language reimplements, a doc written for people — as long as a test holds it to its
source. A hand-written link is fine; an unchecked one is not.

## A route is a declaration

One declaration per route produces its handler binding, its input validation and its OpenAPI
entry. Required fields (operation id, summary, description, success + error responses) are
enforced when the module loads, so a malformed route refuses to start, naming itself.

- Naming is consistent and checked (e.g. `collection.verb` operation ids).
- Path params declared must match the path's captures.
- The served spec **is** the API reference. No hand-written route reference; a guide written for
  people is tested against the spec.

## One API shape

- Consistent resource shapes, error envelope, paging and naming across every route.
- Errors are codes, not sentences; the client owns the words, in its words files
  (`references/words.md`).
- Shared shapes (batch request/result, list page, error) are named schemas reused by `$ref`.
- Each convention is a row in a conventions index with a test that asserts it over **every**
  route in the served spec — not a fixture. A new route is held to the rule the moment it exists.
  (Index + tripwire method: `cortex-docs` → `references/doc-truth.md`.)

## Tests that hold the chain

| Test | Holds |
|---|---|
| Conformance | Served spec and live route table are equal, both directions |
| Response validation | Responses match the spec's schemas at runtime, not only their types |
| Spec hash | Any spec change is flagged; clients regenerate |
| Schema fixtures | Every fixture validates against the current schema version |
| MCP parity | Every MCP tool maps to a spec operation and validates against it |
| Convention blocks | Each API convention, over every route |

## MCP from the same source

MCP tools and CLI commands are generated from, or tested against, the same spec and schemas —
so an agent calls the same action, with the same validation and permissions, as a person. How
agents are limited, confirmed and recorded lives in `actions.md`.

## Versioning

Schemas carry a version. A breaking change bumps it; the I/O layer picks the adapter by version.
Never edit a published shape in place.
