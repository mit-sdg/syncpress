<!-- Generated from the Syncpress assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.0.0-beta.6; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.0.0-beta.6. -->

# Syncpress — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Attending

**Purpose.** Hold long-running work until its operator asks the process to stop, so the work
can clean up instead of being terminated mid-transition.

**Principle.** Ada starts a hold. It remains pending while she leaves the process alone. She
requests an interrupt; the hold is released and returns `interrupt`, and no
process listener remains. A later hold waits independently and returns
`terminate` when she makes that request.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `hold () : return (hold: Hold, reason: Reason)`

**Authored behavior:**

    then
      add a holding Hold and install its independent interrupt and terminate listeners
      if listener setup faults, remove the attempted Hold and propagate the host failure
      wait for the first request received by those listeners
      make the Hold released, remove its listeners, and return the request Reason

#### Queries

##### `_hold (hold: Hold) : optional (state: State, reason: Reason | null)`

**Authored behavior:**

    Returns no row for an unknown Hold and continues to return a row after
    release. The reason is null while the Hold is holding.

##### `_holding () : one (holding: NonnegativeInteger)`

**Authored behavior:**

    Reports the number of Holds in the holding state.

#### Types

```types
Reason = "interrupt" | "terminate"

State = "holding" | "released"
```

### Cataloging

**Purpose.** Admit projected items into named catalogs under declared conditions and keep
every catalog in a deterministic order for publication and inspection.

**Principle.** Ada declares a newest-first catalog sorted by a card's `data.date` field and a
featured catalog that accepts cards whose `data.featured` field equals true.
Indexing complete cards places qualifying entries in deterministic order;
entries with no date follow dated entries. Re-indexing a changed card updates
its projection and position, and re-indexing a card that no longer qualifies
removes its earlier featured entry. Ada can unindex one membership, withdraw an
item from every catalog, or reset all catalog state.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `declare (name: Name, selector: Pattern, direction: Direction, sort: Field | null, condition: Condition | null) : return (catalog: Catalog, changed: Flag)`

**Authored behavior:**

    where name is not Text
    then
      refuse INVALID_TEXT "Names, selectors, identities, paths, and tiebreaks must be text."
    where selector is not a valid portable glob
    then
      refuse INVALID_SELECTOR "A catalog selector must be a valid portable glob."
    where direction is neither asc nor desc
    then
      refuse INVALID_DIRECTION "Direction must be asc or desc."
    where a present sort is not a Field
    then
      refuse INVALID_FIELD "A configured field must use dotted ASCII segments."
    where condition is not null or a supported Condition
    then
      refuse INVALID_CONDITION "A condition must be null or one supported field predicate."
    where a catalog has the same complete policy
    then
      return that catalog and changed false
    where a catalog has the name and another policy
    then
      replace its policy and re-evaluate retained entries without resurrecting
        cards that were previously excluded
      return catalog and changed true
    where no catalog has name
    then
      add it and return catalog and changed true

**Registered refusal codes:** `INVALID_TEXT`, `INVALID_SELECTOR`, `INVALID_DIRECTION`, `INVALID_FIELD`, `INVALID_CONDITION`

##### `index (catalog: Catalog, item: Item, path: Path, tiebreak: Text, card: Values) : return (entry: Entry, included: Flag, changed: Flag)`

**Authored behavior:**

    where catalog, item, path, or tiebreak is not Text
    then
      refuse INVALID_TEXT "Names, selectors, identities, paths, and tiebreaks must be text."
    where catalog is absent
    then
      refuse CATALOG_NOT_FOUND "There is no such catalog."
    where card is not a record of Values
    then
      refuse INVALID_CARD "A card must be a record of supported values."
    where path does not match the selector or card does not satisfy the catalog condition
    then
      remove its prior entry if present and return included false with whether state changed
    where card satisfies the condition and an equal normalized projection is indexed
    then
      return that entry with included true and changed false
    where card satisfies the condition and no entry matches exactly
    then
      derive its sort key, add or replace the entry, and return included true and changed true

**Registered refusal codes:** `INVALID_TEXT`, `CATALOG_NOT_FOUND`, `INVALID_CARD`

##### `unindex (catalog: Catalog, item: Item) : return (entry: Entry)`

**Authored behavior:**

    where catalog or item is not Text
    then
      refuse INVALID_TEXT "Names, selectors, identities, paths, and tiebreaks must be text."
    where item is absent from catalog
    then
      refuse NOT_INCLUDED "This item is not indexed in that catalog."
    where item is present
    then
      remove and return its entry

**Registered refusal codes:** `INVALID_TEXT`, `NOT_INCLUDED`

##### `remove (name: Name) : return (catalog: Catalog, count: Number)`

**Authored behavior:**

    where name is not Text
    then
      refuse INVALID_TEXT "Names, selectors, identities, paths, and tiebreaks must be text."
    where no catalog has name
    then
      refuse CATALOG_NOT_FOUND "There is no such catalog."
    where a catalog has name
    then
      remove it and all of its entries and return how many entries were removed

**Registered refusal codes:** `INVALID_TEXT`, `CATALOG_NOT_FOUND`

##### `withdraw (item: Item) : return (item: Item, count: Number)`

**Authored behavior:**

    where item is not Text
    then
      refuse INVALID_TEXT "Names, selectors, identities, paths, and tiebreaks must be text."
    then
      remove the item from every catalog and return how many entries were removed

**Registered refusal codes:** `INVALID_TEXT`

##### `reset () : return (count: Number)`

**Authored behavior:**

    then
      remove every catalog and entry and return how many catalogs were removed

#### Queries

##### `_catalogs () : many (catalog: Catalog, name: Name, selector: Pattern, direction: Direction, sort: Field | null, condition: Condition | null)`

**Authored behavior:**

    Lists catalogs by name in ascending UTF-8 byte order.

##### `_named (name: Name) : optional (catalog: Catalog, selector: Pattern, direction: Direction, sort: Field | null, condition: Condition | null)`

**Authored behavior:**

    Returns no row when name is not Text or no catalog has that name.

##### `_entries (catalog: Catalog) : many (entry: Entry, item: Item, card: Values)`

**Authored behavior:**

    Lists entries in the catalog's deterministic order. Present sort keys compare
    ascending by kind: null, boolean, number, text, list, then record. False
    precedes true; numbers use numeric order; text uses UTF-8 byte order. Lists
    compare element by element and then by length. Records compare normalized keys
    and corresponding values member by member and then by member count. Descending
    reverses only the present-key comparison; missing keys remain after every
    present key. Remaining ties use tiebreak text and then item identity, both
    ascending in UTF-8 byte order. The resulting total order is independent of
    indexing order. An absent or non-Text catalog produces no rows.

##### `_membership (item: Item) : many (entry: Entry, catalog: Catalog, name: Name)`

**Authored behavior:**

    Lists memberships by catalog name in ascending UTF-8 byte order. An absent or
    non-Text item produces no rows.

##### `_position (catalog: Catalog, item: Item) : optional (index: Number)`

**Authored behavior:**

    Returns the zero-based position in `_entries` order, or no row when the catalog
    or membership is absent or either input is not Text.

##### `_record () : one (catalogs: Values)`

**Authored behavior:**

    Projects every declared catalog name as an own property, including names such
    as `__proto__`. Each property contains the complete cards in `_entries` order.

#### Types

```types
Name = Text
Pattern = Text
Path = Text
Item = Text
Direction = "asc" | "desc"
Field = Text

Value = null | Flag | Number | Text | List<Value> | Values
Values = Map<Text, Value>
  A record whose own Text keys map to Value. Map order is not significant.

EqualsCondition = record
  test: "equals"
  field: Field
  value: Value

ContainsCondition = record
  test: "contains"
  field: Field
  value: Value

ExistsCondition = record
  test: "exists"
  field: Field

Condition = EqualsCondition | ContainsCondition | ExistsCondition
```

A Value is one of null, a boolean, a finite number, text, a dense list of
Values, or a record whose own text keys map to Values. Records are plain or
null-prototype objects with enumerable data properties. Symbol keys, accessors,
cycles, sparse or decorated lists, array subclasses or arrays with another
prototype, other class instances, proxies, functions, bigint, undefined inside
a Value, NaN, and positive or negative infinity are not Values. Negative zero
is normalized to zero. Inputs are normalized and cloned before storage, and
queries return clones.

Text is a well-formed Unicode string. Catalog names, selectors, catalog and item
identities, paths, and tiebreaks must be Text. Actions refuse `INVALID_TEXT`
before using another value that is not Text. Lookup queries answer no row for a
non-Text input.

A selector follows the shared portable glob value contract: it is nonempty,
case-sensitive, matches a complete `/`-separated path, includes dotfiles, and
supports portable wildcards, classes, braces, extglobs, quoting, and escapes.
Malformed or unbalanced syntax is not a selector.

A Field has one or more dot-separated segments. Every segment contains only
ASCII letters, digits, `_`, or `-`. There are no escapes, empty segments,
whitespace, or leading or trailing dots. A Field follows own record properties
only and never indexes a list. Missing traversal produces a missing sort key or
a condition that does not match; explicit null is present.

Condition records contain exactly the fields shown in the declaration. Equality
is recursive structural Value equality. `contains` means structural
membership for a list and exact case-sensitive substring containment for two
texts. It is false for other value kinds.

#### Contracts

```contracts
contract stable-identities
  A Catalog identity is determined by its Name, and an Entry identity by its
  Catalog and Item. Both survive redeclaration and remove-then-add.
```

### Commanding

**Purpose.** Own one command-line invocation's captured words, operator streams, and terminal
exit status so an application can interact with it without consulting ambient
process state or hiding grammar in the host boundary.

**Principle.** Ada invokes a tool with the words `publish notes`. Capturing the invocation
returns those exact words. Her application recognizes them as command `publish`
with operand `notes` outside Commanding. The tool writes a completion message to
her ordinary output and a warning to her error output, then selects exit status
2. Repeating that capture or status is idempotent; different words or a different
status are refused. Supplying an explicit word list instead makes the same
interaction available to an embedding host.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `capture (arguments: Arguments | null) : return (words: Arguments)`

**Authored behavior:**

    where arguments is null
    then
      read the process arguments after its executable and script names
      return a copy
    where present arguments or the read process arguments are not an ordinary dense list of well-formed text values
    then
      refuse INVALID_ARGUMENTS "Arguments must be an ordinary dense list of text values."
    where words were already captured and supplied arguments differ
    then
      refuse INVOCATION_CAPTURED "This command invocation already has different words."
    where present arguments are valid or the invocation was already captured
    then
      retain the first words and return a copy

**Registered refusal codes:** `INVALID_ARGUMENTS`, `INVOCATION_CAPTURED`

##### `write (stream: Stream, text: Text) : return (stream: Stream, text: Text)`

**Authored behavior:**

    where stream is not output or error
    then
      refuse INVALID_STREAM "A command stream must be output or error."
    where text is not well-formed text
    then
      refuse INVALID_TEXT "A command line must be well-formed text."
    then
      write one line to the selected operator stream and return it

**Registered refusal codes:** `INVALID_STREAM`, `INVALID_TEXT`

##### `exit (code: ExitCode) : return (code: ExitCode, changed: Flag)`

**Authored behavior:**

    where code is not a safe integer from 0 through 255
    then
      refuse INVALID_EXIT_CODE "A command exit code must be a safe integer from 0 through 255."
    where another exit status was already selected
    then
      refuse EXIT_SELECTED "This command invocation already has another exit status."
    where this status was already selected
    then
      return it with changed false
    then
      set and retain the process exit status without terminating the process
      return it with changed true

**Registered refusal codes:** `INVALID_EXIT_CODE`, `EXIT_SELECTED`

#### Queries

##### `_invocation () : optional (words: Arguments)`

**Authored behavior:**

    Returns no row before capture and a copy of the captured words afterward.

##### `_outcome () : optional (code: ExitCode)`

**Authored behavior:**

    Returns no row before an exit status is selected.

#### Types

```types
Arguments = List<Text>
  An ordinary dense list with no extra properties.

Stream = "output" | "error"

ExitCode = SafeInteger
  An integer from 0 through 255 inclusive.
```

### Converting

**Purpose.** Convert Markdown to HTML or pass verbatim text through unchanged, while keeping
independent, reusable results for named parts of a subject.

**Principle.** Ada declares an explicit Markdown profile with tables, footnotes,
strikethrough, autolinks, raw HTML, and an excerpt separator. Each option changes
only its advertised syntax. Converting two parts of one subject keeps both
results. Repeating an unchanged conversion reuses it. A separator creates an
excerpt even when it occurs at the beginning; no separator means no excerpt. A
verbatim profile returns its source exactly. Replacing a profile revokes its old
identity and conversions, and an unknown profile is refused.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `declare (name: Name, kind: Kind, extensions: Extensions, raw: Flag, separator: JavaScriptString) : return (profile: Profile, changed: Flag)`

**Authored behavior:**

    where name, kind, extensions, raw, or separator has the wrong value kind; name is empty; or an extension is duplicated
    then
      refuse INVALID_PROFILE "This rendering profile is malformed."
    where kind is not markdown or verbatim
    then
      refuse UNSUPPORTED_PROFILE_KIND "This rendering profile kind is not supported."
    where an extension is not tables, footnotes, strikethrough, or autolinks
    then
      refuse UNSUPPORTED_EXTENSION "This Markdown extension is not supported."
    where a verbatim profile has extensions or raw false
    then
      refuse INCOMPATIBLE_PROFILE "A verbatim profile requires no extensions and raw true."
    where the named profile has the same normalized settings
    then
      return that profile and changed false
    where the named profile is new or has different normalized settings
    then
      revoke any previous profile with name and remove every conversion made with it
      add the new profile with copied, normalized settings
      return it and changed true

**Registered refusal codes:** `INVALID_PROFILE`, `UNSUPPORTED_PROFILE_KIND`, `UNSUPPORTED_EXTENSION`, `INCOMPATIBLE_PROFILE`

##### `convert (subject: Subject, part: Part, profile: Profile, source: JavaScriptString) : return (conversion: Conversion, output: JavaScriptString)`

**Authored behavior:**

    where profile is not a current profile
    then
      refuse PROFILE_NOT_FOUND "There is no such current rendering profile."
    where subject, part, or source is not text
    then
      refuse INVALID_CONVERSION_INPUT "A conversion subject, part, and source must be text."
    where the slot has this profile and exact source
    then
      return its stored conversion and output
    where Markdown processing fails
    then
      leave any prior Conversion in that Subject and Part unchanged
      refuse CONVERSION_FAILED "This text could not be converted."
    where conversion succeeds and is not cached
    then
      atomically replace the conversion for subject and part
      return its stable slot identity and output

**Registered refusal codes:** `PROFILE_NOT_FOUND`, `INVALID_CONVERSION_INPUT`, `CONVERSION_FAILED`

##### `release (subject: Subject) : return (subject: Subject, count: Number)`

**Authored behavior:**

    where subject is not text
    then
      refuse INVALID_SUBJECT "A conversion subject must be text."
    where subject is text
    then
      remove every conversion for subject
      return subject and how many were removed

**Registered refusal codes:** `INVALID_SUBJECT`

#### Queries

##### `_profile (name: Name) : optional (profile: Profile, kind: Kind, extensions: Extensions, raw: Flag, separator: JavaScriptString)`

**Authored behavior:**

    Returns only the current Profile for the name, or no row when the name has no
    current Profile. The extensions list is a fresh copy. No query returns a
    mutable value that aliases stored state.

##### `_conversion (conversion: Conversion) : optional (subject: Subject, part: Part, profile: Profile, digest: Digest, output: JavaScriptString)`

**Authored behavior:**

    Looks up a current Conversion identity. An identity with no current record
    returns no row.

##### `_for (subject: Subject, part: Part) : optional (conversion: Conversion, profile: Profile, digest: Digest, output: JavaScriptString)`

**Authored behavior:**

    Returns the current conversion in the subject-and-part slot, or no row when
    the slot has no current record.

##### `_excerpt (subject: Subject, part: Part) : optional (conversion: Conversion, excerpt: JavaScriptString)`

**Authored behavior:**

    Returns no row when the slot has no current conversion or its source contained
    no separator. A separator at the beginning produces a row with an empty
    excerpt.

#### Types

```types
Name = JavaScriptString
  A profile name. A current profile name is nonempty and is distinct from its Profile identity.

Kind = "markdown" | "verbatim"

Extension = "tables" | "footnotes" | "strikethrough" | "autolinks"

Extensions = List<Extension>

Subject = JavaScriptString
  An application-supplied conversion owner.

Part = JavaScriptString
  A named conversion part within a Subject.

Digest = Text
  A SHA-256 digest.
```

A profile has a `kind` of exactly `markdown` or `verbatim`. The kind selects the
engine; a profile's name never does.

Markdown uses Marked 18.0.7's non-pedantic block and inline grammar, emits
synchronous HTML, and does not turn single newlines into hard breaks. Fenced
code, headings, lists, links, CommonMark angle-bracket autolinks, and the other
base Markdown forms are always available. GFM task-list markers remain literal
text. Four optional extensions are supported independently:

- `tables` recognizes GFM pipe tables.
- `strikethrough` recognizes GFM `~~text~~` deletion.
- `autolinks` recognizes GFM bare web addresses and email addresses. It does not
  govern the base grammar's angle-bracket autolinks.
- `footnotes` recognizes case-insensitive ASCII labels made from letters,
  digits, `_`, and `-`. A reference is `[^label]`; a definition starts
  `[^label]: text` with optional following lines indented by four spaces or one
  tab. Definitions require content and must be unique after case folding.
  Referenced definitions are removed from their written position and emitted in
  first-reference order in a final `section.footnotes`; repeated references get
  distinct backlinks. Undefined references remain literal and unreferenced
  definitions emit nothing.

With `raw` true, authored HTML is copied into the generated HTML. With `raw`
false, authored inline and block HTML is HTML-escaped; HTML generated from
Markdown remains markup. This is an encoding control, not sanitization.

A verbatim profile requires no extensions and `raw` true, and its output is the
exact source. Its separator still controls excerpts.

Only the four extension names above are accepted. Extensions are a set:
declaration order is irrelevant, while a duplicate is malformed. Declaration
copies its options.

An empty separator disables excerpts. Otherwise the first exact, case-sensitive
occurrence splits the source. The excerpt is the independently converted prefix,
excluding the separator. A separator at the beginning therefore creates a
present empty excerpt; one at the end creates the conversion of the whole prefix.
The separator remains part of the full source and is converted rather than
removed. Conversion does not evaluate Liquid or any other template notation, so
an application may evaluate Liquid before converting without interference.

Profile identity is the SHA-256 digest of a canonical tuple containing its name
and normalized settings. Conversion identity is the SHA-256 digest of the
canonical `(subject, part)` tuple, so punctuation in either value cannot create
delimiter collisions. Both identities are stable across concept instances.

The stored digest is SHA-256 of the exact source. Cache equality also compares
the source text itself rather than relying on digest equality alone.

#### Contracts

```contracts
contract current-profile-and-conversion-keys
  At most one current Profile exists per Name, and at most one Conversion exists
  per Subject and Part.
```

### Delivering

**Purpose.** Coordinate one aggregate task answer with failures already delivered at its boundary,
so settlement cannot race a second terminal answer.

**Principle.** Ada begins delivery for one task. An interruption records that another failure path
already answered it; repeating the interruption changes nothing. Settling returns
that interrupted result and closes the delivery. Another task remains independent.
An interruption that arrives just before its begin is retained, so consequence
ordering cannot erase an already delivered failure.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `begin (task: Task) : return (task: Task, changed: Flag)`

**Authored behavior:**

    where task is not Text
    then
      refuse INVALID_TASK "A delivery task must be a well-formed text identity."
    where task already has an active delivery
    then
      return task and changed false
    then
      add or activate its delivery without clearing an earlier interruption
      return task and changed true

**Registered refusal codes:** `INVALID_TASK`

##### `interrupt (task: Task) : return (task: Task, changed: Flag)`

**Authored behavior:**

    where task is not Text
    then
      refuse INVALID_TASK "A delivery task must be a well-formed text identity."
    where task is already interrupted
    then
      return task and changed false
    then
      add or interrupt its delivery and return task and changed true

**Registered refusal codes:** `INVALID_TASK`

##### `settle (task: Task) : return (task: Task, interrupted: Flag)`

**Authored behavior:**

    where task is not Text
    then
      refuse INVALID_TASK "A delivery task must be a well-formed text identity."
    where task has no active delivery
    then
      refuse DELIVERY_NOT_ACTIVE "This task has no active aggregate delivery."
    then
      remove and return its delivery result

**Registered refusal codes:** `INVALID_TASK`, `DELIVERY_NOT_ACTIVE`

#### Queries

##### `_delivery (task: Task) : optional (active: Flag, interrupted: Flag)`

**Authored behavior:**

    Returns no row when the Task has no retained Delivery, including after
    `settle`.

#### Types

```types
Task = Text
  An opaque delivery task identity.
```

#### Contracts

```contracts
contract one-delivery-per-task
  At most one delivery exists per task.
```

### Depending

**Purpose.** Remember what each piece of work used, so a change marks only the work that must
be done again and can explain why.

**Principle.** Ada starts a result, notes the things she uses, and finishes it. It is now up to
date. When one of those things changes, the result needs doing again and
remembers what changed; unrelated results stay up to date. Anything that used
that result needs doing again too, however many results the change passes
through. An unfinished result is marked as well, so it can be retried.

After a result has settled, its last successful input graph remains in force
through a later replacement attempt. Inputs noted by that replacement are
provisional and replace the retained graph only if that attempt settles. A
stale, restarted, or incomplete replacement therefore cannot discard
last-known-good edges. Before a result has settled for the first time, its most
recent attempt is its only graph and can be marked stale. An input can be noted
while its result is being worked on or after it is current. A use that arrives
after settlement extends the retained graph without reopening an attempt; this
allows independently scheduled tracking reactions to finish after the reaction
that settles the result.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `begin (subject: Subject) : return (result: Result, attempt: Number)`

**Authored behavior:**

    where subject is not Text
    then
      refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
    where no result has subject
    then
      add a result with no uses or reason, start an empty attempt, set it to building, and return it
    where a result has subject
    and its attempt number is exhausted
    then
      refuse ATTEMPT_EXHAUSTED "No further computation attempt can be represented."
    where a result has subject and another attempt can be represented
    then
      discard its uncommitted attempt, retain its uses from the latest settlement if any,
      clear its reason if it was current, start an empty attempt, set it to building, and return it

**Registered refusal codes:** `INVALID_TEXT`, `ATTEMPT_EXHAUSTED`

##### `use (subject: Subject, attempt: Number, input: Input) : return (use: Use)`

**Authored behavior:**

    where subject or input is not Text
    then
      refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
    where no result for subject is building or current
    then
      refuse NOT_BUILDING "This result is not being computed."
    where attempt is not the result's current attempt
    then
      refuse STALE_ATTEMPT "This computation attempt is no longer active."
    where a result for subject is building
    then
      add input to its active attempt if none exists and return its use
    where a result for subject is current
    then
      add input to its retained uses if none exists and return its use

**Registered refusal codes:** `INVALID_TEXT`, `NOT_BUILDING`, `STALE_ATTEMPT`

##### `settle (subject: Subject, attempt: Number) : return (result: Result)`

**Authored behavior:**

    where subject is not Text
    then
      refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
    where no result for subject is building
    then
      refuse NOT_BUILDING "This result is not being computed."
    where attempt is not the result's current attempt
    then
      refuse STALE_ATTEMPT "This computation attempt is no longer active."
    where a result for subject is building
    then
      replace its retained uses atomically with its active attempt's inputs, set it to current,
      retain its reason, and return it

**Registered refusal codes:** `INVALID_TEXT`, `NOT_BUILDING`, `STALE_ATTEMPT`

##### `abandon (subject: Subject, attempt: Number) : return (result: Result)`

**Authored behavior:**

    where subject is not Text
    then
      refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
    where no result for subject is building
    then
      refuse NOT_BUILDING "This result is not being computed."
    where attempt is not the result's current attempt
    then
      refuse STALE_ATTEMPT "This computation attempt is no longer active."
    where a result for subject is building
    then
      discard its provisional inputs, retain its last successful graph, and make it stale
      return it

**Registered refusal codes:** `INVALID_TEXT`, `NOT_BUILDING`, `STALE_ATTEMPT`

##### `touch (input: Input) : return (input: Input, count: Number)`

**Authored behavior:**

    where input is not Text
    then
      refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
    then
      visit every direct and transitive dependent through Uses by shortest path, including through already-stale Results
      break equal-length paths by the reaching Input lowest in UTF-8 byte order
      set each visited result that is not stale to stale with the reaching input as its reason
      return input and how many results became stale

**Registered refusal codes:** `INVALID_TEXT`

##### `drop (subject: Subject) : return (result: Result)`

**Authored behavior:**

    where subject is not Text
    then
      refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
    then
      remove the result, its retained uses, and its active attempt if present
      do not mark dependent Results stale
      return the stable result identity whether or not the result was present

**Registered refusal codes:** `INVALID_TEXT`

#### Queries

##### `_state (subject: Subject) : one (state: State)`

**Authored behavior:**

    Returns stale for an unknown or non-Text Subject. This virtual answer means no
    current result exists and does not add a row to _stale. No query row contains
    a mutable value.

##### `_current (subject: Subject) : optional (result: Result)`

**Authored behavior:**

    Returns a row only for a current Result. An unknown or non-Text Subject, or a
    retained Result in another state, returns no row.

##### `_attempt (subject: Subject) : optional (attempt: Number)`

**Authored behavior:**

    Returns the attempt for every retained Result. An unknown or non-Text Subject
    returns no row.

##### `_reason (subject: Subject) : optional (reason: Input)`

**Authored behavior:**

    Returns a row only when the retained Result has a reason. An unknown or
    non-Text Subject returns no row.

##### `_stale () : many (subject: Subject, reason: Input)`

**Authored behavior:**

    Lists only stale Results that have a reason, in ascending UTF-8 byte order by
    subject.

##### `_uses (subject: Subject) : many (input: Input)`

**Authored behavior:**

    Returns the visible input graph. While a replacement is building or stale,
    this is the retained graph and excludes provisional inputs. Before the first
    settlement, it is the most recent attempt's inputs. Inputs are in ascending
    UTF-8 byte order. An unknown or non-Text Subject returns no rows.

##### `_dependents (input: Input) : many (subject: Subject)`

**Authored behavior:**

    Uses the same visible graph as _uses; touch follows this graph's transitive
    closure. Subjects are in ascending UTF-8 byte order. A non-Text Input returns
    no rows.

#### Types

```types
Subject = Text
  An opaque result key.

Input = Text
  An opaque dependency key in the same namespace as Subject.

State = "building" | "current" | "stale"
```

Text is a well-formed Unicode string. Subjects and inputs are opaque Text in one
shared namespace: an input may also be the subject of a result, which is how
invalidation travels from one result to another. Depending does not require an
input to have its own result.

Result and use identities are deterministic, collision-free encodings of their
keys. Repeated beginnings, repeated uses, and drop followed by begin reuse those
identities. Replacing a result's input set keeps its result identity; removing
one input and adding another removes the old use and returns a different use
identity.

A reason is the immediate input through which a result was first reached by the
touch that made it stale. Direct dependents therefore name the touched input;
transitive dependents name another result's subject. An already-stale result
keeps its earlier reason. A stale result keeps that reason while it is retried
and after it settles, so inspection can report why the latest recomputation
happened. Beginning a current result explicitly clears the previous reason.

#### Contracts

```contracts
contract result-and-use-keys
  At most one Result exists per Subject, and at most one Use exists per Result
  and Input.
```

### Deploying

**Purpose.** Own the ordered queue, historical snapshots, and preparation state of one
static deployment, so every returned current item is already active and later
work cannot begin before earlier work reaches a terminal outcome.

**Principle.** Ada starts one policy containing a marker, redirects, pagination, a sitemap,
and a feed. Starting atomically activates and returns the marker. Completing,
rejecting, rejecting by owner or producer, and failing each current item
atomically activate the next item they return. Dividing an active pagination
plan atomically replaces it with numbered pages and activates the first page,
including one page for an empty collection. Preparation records independently
computed redirect documents, pagination contexts, sitemap documents, and feed
results without generating them. An invalid or originless feed result remains
active, cannot complete, and can be diagnosed and rejected so the queue
continues. The final outcome distinguishes a wholly completed queue from one
containing failed work.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `start (policy: Policy) : return (deployment: Deployment, work?: Work, completed: Flag)`

**Authored behavior:**

    where policy does not have the supported deployment shape, contains an invalid or cyclic redirect, pagination route, or feed path, or repeats a redirect source or pagination name
    then
      refuse INVALID_POLICY "A deployment policy must have the supported publishing shape."
    where a deployment was already started
    then
      refuse DEPLOYMENT_ACTIVE "A deployment was already started."
    where no deployment was started
    then
      add work in declared precedence
      activate and return the first work, or completed true when policy produces none

**Registered refusal codes:** `INVALID_POLICY`, `DEPLOYMENT_ACTIVE`

##### `complete (work: Work) : return (deployment: Deployment, work?: Work, completed: Flag)`

**Authored behavior:**

    where work is not current
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where work is pending, failed, or completed
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where work is active but is not marker work
    then
      refuse WORK_NOT_PREPARED "Deployment work must be prepared before completion."
    where work is an active marker or is prepared
    then
      make it completed, advance, and atomically activate and return the next work or completed true

**Registered refusal codes:** `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`, `WORK_NOT_PREPARED`

##### `reject (work: Work) : return (deployment: Deployment, work?: Work, completed: Flag)`

**Authored behavior:**

    where work is not current
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where work is not active or prepared
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where work is active or prepared
    then
      make it failed, advance, and atomically activate and return the next work or completed true

**Registered refusal codes:** `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`

##### `rejectOwner (owner: Owner) : return (deployment: Deployment, work?: Work, completed: Flag)`

**Authored behavior:**

    where the latest deployment has no current work for owner
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where the owner's work is not active or prepared
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where the owner's work is active or prepared
    then
      reject it and atomically activate and return the next work or completed true

**Registered refusal codes:** `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`

##### `rejectProducer (producer: Producer) : return (deployment: Deployment, work?: Work, completed: Flag)`

**Authored behavior:**

    where the latest deployment has no current work for producer
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where the producer's work is not active or prepared
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where the producer's work is active or prepared
    then
      reject it and atomically activate and return the next work or completed true

**Registered refusal codes:** `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`

##### `divide (deployment: Deployment, work: Work, template: Template, entries: Entries) : return (deployment: Deployment, work: Work, pages: Number)`

**Authored behavior:**

    where entries are not a dense list of structured-cloneable identified cards with routed URLs
    then
      refuse INVALID_ENTRIES "Deployment entries must be a dense list of structured-cloneable identified cards."
    where work is not current
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where work is not the current active pagination plan
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where work is the active pagination plan
    then
      replace it atomically with at least one ordered pending page, activate the first page, and return it

**Registered refusal codes:** `INVALID_ENTRIES`, `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`

##### `redirect (work: Work, target: Url, canonical: Url, content: Text) : return (content: Text)`

**Authored behavior:**

    where work is not current
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where work is not the current active redirect
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where target and canonical are not a valid local or external projection of the configured target
    then
      refuse INVALID_REDIRECT "Redirect preparation requires a valid projection of its configured target."
    where content is not well-formed text
    then
      refuse INVALID_PREPARATION "Deployment preparation must match the current work snapshot."
    where work and preparation are valid
    then
      make it prepared and return the independently computed content

**Registered refusal codes:** `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`, `INVALID_REDIRECT`, `INVALID_PREPARATION`

##### `context (work: Work, context: Value) : return (owner: Owner, template: Template, context: Value)`

**Authored behavior:**

    where work is not current
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where work is not the current active pagination page
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where context cannot be copied
    then
      refuse INVALID_CONTEXT "Deployment context values must be structured-cloneable."
    where work and context are valid
    then
      make it prepared and return an independent context with the work's owner and template

**Registered refusal codes:** `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`, `INVALID_CONTEXT`

##### `snapshotFeed (work: Work, site: Value, entries: Entries) : return (work: Work, path: Path, title: Text | null, description: Text | null, site: Value, entries: Entries)`

**Authored behavior:**

    where work is not current
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where work is not the current active feed
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where entries are not a dense list of structured-cloneable identified cards
    then
      refuse INVALID_ENTRIES "Deployment entries must be a dense list of structured-cloneable identified cards."
    where the snapshot cannot be copied
    then
      refuse INVALID_PREPARATION "Deployment preparation must match the current work snapshot."
    then
      return independent copies of the feed policy, site, and entries without changing work state

**Registered refusal codes:** `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`, `INVALID_ENTRIES`, `INVALID_PREPARATION`

##### `prepareFeed (work: Work, preparation: Value) : return (path: Path, content: Text, invalid: Number, valid: Flag, origin: Flag)`

**Authored behavior:**

    where work is not current
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where work is not the current active feed
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where preparation does not contain the configured path, well-formed content, a nonnegative invalid count, and consistent validity and origin flags
    then
      refuse INVALID_PREPARATION "Deployment preparation must match the current work snapshot."
    where preparation has an origin and no invalid entries
    then
      make work prepared and return the independent preparation
    where preparation is originless or has invalid entries
    then
      leave work active and return the independent preparation for diagnosis

**Registered refusal codes:** `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`, `INVALID_PREPARATION`

##### `snapshotSitemap (work: Work, urls: Urls) : return (work: Work, path: Path, urls: Urls)`

**Authored behavior:**

    where urls are not a dense list of absolute HTTP URL records
    then
      refuse INVALID_URLS "Sitemap URLs must be a dense list of absolute HTTP URL records."
    where work is not current
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where work is not the current active sitemap
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    then
      return an independent URL snapshot without changing work state

**Registered refusal codes:** `INVALID_URLS`, `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`

##### `prepareSitemap (work: Work, content: Text) : return (path: Path, content: Text)`

**Authored behavior:**

    where work is not current
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where work is not the current active sitemap
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where content is not well-formed text
    then
      refuse INVALID_PREPARATION "Deployment preparation must match the current work snapshot."
    where work and preparation are valid
    then
      make it prepared and return its path and independently computed content

**Registered refusal codes:** `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`, `INVALID_PREPARATION`

##### `fail (producer: Producer, path: Path, code: Code, detail: Text) : return (deployment: Deployment, work?: Work, completed: Flag, path: Path, code: Code, message: Text)`

**Authored behavior:**

    where the latest deployment has no current work for producer
    then
      refuse WORK_NOT_CURRENT "Deployment work must be the current item."
    where the producer's work is not active or prepared
    then
      refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
    where the producer's work is active or prepared
    then
      mark it failed, advance, atomically activate and return the next work or completed true, and return a path-prefixed message

**Registered refusal codes:** `WORK_NOT_CURRENT`, `WORK_NOT_ACTIVE`

#### Queries

##### `_work (work: Work) : optional WorkRow`

**Authored behavior:**

    Returns no row for unknown work. Every work query includes only the fields
    defined for the work's kind; all other fields are absent. All query results
    are copies.

##### `_forOwner (owner: Owner) : optional WorkRow`

**Authored behavior:**

    Looks only in the sole deployment and uses `_work`'s kind-specific projection.
    Returns no row when that deployment has no work for the owner.

##### `_forProducer (producer: Producer) : optional WorkRow`

**Authored behavior:**

    Looks only in the sole deployment and uses `_work`'s kind-specific projection.
    Returns no row when that deployment has no work for the producer.

##### `_current () : optional WorkRow`

**Authored behavior:**

    Uses `_work`'s kind-specific projection and returns no row before a deployment
    starts or after its queue is exhausted. Queue order is marker, redirects by
    validated policy order, pagination by validated policy order and page number,
    sitemap, then feed.

##### `_outcome () : one (state: State)`

**Authored behavior:**

    Reports `absent` before a deployment starts, `active` while current work
    remains, `failed` when an exhausted queue contains failed work, and `completed`
    otherwise. A true `completed` flag returned by an action means only that the
    queue is exhausted; it does not imply a `completed` outcome.

#### Types

```types
Policy = external
  A publishing policy record in the supported deployment shape.

Owner = Text
Producer = Text
Template = Text
Name = Text
Collection = Text
Path = Text
Address = Text
Url = Text
Code = Text

Value = external
  A value accepted by the host structured-clone operation.

Values = List<Value>

Entries = external
  A dense list of structured-cloneable identified-card records.

Urls = external
  A dense list of records containing absolute HTTP URLs.

Kind = "nojekyll" | "redirect" | "pagination-plan" | "pagination-page" | "sitemap" | "feed"
Status = "pending" | "active" | "prepared" | "failed" | "completed"
State = "absent" | "active" | "failed" | "completed"

WorkRow = record
  work: Work
  deployment: Deployment
  kind: Kind
  status: Status
  owner?: Owner
  producer?: Producer
  path?: Path
  from?: Address
  to?: Url
  name?: Name
  collection?: Collection
  perPage?: Number
  route?: Address
  templateName?: Name
  title?: Value
  template?: Template
  number?: Number
  pages?: Number
  address?: Address
  previous?: Value
  next?: Value
  cards?: Values
  sourcePath?: Path
  description?: Value
```

#### Contracts

```contracts
contract deployment-snapshots on start, divide, context, snapshotFeed, snapshotSitemap
  A Deployment retains independent Policy and pagination-card snapshots.
  Context and snapshot actions return independent copies. Preparation results
  are returned rather than retained; only their declared Work transitions remain.
```

### Diagnosing

**Purpose.** Keep the problems found during a task together, so people can see everything
available in one stable, ordered report.

**Principle.** Ada checks two records. She reports an error in one, a warning in the other, and
another error later in the first. Reading the list gives both errors before the
warning, with problems at the same severity ordered by source, position, and
code. One error names a related place to inspect. Reporting that error and its
related place again makes no copies. While either error remains the check is not
clean. Retracting the first record's problems leaves the warning and makes the
check clean; clearing leaves no problems at all.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `report (scope?: Scope, severity: Severity, code: Code, message: Text, source?: DiagnosticSource, line?: Position, column?: Position) : return (diagnostic: Diagnostic)`

**Authored behavior:**

    where severity is neither error nor warning
    then
      refuse UNKNOWN_SEVERITY "A diagnostic is an error or a warning."
    where a present scope, code, message, or a present source is not Text
    then
      refuse INVALID_TEXT "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text."
    where a position is not a positive safe integer, has no source, or has a column without a line
    then
      refuse INVALID_LOCATION "A location needs a source; line and column must be positive safe integers, and a column needs a line."
    where a diagnostic already has scope, severity, code, source, line, and column
    then
      retain its first message and relations and return that diagnostic
    where no diagnostic has that key
    then
      add it and return its stable identity

**Registered refusal codes:** `UNKNOWN_SEVERITY`, `INVALID_TEXT`, `INVALID_LOCATION`

##### `relate (diagnostic: Diagnostic, source: DiagnosticSource, line?: Position, column?: Position, note: Text) : return (relation: Relation)`

**Authored behavior:**

    where diagnostic, source, or note is not Text
    then
      refuse INVALID_TEXT "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text."
    where diagnostic not in diagnostics
    then
      refuse DIAGNOSTIC_NOT_FOUND "There is no such diagnostic."
    where a position is not a positive safe integer or has a column without a line
    then
      refuse INVALID_LOCATION "A location needs a source; line and column must be positive safe integers, and a column needs a line."
    where that exact relation exists
    then
      return it without adding a copy
    where that exact relation does not exist
    then
      add it and return its stable identity

**Registered refusal codes:** `INVALID_TEXT`, `DIAGNOSTIC_NOT_FOUND`, `INVALID_LOCATION`

##### `retract (scope?: Scope, source?: DiagnosticSource) : return (scope: Scope | undefined, source: DiagnosticSource | undefined, count: Number)`

**Authored behavior:**

    where a present scope or source is not Text
    then
      refuse INVALID_TEXT "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text."
    where scope and source are Text or missing
    then
      remove every diagnostic with that optional scope and source and all of its relations
      return scope, source, and how many diagnostics were removed

**Registered refusal codes:** `INVALID_TEXT`

##### `clear () : return (count: Number)`

**Authored behavior:**

    then
      remove every diagnostic and relation
      return how many diagnostics were removed

#### Queries

##### `_all () : many (diagnostic: Diagnostic, scope: Scope | undefined, severity: Severity, code: Code, message: Text, source: DiagnosticSource | undefined, line: Position | undefined, column: Position | undefined)`

**Authored behavior:**

    Orders errors before warnings, then by scope, source, line, column, and code.
    Missing scopes, sources, lines, and columns sort before present values;
    present scopes and sources and all codes use ascending UTF-8 byte order, and
    positions use ascending numeric order. The uniqueness key makes this a total
    order independent of reporting order. `scope`, `source`, `line`, and `column`
    are always own properties; an absent value is `undefined`.

##### `_errors () : many (diagnostic: Diagnostic, scope: Scope | undefined, code: Code, message: Text, source: DiagnosticSource | undefined, line: Position | undefined, column: Position | undefined)`

**Authored behavior:**

    Returns the errors in their `_all` order. `scope`, `source`, `line`, and
    `column` are always own properties; an absent value is `undefined`.

##### `_for (source?: DiagnosticSource) : many (diagnostic: Diagnostic, scope: Scope | undefined, severity: Severity, code: Code, message: Text, line: Position | undefined, column: Position | undefined)`

**Authored behavior:**

    Treats an omitted or explicit `undefined` source as the absent source and
    returns no rows for a malformed source. Matching diagnostics retain their
    `_all` order. `scope`, `line`, and `column` are always own properties; an
    absent value is `undefined`.

##### `_related (diagnostic: Diagnostic) : many (source: DiagnosticSource, line: Position | undefined, column: Position | undefined, note: Text)`

**Authored behavior:**

    Returns no rows for an unknown or malformed Diagnostic. Orders by source in
    ascending UTF-8 byte order, then line, column, and note, with missing
    positions first. The uniqueness key makes this a total order. `line` and
    `column` are always own properties; an absent value is `undefined`.

##### `_rendered () : one (text: Text)`

**Authored behavior:**

    Writes one entry per standing Diagnostic in `_all` order: upper-case
    severity, code, optional source and position, and message. Entries are
    newline-separated, and newlines in messages remain present. Returns one fixed
    sentence when no Diagnostic stands.

##### `_clean () : one (clean: Flag)`

**Authored behavior:**

    Always returns one row. `clean` is true when no error stands, including when
    warnings stand, and false otherwise.

#### Types

```types
Scope = Text
  The check that owns replacement of a diagnostic.

Code = Text
  An application-defined diagnostic code.

DiagnosticSource = Text
  An application-defined source location name.

Severity = "error" | "warning"

Position = PositiveInteger
  A one-based line or column.
```

Text is a well-formed Unicode string. Scopes, codes, messages, sources, diagnostic
identities, and relation notes must be Text. Empty Text and control characters
are valid; Diagnosing stores and compares these values but does not interpret
their vocabulary. Actions refuse malformed Text before changing state. Lookup
queries given malformed Text answer no row.

A diagnostic scope and source are optional. Omission and explicit `undefined`
both mean absence. A line is optional and requires a source. A column is
optional and requires a line. A related location always has a source and follows
the same optional line and column rules.

A diagnostic is keyed by its optional scope, severity, code, optional source,
optional line, and optional column. Its opaque identity is a deterministic,
collision-safe encoding of that tuple, so punctuation and control characters
cannot make two keys collide. The identity is stable across concept instances,
scope-and-source retraction, and later reporting of the same key.

A related location is keyed by its diagnostic, source, optional line, optional
column, and note. Repeating it returns the same stable identity; another note or
location remains a separate relation. Relation identities are deterministic and
stable under the same conditions.

#### Contracts

```contracts
contract diagnostic-keys
  At most one Diagnostic exists per scope, Severity, Code, source, line, and
  column, and at most one Relation exists per Diagnostic, DiagnosticSource,
  line, column, and note.

contract relation-owner
  Every Relation refers to a present Diagnostic.
```

### Documenting

**Purpose.** Separate a document's YAML details from the body they describe, so both can be
kept in one ordinary text and read independently.

**Principle.** Ada writes a note with a `---` header containing a title, followed by prose.
Parsing it returns the title as an attribute and the exact prose as the body,
and remembers which line starts that body. A note without a header is all body
and has no attributes. Parsing a valid revision for the same subject replaces
the old values but keeps the document identity. A malformed or unclosed revision
is refused and leaves the previous valid document unchanged. Forgetting removes
the document.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `parse (subject: Subject, text: Text) : return (document: Document, attributes: Values, body: Text)`

**Authored behavior:**

    where text has an unclosed front-matter header or its attributes are outside the normalized YAML subset
    then
      refuse MALFORMED_ATTRIBUTES "The attributes at the top of this document cannot be parsed."
    where text has no front-matter header or has a well-formed one
    then
      atomically replace the document values for subject while keeping its stable identity
      return the document, a copy of its attributes, and its body

**Registered refusal codes:** `MALFORMED_ATTRIBUTES`

##### `forget (subject: Subject) : return (document: Document)`

**Authored behavior:**

    where subject has no document
    then
      refuse DOCUMENT_NOT_FOUND "There is no document for this subject."
    where subject has a document
    then
      remove it

**Registered refusal codes:** `DOCUMENT_NOT_FOUND`

#### Queries

##### `_document (subject: Subject) : optional (document: Document, attributes: Values, body: Text, bodyLine: Number)`

**Authored behavior:**

    Returns no row when subject has no document. Attributes returned here and by
    `parse` are deep copies; mutating an observation cannot change stored state or
    a later observation.

##### `_all () : many (document: Document, subject: Subject)`

**Authored behavior:**

    Returns one row per subject in ascending JavaScript string order, which
    compares UTF-16 code units.

#### Types

```types
Subject = JavaScriptString

AttributeValue = null | Flag | Number | JavaScriptString | List<AttributeValue> | Values
Values = Map<JavaScriptString, AttributeValue>
  A normalized YAML mapping with unique literal string keys. No key order is implied.
```

A text has front matter only when its first physical line is exactly the three
ASCII characters `---`. The opening fence has no leading or trailing whitespace,
comment, or byte-order mark. The closing fence is the first later physical line
that is also exactly `---`. A fence line may end in LF or CRLF; each fence may
use either ending independently. A lone CR is text, not a line ending. `...`, an
indented `---`, and a `---` with whitespace or a comment are not fences.

The opening fence at end of input, or an opening fence with no exact closing
fence, is malformed. The YAML source is the exact text between the two fences.
The body is the exact suffix after the closing fence's line ending, with no
newline normalization. A closing fence at end of input has an empty body. A
closing fence followed only by its line ending also has an empty body. Blank
lines after the closing fence are part of the body.

`bodyLine` is one-based. With front matter it is the line immediately after the
closing fence, even when the body is empty and that line lies just past the end
of the text. Without front matter it is 1.

Front matter is one YAML 1.2 document using the YAML 1.2 Core schema. Parser
warnings are malformed. Empty or comment-only front matter is the empty mapping;
every non-empty root must be a mapping. Scalar, sequence, and explicit null roots
are malformed.

The normalized value model contains null, booleans, strings, finite binary64
numbers, sequences of normalized values, and mappings from strings to normalized
values. Integer syntax is read without rounding and is accepted only within
JavaScript's safe integer range; accepted integers are represented as numbers.
NaN, infinities, and integers outside that range are malformed.

Only implicit Core tags and the explicit Core tags `!!map`, `!!seq`, `!!str`,
`!!null`, `!!bool`, `!!int`, and `!!float` are accepted. Custom tags and YAML 1.1
tags such as `!!binary`, `!!set`, and `!!timestamp` are malformed. Merge keys are
not enabled, so `<<` is an ordinary string key.

Every mapping key must be a literal string scalar and keys must be unique as
strings. Numeric, boolean, null, alias, and collection keys are malformed rather
than being converted to strings. Mappings are materialized as ordinary safe
objects; names such as `__proto__` remain ordinary own data properties.

Anchors and aliases are accepted. Each alias is expanded into an independent
normalized value. Cyclic, unresolved, or excessive expansion is malformed; at
most 100 alias expansions may be materialized by one parse.

#### Contracts

```contracts
contract stable-document-identity on parse, forget
  Document identity is `document:` followed by the JSON string encoding of the complete Subject; it is stable across replacement, forgetting, reparsing, and separate concept instances, and distinct Subjects have distinct identities.
```

### Embedding

**Purpose.** Build one safe HTML `picture` element from a required original image and any
derived versions, so a browser can choose a suitable format and width.

**Principle.** Ada publishes an image by giving its original address, format, size, alternative
text, and how many optimized versions will follow. The original is always the
fallback. If no optimized versions are promised, usable markup is ready at once.
Otherwise markup appears only when exactly the promised number of distinct
versions has arrived. Versions may arrive in any order: formats follow their
stated order, widths rise within each format, and the original format is always
last on the `img`. Repeating an identical version reports no change and never
announces completion twice. A correction may replace that address before
completion; after completion, corrections and extra versions are refused, so
published markup cannot change silently. Repeating the same declaration keeps
its versions, while changing the declaration starts it again. Withdrawing it
removes the declaration and every version.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `declare (subject: Subject, alternative: Text, width: PositiveInteger, height: PositiveInteger, expects: NonnegativeInteger, original: Address, originalFormat: Format, attributes: Attributes) : return (embedding: Embedding, changed: Flag, completed: Flag)`

**Authored behavior:**

    where subject is not Text, or alternative is not serializable Text
    then
      refuse INVALID_TEXT "Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character."
    where width or height is not a positive safe integer
    then
      refuse INVALID_DIMENSION "Intrinsic width and height must be positive safe integers."
    where expects is not a nonnegative safe integer
    then
      refuse INVALID_COUNT "Expected offer count must be a nonnegative safe integer."
    where original is not an Address
    then
      refuse INVALID_ADDRESS "Image addresses must be safe site-absolute srcset addresses."
    where originalFormat is not a canonical Format
    then
      refuse INVALID_FORMAT "Image format must be one of the canonical supported formats."
    where attributes is not an approved attribute record
    then
      refuse INVALID_ATTRIBUTES "Image attributes must be a plain record of text attributes."
    where the same declaration already exists
    then
      retain its offers and return embedding, changed false, and completed false
    where the declaration is new or different
    then
      replace any embedding for subject and all its offers
      add the supplied declaration
      return embedding, changed true, and completed true exactly when expects is zero

**Registered refusal codes:** `INVALID_TEXT`, `INVALID_DIMENSION`, `INVALID_COUNT`, `INVALID_ADDRESS`, `INVALID_FORMAT`, `INVALID_ATTRIBUTES`

##### `offer (embedding: Embedding, address: Address, format: Format, width: PositiveInteger, order: NonnegativeInteger) : return (offer: Offer, embedding: Embedding, arrived: Number, changed: Flag, completed: Flag)`

**Authored behavior:**

    where embedding is not Text
    then
      refuse INVALID_TEXT "Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character."
    where embedding is not present
    then
      refuse EMBEDDING_NOT_FOUND "There is no such embedding."
    where address is not an Address
    then
      refuse INVALID_ADDRESS "Image addresses must be safe site-absolute srcset addresses."
    where format is not a canonical Format
    then
      refuse INVALID_FORMAT "Image format must be one of the canonical supported formats."
    where width is not a positive safe integer, or exceeds the intrinsic width
    then
      refuse INVALID_WIDTH "Offer width must be a positive safe integer no greater than the intrinsic width."
    where order is not a nonnegative safe integer
    then
      refuse INVALID_ORDER "Offer order must be a nonnegative safe integer."
    where this address already has the same format, width, and order
    then
      return its offer and arrived count, changed false, and completed false
    where the embedding is complete and the offer is new or changed
    then
      refuse EMBEDDING_COMPLETE "A completed embedding cannot accept a changed or additional offer."
    where address is the original address, or format and width duplicate another candidate
    then
      refuse OFFER_CONFLICT "An address or format-width candidate is already used by this embedding."
    where this address has different facts and the embedding is incomplete
    then
      replace that offer while retaining its identity
      return offer and the unchanged arrived count, changed true, and completed false
    where this is a new distinct candidate and the embedding is incomplete
    then
      add it and return offer, the new arrived count, changed true, and whether this offer completed the embedding

**Registered refusal codes:** `INVALID_TEXT`, `EMBEDDING_NOT_FOUND`, `INVALID_ADDRESS`, `INVALID_FORMAT`, `INVALID_WIDTH`, `INVALID_ORDER`, `EMBEDDING_COMPLETE`, `OFFER_CONFLICT`

##### `withdraw (subject: Subject) : return (embedding: Embedding, count: Number)`

**Authored behavior:**

    where subject is not Text
    then
      refuse INVALID_TEXT "Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character."
    where subject has no embedding
    then
      refuse EMBEDDING_NOT_FOUND "There is no such embedding."
    where subject has an embedding
    then
      remove it and all its offers
      return embedding and how many derived offers were removed

**Registered refusal codes:** `INVALID_TEXT`, `EMBEDDING_NOT_FOUND`

#### Queries

##### `_embedding (embedding: Embedding) : optional (subject: Subject, original: Address, originalFormat: Format, expects: NonnegativeInteger, arrived: NonnegativeInteger, complete: Flag)`

**Authored behavior:**

    Returns no row for an unknown or non-Text Embedding. `complete` is the
    current completion level.

##### `_for (subject: Subject) : optional (embedding: Embedding, original: Address, originalFormat: Format, expects: NonnegativeInteger, arrived: NonnegativeInteger, complete: Flag)`

**Authored behavior:**

    Returns no row for an unknown or non-Text Subject. `complete` is the current
    completion level.

##### `_offers (embedding: Embedding) : many (offer: Offer, address: Address, format: Format, width: PositiveInteger, order: NonnegativeInteger)`

**Authored behavior:**

    Returns no rows for an unknown or non-Text Embedding. Lists derived offers by
    `order`, then `format`, `width`, and `address`.

##### `_markup (embedding: Embedding) : optional (markup: Text)`

**Authored behavior:**

    Returns no row for an unknown, non-Text, or incomplete Embedding. For a
    complete Embedding, returns one `picture` element. The declared original is
    the `img` `src` and reserves a candidate at its intrinsic width in its
    declared format. Derived candidates in that format at other widths join the
    original in `srcset`; other format groups become `source` elements. Groups
    use their least offered order, then format, while the original-format
    fallback is always last. Widths ascend within each group, followed by order
    and address as deterministic tie-breakers.

#### Types

```types
Subject = Text
  A well-formed Unicode string identifying an embedding.

Address = Text
  A safe site-absolute address for one image candidate.

Format = "avif" | "gif" | "heif" | "jpeg" | "jxl" | "png" | "tiff" | "webp"

Attributes = Map<Text, Text>
  The approved authored image attributes retained by an embedding.
```

Text is a well-formed Unicode string. Alternative text and attribute names and
values must additionally contain no null character. Intrinsic dimensions and
offer widths are positive safe integers, and an offer width does not exceed its
embedding's intrinsic width. Expected counts and orders are nonnegative safe
integers; negative zero is normalized to zero. The expected count names derived
offers only and does not include the declared original.

An Address is a nonempty site-absolute address beginning with one `/`. It has no
raw ASCII whitespace, control character, comma, quote, angle bracket, backtick,
or backslash, and every percent sign begins a two-hex-digit escape. These rules
make one address exactly one HTML `srcset` candidate. Callers percent-encode any
otherwise forbidden address character before declaring or offering it.

Formats are lowercase canonical names with these exact media types:

| Format | Media type |
| --- | --- |
| `avif` | `image/avif` |
| `gif` | `image/gif` |
| `heif` | `image/heif` |
| `jpeg` | `image/jpeg` |
| `jxl` | `image/jxl` |
| `png` | `image/png` |
| `tiff` | `image/tiff` |
| `webp` | `image/webp` |

`attributes` is a plain or null-prototype record of own, enumerable text data
properties. The declaration copies `class`, `crossorigin`, `dir`,
`fetchpriority`, `id`, `lang`, `referrerpolicy`, `role`, `sizes`, `title`,
`aria-*`, and `data-*`. Preserved names are lowercase. Enumerated attributes
accept only their standard lowercase values. Accessors, non-enumerable
properties, symbols, proxies, non-plain records, and non-text or null-containing
names or values make the record malformed and are refused. Event handlers,
`style`, invalid enumerated values, and every other safe text attribute are
omitted.

The concept intentionally replaces authored `src`, `srcset`, `width`, `height`,
`alt`, `loading`, and `decoding`. The output uses the declared original and
dimensions, escaped alternative text, `loading="lazy"`, and
`decoding="async"`. Preserved attributes follow those owned attributes in
ascending UTF-8 name order. Every attribute value and address is HTML-escaped
during serialization. A preserved `sizes` value is also copied to every
generated `source`, so all format groups use the same responsive width rule.

#### Contracts

```contracts
contract embedding-keys
  At most one Embedding exists per Subject, one Offer per Embedding and Address,
  and one candidate per Embedding, Format, and width.

contract stable-identities on declare, offer, withdraw
  An Embedding identity is determined by its Subject, and an Offer identity by
  its Embedding and Address. Replacing or later recreating either key preserves
  its opaque identity.
```

### Emitting

**Purpose.** Keep a destination holding exactly the intended files, without letting two
producers put different artifacts at one path or an unfinished replacement
disturb what is current.

**Principle.** Ada points Emitting at a folder containing an old file. A producer opens an
attempt and stages two files. Nothing in the folder changes until the attempt
finishes; reconciling after it finishes writes both files and removes the old
one. A later attempt stages replacements and is abandoned; both earlier files
stay in place and its reserved paths become available immediately. A successful
attempt that names only one replaces that producer's complete set and lets the
other be removed. Two producers may share one path when their bytes agree, but
different bytes or a file-versus-directory overlap are refused. Retracting a
producer gives up all of its paths.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `direct (destination: Root, prefix: Root) : return (destination: Root, existing: Number)`

**Authored behavior:**

    where destination or prefix is empty or malformed, destination is the filesystem root or an existing non-directory, or prefix is not a distinct sibling prefix
    then
      refuse INVALID_DESTINATION "A destination must name a directory other than the filesystem root."
    where destination cannot be inspected
    then
      refuse DESTINATION_UNAVAILABLE "The destination could not be inspected."
    where destination is absent or is an inspectable directory
    then
      leave an absent destination absent
      record every regular file and non-directory entry it currently holds
      replace the previously directed destination and transaction prefix only after inspection succeeds
      return destination and the number of recorded entries

**Registered refusal codes:** `INVALID_DESTINATION`, `DESTINATION_UNAVAILABLE`

##### `begin (producer: Producer) : return (producer: Producer, attempt: Number)`

**Authored behavior:**

    where producer is not well-formed text
    then
      refuse INVALID_PRODUCER "A producer identity must be well-formed text."
    where producer's attempt is the greatest safe integer
    then
      refuse ATTEMPT_EXHAUSTED "This producer has no remaining safe attempt number."
    where producer is valid and has a remaining attempt number
    then
      add a producer record at attempt zero if none exists
      abandon any unfinished staged intents
      raise its attempt and open an empty staged set
      return producer and attempt

**Registered refusal codes:** `INVALID_PRODUCER`, `ATTEMPT_EXHAUSTED`

##### `intend (producer: Producer, attempt?: Number, path: Path, content: Content, medium: Medium, claim?: Text | null) : return (intent: Intent, path: Path, digest: Digest)`

**Authored behavior:**

    where producer, claim, path, content, and medium are valid, but producer has an open attempt not identified by attempt or has no open attempt and attempt is present
    then
      refuse STALE_ATTEMPT "This producer attempt is no longer active."
    where producer is not well-formed text
    then
      refuse INVALID_PRODUCER "A producer identity must be well-formed text."
    where a present claim is not well-formed text
    then
      refuse INVALID_CLAIM "An artifact claim identity must be well-formed text."
    where path is absolute or climbs outside the destination
    then
      refuse PATH_LEAVES_DESTINATION "An artifact path must stay inside the destination."
    where path is not canonical
    then
      refuse INVALID_PATH "An artifact path must use the canonical portable form."
    where content is neither bytes nor well-formed text
    then
      refuse INVALID_CONTENT "Artifact content must be bytes or well-formed text."
    where medium is not well-formed text
    then
      refuse INVALID_MEDIUM "An artifact medium must be well-formed text."
    where another producer or a different claim from this producer reserves path with different bytes, or a reservation that would coexist with this intent overlaps path as an ancestor or descendant
    then
      refuse PATH_CONTESTED "This artifact path conflicts with another intended artifact."
    where the artifact does not conflict
    then
      add the producer at attempt zero if absent
      use producer as claim when claim is omitted, undefined, or null
      copy or encode content and compute its digest
      replace this producer's intent for path in its open stage, or in its active set when no attempt is open
      keep the intent identity for producer and path
      return intent, path, and digest

**Registered refusal codes:** `STALE_ATTEMPT`, `INVALID_PRODUCER`, `INVALID_CLAIM`, `PATH_LEAVES_DESTINATION`, `INVALID_PATH`, `INVALID_CONTENT`, `INVALID_MEDIUM`, `PATH_CONTESTED`

##### `commit (producer: Producer, attempt: Number) : return (producer: Producer, dropped: Number)`

**Authored behavior:**

    where producer is not well-formed text
    then
      refuse INVALID_PRODUCER "A producer identity must be well-formed text."
    where producer has no open attempt
    then
      refuse NOT_BEGUN "This producer has no open attempt."
    where attempt does not identify the open attempt
    then
      refuse STALE_ATTEMPT "This producer attempt is no longer active."
    where producer has an open attempt
    then
      atomically replace its active intents with its staged intents
      close the attempt
      return producer and the number of formerly active paths omitted from the stage

**Registered refusal codes:** `INVALID_PRODUCER`, `NOT_BEGUN`, `STALE_ATTEMPT`

##### `abort (producer: Producer, attempt: Number) : return (producer: Producer, discarded: Number)`

**Authored behavior:**

    where producer is not well-formed text
    then
      refuse INVALID_PRODUCER "A producer identity must be well-formed text."
    where producer has no open attempt
    then
      refuse NOT_BEGUN "This producer has no open attempt."
    where attempt does not identify the open attempt
    then
      refuse STALE_ATTEMPT "This producer attempt is no longer active."
    where producer has an open attempt
    then
      delete every staged intent and release its reservation
      close the attempt without changing its number or any active intent
      return producer and the number of staged paths discarded

**Registered refusal codes:** `INVALID_PRODUCER`, `NOT_BEGUN`, `STALE_ATTEMPT`

##### `retract (producer: Producer) : return (producer: Producer, count: Number)`

**Authored behavior:**

    where producer is not well-formed text
    then
      refuse INVALID_PRODUCER "A producer identity must be well-formed text."
    where producer is valid
    then
      remove its producer record and every active or staged intent
      return producer and the number of distinct paths removed

**Registered refusal codes:** `INVALID_PRODUCER`

##### `reconcile () : return (written: Number, replaced: Number, kept: Number, removed: Number)`

**Authored behavior:**

    where no destination has been directed
    then
      refuse DESTINATION_NOT_DIRECTED "No destination has been directed."
    where the complete intended tree cannot be prepared, installed, or restored
    then
      leave retained intent state unchanged and attempt to restore the prior destination
      refuse RECONCILIATION_FAILED "The intended destination tree could not be installed."
    where reconciliation succeeds
    then
      prepare one complete tree from the active intents
      install it in place of the destination
      leave each byte-equal regular file current, replace each other intended entry, and remove each unintended entry
      remove structural directories that no intended path needs
      set emitted to the active intended paths, bytes, and digests
      return the four artifact-entry counts

**Registered refusal codes:** `DESTINATION_NOT_DIRECTED`, `RECONCILIATION_FAILED`

#### Queries

##### `_intent (path: Path) : optional (digest: Digest, medium: Medium)`

**Authored behavior:**

    Reads active intents at the exact canonical Path and ignores staged intents.
    An invalid, noncanonical, or unreserved Path yields no row. Active Producers
    at one Path agree on exact bytes; when their media differ, the first Producer
    in ascending UTF-8 byte order supplies the medium. Emitting queries expose
    digests and metadata rather than retained content; none returns mutable Bytes.

##### `_producers (path: Path) : many (producer: Producer)`

**Authored behavior:**

    Reports active Producers whose exact, ancestor, or descendant reservation
    contests the exact canonical Path. Only when no active reservation contests
    it are staged Producers reported. Invalid Paths yield no rows; Producers are
    in ascending UTF-8 byte order.

##### `_byProducer (producer: Producer) : many (path: Path, digest: Digest, medium: Medium)`

**Authored behavior:**

    Reports only the Producer's active intents, in ascending UTF-8 byte order of
    Path. An invalid or unknown Producer yields no rows; staged intents are
    ignored.

##### `_attempt (producer: Producer) : optional (attempt: Number)`

**Authored behavior:**

    Reports the Producer's latest attempt number whether or not that attempt is
    open. An invalid or unknown Producer yields no row.

##### `_open (producer: Producer) : optional (attempt: Number)`

**Authored behavior:**

    Reports the latest attempt only while it is open. An invalid, unknown, or
    closed Producer yields no row.

##### `_pending () : many (path: Path, digest: Digest)`

**Authored behavior:**

    Lists active artifacts whose emitted entry is absent, non-regular, or differs
    in exact bytes, in ascending UTF-8 byte order of Path.

##### `_orphans () : many (path: ObservedPath)`

**Authored behavior:**

    Lists recorded destination entries with no active intent, in ascending UTF-8
    byte order of observed path.

#### Types

```types
Root = external
  A nonempty native host path supplied as Text. `direct` uses one Root as the
  destination and another distinct sibling Root as its transaction prefix.

Path = Text
  For an artifact, a platform-neutral logical path with one or more
  NFC-normalized Unicode segments separated by `/`. Each segment is nonempty,
  contains only Unicode scalar values, is neither `.` nor `..`, and contains no
  backslash, NUL, ASCII control character, or DEL. An absolute path or a path
  that climbs above the destination leaves it; a safe non-canonical spelling is
  invalid rather than normalized.

ObservedPath = JavaScriptString
  A relative path observed in a host destination. It need not be a canonical
  artifact Path.

Producer = Text
  An opaque well-formed Text identity.

Content = Bytes | Text
  Artifact bytes, or well-formed Text to encode as UTF-8.

Digest = Text
  The lowercase, 64-character hexadecimal SHA-256 digest of exact stored bytes.

Medium = Text
  Opaque, well-formed metadata retained for inspection; it does not affect
  stored bytes.

Kind = external
  The observed host kind of an existing non-directory destination entry.

Intent = identity
  A deterministic identity derived from Producer and Path.
```

Emitting copies byte content and UTF-8-encodes text content. Exact byte equality,
not digest equality, decides whether producers agree and whether a destination
file is current. No two paths in one active or staged set may be ancestors or
descendants. A stage may replace its producer's active file with descendants,
or active descendants with a file, because the active and staged sets do not
become current together.

Different claim identities under one Producer may share one Path only when
their bytes agree.

#### Contracts

```contracts
contract intent-keys
  At most one active and one staged Intent exist per Producer and Path. Active
  Producers may share a Path only when their exact bytes agree. Replacing,
  retracting, or recreating a pair preserves its Intent identity.

contract publication-installation on direct, reconcile
  `direct` records a destination only after complete inspection. `reconcile`
  prepares a complete sibling tree, serializes same-destination work in a
  process-local FIFO, and installs only after preparation and snapshot checks.
  Separate processes must not share a transaction prefix. Host failure may
  prevent restoration after the previous destination has moved.
```

### Filing

**Purpose.** Keep authoritative named byte trees and replace a host-backed tree only after
its complete readable contents are known, so readers never observe a partial
import.

**Principle.** Ada loads a host directory called notes. Reading its page gives back the exact
bytes loaded, the same text when those bytes are UTF-8, and a stable
fingerprint. She changes one file, removes another, and loads notes again; the
surviving file keeps its identity, the omitted file disappears, and readers see
the new tree only after the whole load succeeds. A later load encounters a
symbolic link and reports a problem without changing the preceding tree. The
page can find a picture from `./picture.png`, but a link cannot climb outside
the logical tree.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `loadFile (name: Name, source: HostPath, path: Path) : return (status: Status, root?: Root, file?: File, digest?: Digest, count?: Number, changed?: Flag, code?: Code, detail?: Text)`

**Authored behavior:**

    where name or source is not well-formed, non-empty text
    then
      refuse INVALID_SOURCE "A host load needs well-formed, non-empty name and source text."
    where path climbs outside root
    then
      refuse PATH_LEAVES_ROOT "A file path must stay inside its root."
    where path is not canonical
    then
      refuse INVALID_PATH "A file path must use the canonical portable form."
    where the host file is missing, unreadable, symbolic, or not ordinary
    then
      return status problem with a stable code and detail, leaving the named tree unchanged
    then
      replace the named tree with that one file and return status loaded, its identities, digest, count, and change flag

**Registered refusal codes:** `INVALID_SOURCE`, `PATH_LEAVES_ROOT`, `INVALID_PATH`

##### `loadTree (name: Name, directory: HostPath) : return (status: Status, root?: Root, count?: Number, changed?: Flag, code?: Code, detail?: Text)`

**Authored behavior:**

    where name or directory is not well-formed, non-empty text
    then
      refuse INVALID_SOURCE "A host load needs well-formed, non-empty name and source text."
    where the directory is missing, unreadable, symbolic, or not a directory, or any descendant is unreadable, unnameable, symbolic, or not ordinary
    then
      return status problem with a stable code and detail, leaving the named tree unchanged
    then
      replace the named tree with every read file and return status loaded, its root, count, and change flag

**Registered refusal codes:** `INVALID_SOURCE`

##### `open (name: Name) : return (root: Root)`

**Authored behavior:**

    where some root has name
    then
      return that root
    where no root has name
    then
      add a new root with name
      return root

##### `place (root: Root, path: Path, content: Bytes) : return (file: File, digest: Digest, changed: Flag)`

**Authored behavior:**

    where root is absent
    then
      refuse ROOT_NOT_FOUND "There is no such root."
    where path climbs outside root
    then
      refuse PATH_LEAVES_ROOT "A file path must stay inside its root."
    where path is not canonical
    then
      refuse INVALID_PATH "A file path must use the canonical portable form."
    where some file has root and path
    then
      replace its content with a copy, keep its identity, and return whether its bytes changed
    where no file has root and path
    then
      add a file with copied content and changed true

**Registered refusal codes:** `ROOT_NOT_FOUND`, `PATH_LEAVES_ROOT`, `INVALID_PATH`

##### `placeBase64 (root: Root, path: Path, encoded: Text) : return (file: File, digest: Digest, changed: Flag)`

**Authored behavior:**

    where encoded is not canonical Base64
    then
      refuse INVALID_ENCODING "Staged file content must use canonical Base64."
    where encoded is canonical Base64 and root is absent
    then
      refuse ROOT_NOT_FOUND "There is no such root."
    where encoded is canonical Base64 and path climbs outside root
    then
      refuse PATH_LEAVES_ROOT "A file path must stay inside its root."
    where encoded is canonical Base64 and path is not canonical
    then
      refuse INVALID_PATH "A file path must use the canonical portable form."
    where encoded, root, and path are valid
    then
      decode it to bytes and behave exactly as place with root, path, and those bytes

**Registered refusal codes:** `INVALID_ENCODING`, `ROOT_NOT_FOUND`, `PATH_LEAVES_ROOT`, `INVALID_PATH`

##### `discard (file: File) : return (root: Root, path: Path, name: Segment)`

**Authored behavior:**

    where file is absent
    then
      refuse FILE_NOT_FOUND "There is no such file."
    where file is present
    then
      remove it and return its address and name

**Registered refusal codes:** `FILE_NOT_FOUND`

#### Queries

##### `_root (root: Root) : optional (name: Name)`

**Authored behavior:**

    Uses exact Root identity and returns no row for an unknown or stale Root.

##### `_named (name: Name) : optional (root: Root)`

**Authored behavior:**

    Uses the exact Name and returns no row when no Root has that Name.

##### `_file (file: File) : optional (root: Root, path: Path, name: Segment, content: Bytes, digest: Digest)`

**Authored behavior:**

    Uses exact File identity and returns no row for an unknown or stale File.
    Stored content bytes are copied; no query exposes mutable retained storage.

##### `_text (file: File) : optional (text: Text)`

**Authored behavior:**

    Decodes the complete current content as strict UTF-8 without changing stored
    bytes. An unknown or stale File, malformed or incomplete UTF-8, an encoded
    surrogate, or a value outside the Unicode scalar range yields no row. A
    leading byte-order mark is preserved as U+FEFF, and empty content yields empty
    text.

##### `_at (root: Root, path: Path) : optional (file: File, digest: Digest)`

**Authored behavior:**

    Uses an exact Root identity and canonical Path. An unknown or stale Root, a
    noncanonical Path, or an absent File yields no row.

##### `_files () : many (file: File, root: Root, path: Path)`

**Authored behavior:**

    Returns every File, grouping rows by the order Roots were opened and then by
    ascending UTF-8 byte order of Path within each Root.

##### `_under (root: Root, prefix: Directory) : many (file: File, path: Path, digest: Digest)`

**Authored behavior:**

    Treats the prefix as a directory boundary, not an arbitrary text prefix.
    Unknown Roots and noncanonical prefixes yield no rows. Descendants are in
    ascending UTF-8 byte order of complete Path.

##### `_resolve (file: File, address: Address) : optional (target: File, path: Path)`

**Authored behavior:**

    Resolves a URI reference relative to the source File's directory without
    crossing Roots, and returns a row only for `found`. Empty, query-only, and
    fragment-only references name the source File; query and fragment suffixes on
    other references do not affect the file path. Percent escapes decode as
    UTF-8; malformed encodings and encoded separators are invalid. `.` and `..`
    are normalized, with traversal above the Root classified as outside. A
    leading `/`, `//`, or URI scheme is nonlocal. A trailing `/`, or a reference
    ending at `.` or `..`, is invalid because it does not name a File.

##### `_resolution (file: File, address: Address) : one (status: ResolutionStatus)`

**Authored behavior:**

    Applies the same resolution rules and reports `found`, `missing`, `outside`,
    `nonlocal`, or `invalid`. An unknown or stale source File reports
    `unknown-file`.

#### Types

```types
Name = JavaScriptString
  An opaque Root name. Host-loading actions require nonempty Text; `open`
  accepts any JavaScriptString.

HostPath = external
  A native filesystem path supplied as Text for one load operation. Host paths
  are not retained as Filing state.

Path = Text
  A platform-neutral logical path with one or more NFC-normalized Unicode
  segments separated by `/`. Each segment is nonempty, contains only Unicode
  scalar values, is neither `.` nor `..`, and contains no backslash, NUL, ASCII
  control character, or DEL. A Path has no leading, trailing, or repeated `/`.

Segment = Text
  One canonical segment of a Path.

Directory = Text
  Either empty text, meaning a Root, or a Path naming a directory prefix.

Address = Text
  A URI reference interpreted relative to a source File for lookup within the same Root.

Digest = Text
  The lowercase, 64-character hexadecimal SHA-256 digest of exact File content.

Status = "loaded" | "problem"

Code = Text
  A stable machine-readable code for a reported host-load problem.

ResolutionStatus = "found" | "missing" | "outside" | "nonlocal" | "invalid" | "unknown-file"
```

Host loads translate native paths to Path before placing Files. File content is
always `Bytes`. Filing copies bytes on input and output. The `changed` flag
compares exact bytes rather than trusting digest equality.

#### Contracts

```contracts
contract stable-identities on loadFile, loadTree, open, place, placeBase64, discard
  Each Name identifies one stable Root. Within a Root, each Path identifies one
  stable File, including after removal and recreation. Distinct Names and
  distinct `(Root, Path)` pairs have distinct identities.

contract host-load-snapshot on loadFile, loadTree
  A host load reads every candidate byte before replacing its Root. A reported
  problem leaves the preceding Root unchanged. Concurrent host mutation may
  produce a problem or a mixed-time capture; the load is not a filesystem-wide
  snapshot or durable containment boundary.
```

### Governing

**Purpose.** Give static publication one authoritative, location-aware interpretation of its
site policy, so malformed or unsupported settings cannot silently acquire
meaning.

**Principle.** Ada assesses a configuration that selects `public-dist`, defines site data,
source defaults, a collection, Markdown and image settings, enables a deployment
marker, and defines one redirect. The complete admitted policy is normalized and
has no problems. She changes the returned policy, but a later read remains
unchanged. She then assesses a replacement with an escaping output path and a
redirect cycle. The action refuses after atomically replacing the assessment;
both source-located problems become current and none of the earlier policy is
admitted. Repeating that source adds no duplicate problem.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `assess (source: Text) : return (policy: Policy, sources: Values)`

**Authored behavior:**

    then
      replace the current assessment with the parsed Syncpress policy and every policy problem
    where the replacement has problems
    then
      refuse INVALID_CONFIGURATION "The assessed site configuration is invalid."
    where the replacement has no problems
    then
      return a copy of its policy and the content, templates, and public source plan

**Registered refusal codes:** `INVALID_CONFIGURATION`

#### Queries

##### `_policy () : optional (policy: Policy)`

**Authored behavior:**

    Returns no row for an invalid assessment. Every policy projection below uses
    this absence rule and returns deep copies, so partial policy never becomes
    operational.

##### `_paths () : optional (content: Path, templates: Path, public: Path, assets: Path, output: Path)`

**Authored behavior:**

    Projects the effective project paths.

##### `_sources () : many (name: Name, path: Path)`

**Authored behavior:**

    Reproduces the content, templates, and public source plan returned by
    successful `assess`, in that fixed order, without requiring reassessment. An
    invalid assessment produces no rows.

##### `_site () : optional (site: Values, base: Address)`

**Authored behavior:**

    Projects normalized site values and the canonical base address.

##### `_origin () : optional (origin: Origin)`

**Authored behavior:**

    Returns the normalized origin when one is configured.

##### `_markdown () : optional (extensions: Values, raw: Flag, separator: Text)`

**Authored behavior:**

    Projects the effective Markdown policy.

##### `_images () : optional (widths: Values, formats: Values)`

**Authored behavior:**

    Projects the effective image policy.

##### `_defaults () : many (index: Number, text: Text, values: Values)`

**Authored behavior:**

    Projects normalized default rules with their declaration indexes.

##### `_collections () : many (name: Name, match: Text, direction: Direction, sort: Field | null, condition: Condition | null)`

**Authored behavior:**

    Projects normalized collection policies.

##### `_deployment () : optional (nojekyll: Flag, requireNotFound: Flag, sitemap: Flag)`

**Authored behavior:**

    Projects the effective deployment switches.

##### `_publishing () : optional (policy: Policy)`

**Authored behavior:**

    Projects the complete publishing policy.

##### `_problems () : many (code: Code, message: Text, line: Number, column: Number)`

**Authored behavior:**

    Lists retained problems in parser discovery order. An invalid policy remains
    as assessment evidence after `assess` refuses `INVALID_CONFIGURATION`, giving
    callers a stable refusal while reactions can report every problem.

#### Types

```types
Values = null | Flag | Number | JavaScriptString | List<Values> | Mapping
Mapping = Map<JavaScriptString, Values>
  Keys are JavaScript strings; no key order is implied.
Policy = Mapping
Path = Text
Name = JavaScriptString
Address = Text
Origin = Text
Direction = "asc" | "desc"
Field = Text
Condition = Mapping
Code = "INVALID_CONFIGURATION"

Problem = record
  code: Code
  message: Text
  line: Number
  column: Number
```

Configured default and collection matches must be portable globs. Collection
sort fields and conditions must satisfy the catalog field and condition
contracts. These failures are policy problems at their YAML locations. An
accepted `site.origin` with a trailing slash is stored without that slash.

### Layering

**Purpose.** Resolve layered configuration by explicit rank, so broad defaults can be
refined, replaced, withdrawn, and traced to the declaration that supplied each
effective value.

**Principle.** Ada contributes tool defaults and a higher-ranked deployment override. The
override changes the output name, adds one nested endpoint detail, and replaces
a format list, while untouched settings remain. The effective configuration is
the same whichever layer arrived first. Each value says which layer supplied it.
Withdrawing the override reveals the defaults again. Two layers cannot use the
same rank.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `contribute (subject: Subject, rank: Number, values: Values) : return (layer: Layer)`

**Authored behavior:**

    where rank is not finite
    then
      refuse INVALID_RANK "A layer rank must be a finite number."
    where values are not a JSON/YAML-like mapping
    then
      refuse INVALID_VALUES "A layer contribution must be a finite JSON-like record."
    where rank is already contributed for subject
    then
      refuse RANK_TAKEN "This record already has a contribution at this rank."
    where rank and values are valid and rank is available
    then
      add a copied and normalized ranked contribution
      return its Layer

**Registered refusal codes:** `INVALID_RANK`, `INVALID_VALUES`, `RANK_TAKEN`

##### `withdraw (subject: Subject, rank: Number) : return (layer: Layer)`

**Authored behavior:**

    where rank is not finite
    then
      refuse INVALID_RANK "A layer rank must be a finite number."
    where rank is finite and absent
    then
      refuse NO_SUCH_LAYER "This record has no contribution at this rank."
    where rank is present
    then
      remove and return its Layer

**Registered refusal codes:** `INVALID_RANK`, `NO_SUCH_LAYER`

##### `clear (subject: Subject) : return (subject: Subject, count: Number)`

**Authored behavior:**

    then
      remove every contribution for subject
      return how many were removed

#### Queries

##### `_resolved (subject: Subject) : one (values: Values)`

**Authored behavior:**

    Starts with an empty mapping and applies layers in ascending rank. Existing and
    incoming mappings at the same key merge recursively; every other incoming
    value, including a mapping over a non-mapping, replaces the existing value and
    its entire subtree. Sequences, strings, numbers, booleans, and null therefore
    replace rather than merge. Undefined is not a Value, so there is no deletion
    marker. A subject with no layers resolves to an empty mapping.

##### `_value (subject: Subject, path: Keys) : optional (value: Value)`

**Authored behavior:**

    Returns no row for an invalid path, a missing key, or traversal through a
    non-mapping. Explicit null is present.

##### `_flag (subject: Subject, path: Keys, otherwise: Flag) : one (value: Flag)`

**Authored behavior:**

    Returns a stored boolean. An invalid, absent, or non-boolean value produces
    `otherwise`.

##### `_equal (subject: Subject, path: Keys, value: Value) : one (present: Flag, equal: Flag)`

**Authored behavior:**

    For an invalid or absent path, both flags are false. At a present path,
    comparison uses structural Value equality; a comparison value outside the
    Value domain is unequal rather than a refusal.

##### `_origin (subject: Subject, path: Keys) : optional (rank: Number, layer: Layer)`

**Authored behavior:**

    Every resolved non-root path has one origin. A new value or replacement makes
    the contributing layer the origin of the path and every path in its new
    subtree, removing origins from the replaced subtree. A recursive mapping merge
    preserves the existing container's origin while assigning each added or
    replaced descendant to its contributing layer, so a composite mapping can
    retain an older container origin and descendant origins from several newer
    layers. An absent path and the synthesized empty root have no origin.
    Withdrawal recomputes origins from the remaining layers, restoring earlier
    values and origins.

##### `_leafOrigins (subject: Subject) : many (path: Keys, rank: Number, layer: Layer)`

**Authored behavior:**

    Lists scalar and empty-mapping leaves in resolved-tree traversal order.
    Sequences are omitted because paths do not traverse them.

##### `_layers (subject: Subject) : many (layer: Layer, rank: Number, values: Values)`

**Authored behavior:**

    Lists layers in ascending numeric rank order.

#### Types

```types
Subject = JavaScriptString

Value = null | Flag | Number | JavaScriptString | List<Value> | Values
Values = Map<JavaScriptString, Value>
  A plain mapping with literal JavaScript-string keys. Key order does not affect equality.

Keys = List<JavaScriptString>
```

A Value is JSON/YAML-like: null, a boolean, a string, a finite binary64 number, a
sequence of Values, or a plain mapping whose own properties are enumerable
string-keyed data properties containing Values. A Values contribution is a
mapping. A plain mapping has either the ordinary object prototype or no
prototype. Sparse or decorated arrays, non-enumerable properties, accessors,
symbol properties, class instances, functions, bigint, undefined, and cyclic
values are invalid. A shared but acyclic input object is copied independently
wherever it occurs. Negative zero is normalized to zero.

Mappings retain literal keys. Empty strings, dots, and names such as
`__proto__`, `constructor`, and `prototype` have no special behavior. Layering
reads only own properties and materializes these names as safe own data
properties.

Contributions are normalized and copied before storage. Every value returned by
a query is also a deep copy. Copies preserve ordinary-versus-null mapping
prototypes. The resolved root is a synthesized ordinary mapping; each non-root
mapping keeps the prototype of the contribution that established that mapping
container. Mutating an input or observation cannot alter stored state.

Two Values are equal when their normalized structures are equal. Scalars compare
by value; negative zero has already become zero. Sequences compare by length,
order, and recursively equal items. Mappings compare by the same set of literal
own keys and recursively equal values; mapping key order and ordinary-versus-null
prototype do not affect equality.

A rank is any finite number. NaN and either infinity are invalid. Negative zero
is rank zero. Layers resolve in ascending numeric rank regardless of arrival
order, so the highest applicable rank wins. At most one layer exists for a
subject and normalized rank.

A path is a dense sequence of literal string key segments. It traverses mappings
only; sequences are values and their indexes are not path segments. An empty path
names the complete resolved mapping. A dot inside a segment is an ordinary dot,
not a separator. Empty and special-name segments are valid. A sparse, decorated,
non-array, accessor-backed, or non-string path is invalid.

#### Contracts

```contracts
contract stable-layer-identity on contribute, withdraw
  A Subject and normalized rank identify the same Layer across concept
  instances, withdrawal, and later contribution. Distinct pairs identify
  distinct Layers.
```

### Locating

**Purpose.** Record which host locations a run wants and observe their resolution-time
containment and overlap under one base, so composition can reject an unsafe
location plan before asking another owner to use it.

**Principle.** Ada records that the base should be `/srv/site` and that output should go to
`build`. Grounding the recorded base succeeds because it is a real directory.
She admits `content` under the name `content` and gets an absolute location
inside the base. She admits `../elsewhere` and gets a location that reports
itself outside. She admits `linked/content`, where `linked` is a symbolic link
to another disk; it looks contained but reports that it does not stay inside
once links are resolved. She admits `build` before it exists and still gets a
stable answer, and its location does not overlap `content`. Admitting a name
again replaces what that name locates. Grounding another base forgets every
location admitted under the previous one.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `request (name: Name, path: Text) : return (name: Name, path: Text)`

**Authored behavior:**

    where name or path is not well-formed, non-empty text
    then
      refuse INVALID_LOCATION "A location must be well-formed, non-empty text."
    then
      record path under name, replacing any earlier request with that name
      return name and path

**Registered refusal codes:** `INVALID_LOCATION`

##### `ground (path: Text) : return (status: Status, path?: Path, real?: Path, code?: Code, detail?: Text)`

**Authored behavior:**

    where path is not well-formed, non-empty text
    then
      refuse INVALID_LOCATION "A location must be well-formed, non-empty text."
    where the location is missing
    then
      return status problem, code LOCATION_MISSING, and "This required directory is missing."
    where the location is a symbolic link or not a directory
    then
      return status problem, code LOCATION_NOT_DIRECTORY, and "This required location must be a directory that is not a symbolic link."
    where the location cannot be inspected or resolved
    then
      return status problem, code LOCATION_UNRESOLVABLE, and "This location could not be resolved."
    where the base is already this exact absolute path
    then
      keep the base and every admitted place, and return status grounded with its paths
    where the base is new or different
    then
      make path absolute against the process working directory
      replace the Base, discard every admitted Place, and return status grounded with its paths

**Registered refusal codes:** `INVALID_LOCATION`

##### `admit (name: Name, path: Text) : return (status: Status, place?: Place, path?: Path, real?: Path, contained?: Flag, resolved?: Flag, code?: Code, detail?: Text)`

**Authored behavior:**

    where no base is grounded
    then
      refuse NOT_GROUNDED "No base directory has been grounded."
    where name or path is not well-formed, non-empty text
    then
      refuse INVALID_LOCATION "A location must be well-formed, non-empty text."
    where some place has this name and exactly this path
    then
      return status admitted with that place unchanged
    where the location cannot be resolved
    then
      return status problem, code LOCATION_UNRESOLVABLE, and "This location could not be resolved."
    otherwise
      make path absolute against the Base and resolve its existing portion
      set contained from absolute-path containment and resolved from real-path containment
      replace any Place with this Name and return status admitted with both flags

**Registered refusal codes:** `NOT_GROUNDED`, `INVALID_LOCATION`

#### Queries

##### `_requested (name: Name) : optional (path: Text)`

**Authored behavior:**

    Uses the exact caller-supplied Name and returns no row when no Request has that
    Name. Returned path text is a value, not a live filesystem handle; queries do
    not reinspect or re-resolve the host. No Locating query returns multiple rows,
    so query ordering is not observable.

##### `_base () : optional (path: Path, real: Path)`

**Authored behavior:**

    Returns no row before a Base is grounded and otherwise reports the retained
    observation from the most recent successful grounding.

##### `_place (place: Place) : optional (name: Name, path: Path, real: Path, contained: Flag, resolved: Flag)`

**Authored behavior:**

    Uses exact Place identity and returns no row for an unknown Place.

##### `_named (name: Name) : optional (place: Place)`

**Authored behavior:**

    Uses the exact caller-supplied Name and returns no row when no Place has that
    Name.

##### `_overlapping (place: Place, other: Place) : one (overlapping: Flag)`

**Authored behavior:**

    Compares retained real paths and returns true when either location is at or
    below the other. An unknown Place yields false because it occupies no
    location.

#### Types

```types
Name = Text
  An opaque, nonempty Text name chosen by the caller.

Path = external
  An absolute native host path represented as Text. A `path` value preserves
  the absolute spelling observed by Locating. A `real` value replaces each
  resolved symbolic link with its target; for a missing location, it appends
  the remaining literal segments to the real path of the nearest existing
  ancestor.

Status = "grounded" | "admitted" | "problem"

Code = "LOCATION_MISSING" | "LOCATION_NOT_DIRECTORY" | "LOCATION_UNRESOLVABLE"
```

#### Contracts

```contracts
contract host-observations on ground, admit
  Paths and containment flags describe the host when the action runs. They are
  not capabilities or locks and may become stale immediately. `admit` may
  observe a missing trailing location; `ground` requires a present directory.

contract stable-place-identity on ground, admit
  Each Name determines one Place identity. Replacing a Place, grounding another
  Base, and later admitting the Name preserve that identity.
```

### Phasing

**Purpose.** Move a job through a named list of barriers in order, advancing only from the
exact announced phase attempt so settlement retries cannot skip work.

**Principle.** Ada declares a sequence containing draft, review, and publish. Declaring the
same sequence again reports no change. She starts one job at draft; a second job
for that sequence is refused while it runs. Settling draft with its exact
attempt announces review. Retrying that attempt returns review without
announcing another transition, while another attempt is refused as stale. Ada
settles review and publish, then may start a replacement job. A job in another
sequence moves independently. She abandons that job with its current attempt
and a reason, leaving it failed and unable to move.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `declare (name: Name, phases: Phases) : return (sequence: Sequence, changed: Flag)`

**Authored behavior:**

    where name is not Text
    then
      refuse INVALID_TEXT "Sequence names and failure reasons must be well-formed text."
    where phases is not an ordinary dense list of Text values
    then
      refuse INVALID_PHASES "Phases must be an ordinary dense list of text values."
    where phases is empty
    then
      refuse NO_PHASES "A sequence needs at least one phase."
    where a phase occurs more than once
    then
      refuse PHASE_REPEATED "A phase may occur only once in a sequence."
    where a sequence has name and equal phases in equal order
    then
      return that sequence and changed false
    where the named sequence is new or has different phases
    then
      add or replace it, preserving its identity
      return sequence and changed true

**Registered refusal codes:** `INVALID_TEXT`, `INVALID_PHASES`, `NO_PHASES`, `PHASE_REPEATED`

##### `start (sequence: Sequence) : return (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt)`

**Authored behavior:**

    where sequence is not a current sequence
    then
      refuse SEQUENCE_NOT_FOUND "There is no such sequence."
    where sequence already has a running job
    then
      refuse SEQUENCE_ACTIVE "This sequence already has a running job."
    then
      add a running job with a snapshot of the phases and their first phase current
      make it the latest job for the sequence
      return the new job, sequence name, first phase, and its exact phase attempt

**Registered refusal codes:** `SEQUENCE_NOT_FOUND`, `SEQUENCE_ACTIVE`

##### `advance (job: Job, attempt: PhaseAttempt) : return (job: Job, name: Name, phase: Phase | null, attempt: PhaseAttempt | null, transitioned: Flag)`

**Authored behavior:**

    where attempt was already settled for job
    then
      return its recorded next phase and attempt with transitioned false
    where job is unknown, finished, or failed
    then
      refuse JOB_NOT_RUNNING "This job is not running."
    where attempt is not the running job's current attempt
    then
      refuse STALE_ATTEMPT "This phase attempt is not current."
    where attempt is current and a later phase exists
    then
      make the next phase and its attempt current
      record this settlement
      return job, next phase and attempt, and transitioned true
    where attempt is current at the last phase
    then
      make the job finished and record this settlement
      return job, null phase and attempt, and transitioned true

**Registered refusal codes:** `JOB_NOT_RUNNING`, `STALE_ATTEMPT`

##### `abandon (job: Job, attempt: PhaseAttempt, reason: Text) : return (job: Job, reason: Text)`

**Authored behavior:**

    where job is not running
    then
      refuse JOB_NOT_RUNNING "This job is not running."
    where attempt is not the running job's current attempt
    then
      refuse STALE_ATTEMPT "This phase attempt is not current."
    where reason is not Text
    then
      refuse INVALID_TEXT "Sequence names and failure reasons must be well-formed text."
    then
      make the job failed with reason and return job and reason

**Registered refusal codes:** `JOB_NOT_RUNNING`, `STALE_ATTEMPT`, `INVALID_TEXT`

#### Queries

##### `_job (job: Job) : optional (sequence: Sequence, name: Name, phase: Phase, attempt: PhaseAttempt, state: State)`

**Authored behavior:**

    Returns no row for an unknown or non-Text Job. A terminal Job retains its last
    announced Phase and PhaseAttempt.

##### `_running (sequence: Sequence) : optional (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt)`

**Authored behavior:**

    Returns no row for an unknown or malformed Sequence, or when the Sequence has
    no running Job.

##### `_latest (sequence: Sequence) : optional (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt, state: State)`

**Authored behavior:**

    Returns no row for an unknown or malformed Sequence. The latest Job remains
    present after it finishes or fails.

##### `_outcome (job: Job) : optional (state: State, reason?: Text)`

**Authored behavior:**

    Returns no row for an unknown, malformed, or running Job. A finished row omits
    `reason`; a failed row includes it.

#### Types

```types
Name = Text
Phase = Text

Phases = List<Phase>
  An ordinary dense phase plan.

State = "running" | "finished" | "failed"

PhaseAttempt = identity
  The opaque identity of one announced phase of one Job.
```

Text is a well-formed Unicode string. A phase plan is an ordinary dense list of
Text values with no extra properties. A sequence has at least one phase, and a
phase occurs at most once in its sequence.

Sequence and Job values are opaque identities. A Sequence identity is a
deterministic encoding of its Name and survives redeclaration. A PhaseAttempt is
a deterministic encoding of its Job and phase index. The result of `advance`
contains either the next Phase and its PhaseAttempt or `null` for both. `null`
means that the Job has finished and cannot trigger phase work.

#### Contracts

```contracts
contract sequence-name
  No two Sequences have the same Name.
```

### Referencing

**Purpose.** Find supported references in generated HTML and safely rewrite them after their
replacements are known.

**Principle.** Ada scans generated HTML containing links, images, and embedded resources. Each
found address says which element and attribute owns it, where it appears in the
HTML, and which other addresses share that element or attribute. Ada can replace
an address safely or trust supplied markup to replace one whole element. The HTML
is finished only after every found address has an answer. Once finished, its
answers are fixed: an identical repeated answer is idempotent, while a changed
answer is refused. Scanning again forgets the old answers, and removing the scan
makes its old reference identities invalid. Primary image sources also carry
their source-backed authored attributes for application policy to interpret.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `scan (subject: Subject, part: Part, text: Text) : return (source: Source, count: Number, replaced: Flag, completed: Flag)`

**Authored behavior:**

    where subject, part, or text is not Text
    then
      refuse INVALID_TEXT "Subjects, parts, identities, HTML, and answers must be well-formed text."
    where all inputs are Text
    then
      replace any source for subject and part, including its references and answers
      parse text with HTML fragment recovery and add every supported reference
      return source, how many references were added, whether a source was replaced,
        and completed true exactly when count is zero

**Registered refusal codes:** `INVALID_TEXT`

##### `answer (reference: Reference, form: Form, value: Text) : return (reference: Reference, source: Source, subject: Subject, part: Part, changed: Flag, completed: Flag)`

**Authored behavior:**

    where reference or value is not Text
    then
      refuse INVALID_TEXT "Subjects, parts, identities, HTML, and answers must be well-formed text."
    where form is neither address nor markup
    then
      refuse INVALID_FORM "Answer form must be address or markup."
    where reference is not in references
    then
      refuse REFERENCE_NOT_FOUND "There is no such reference."
    where the source is finished and form or value differs from the stored answer
    then
      refuse SOURCE_FINISHED "A finished source cannot accept a changed answer."
    where form is address and value cannot be represented as one reference in its HTML attribute
    then
      refuse UNREPRESENTABLE_ADDRESS "This address cannot be represented as one HTML reference."
    where form is markup and another markup answer has an overlapping element span
    then
      refuse OVERLAPPING_MARKUP "A markup answer overlaps another markup answer."
    where the answer is allowed
    then
      replace that reference's answer and form if either differs
      return its identities, changed true exactly when either differed, and completed
        true exactly when this change moved its source from unfinished to finished

**Registered refusal codes:** `INVALID_TEXT`, `INVALID_FORM`, `REFERENCE_NOT_FOUND`, `SOURCE_FINISHED`, `UNREPRESENTABLE_ADDRESS`, `OVERLAPPING_MARKUP`

##### `drop (subject: Subject, part: Part) : return (source: Source, count: Number, dropped: Flag)`

**Authored behavior:**

    where subject or part is not Text
    then
      refuse INVALID_TEXT "Subjects, parts, identities, HTML, and answers must be well-formed text."
    where inputs are Text
    then
      remove any source for subject and part with all its references
      return its stable identity, how many references were removed, and whether a source was present

**Registered refusal codes:** `INVALID_TEXT`

#### Queries

##### `_source (source: Source) : optional (subject: Subject, part: Part)`

**Authored behavior:**

    Returns no row while the Source has no current scan. Any query given a non-Text
    argument returns no row or no rows according to its cardinality.

##### `_reference (reference: Reference) : optional (source: Source, raw: Address, kind: Kind, role: Role, tag: Tag, attribute: Attribute, element: Element, slot: Slot, index: NonnegativeInteger, label: Text, line: PositiveInteger, column: PositiveInteger, attributes?: Attributes)`

**Authored behavior:**

    Returns no row for an unknown identity or an identity from an earlier scan
    revision. In this query, _references, and _unanswered, attributes is present
    only for a primary img[src] reference. Every returned Attributes map is a fresh
    null-prototype map in UTF-16 code-unit order; changing it cannot change stored
    state.

##### `_references (source: Source) : many ReferenceRow`

**Authored behavior:**

    Returns every current reference in element source order, then attribute source
    order, then candidate order. A Source without a current scan returns no rows.

##### `_unanswered (source: Source) : many ReferenceRow`

**Authored behavior:**

    Filters the _references sequence to unanswered references without reordering
    it. A Source without a current scan returns no rows.

##### `_finished (subject: Subject, part: Part) : optional (source: Source, text: Text)`

**Authored behavior:**

    Returns no row when the slot has no current scan or while any current reference
    is unanswered. When present, text is the rewritten scan text. A scan with no
    references is finished immediately.

#### Types

```types
Subject = Text
  An application-supplied owner of scanned HTML.

Part = Text
  A named HTML part within a Subject.

Address = Text
  One decoded HTML reference value.

Form = "address" | "markup"
Kind = "link" | "image" | "embed" | "download"
Role = "hyperlink" | "download" | "base" | "link-resource" | "image" | "image-candidate" | "input-image" | "media-source" | "source-candidate" | "media" | "poster" | "script" | "frame" | "embedded-resource" | "track"
Attribute = "href" | "src" | "srcset" | "poster"

Tag = Text
  A canonical lowercase supported HTML element name.

Span = record
  start: NonnegativeInteger
  end: NonnegativeInteger

Attributes = Map<Text, Text>
  Decoded source-backed image attributes keyed by canonical lowercase name in
  ascending JavaScript string order.

ReferenceRow = record
  reference: Reference
  raw: Address
  kind: Kind
  role: Role
  tag: Tag
  attribute: Attribute
  element: Element
  slot: Slot
  index: NonnegativeInteger
  label: Text
  line: PositiveInteger
  column: PositiveInteger
  attributes?: Attributes
```

Text is a well-formed Unicode string. Subjects, parts, identities, scanned HTML,
and answers must be Text. Empty Text is valid.

Only elements in the HTML namespace and the following element/attribute pairs are
supported. Element and attribute names are ASCII case-insensitive. The HTML parser
chooses the effective value when malformed input repeats an attribute.

| Element | Attribute | Role | Kind | Label |
| --- | --- | --- | --- | --- |
| `a` | `href` | `hyperlink`, or `download` when `download` is present | `link` or `download` | descendant text |
| `area` | `href` | `hyperlink`, or `download` when `download` is present | `link` or `download` | `alt` |
| `base` | `href` | `base` | `link` | empty |
| `link` | `href` | `link-resource` | `embed` | empty |
| `img` | `src` | `image` | `image` | `alt` |
| `img` | `srcset` | `image-candidate` | `image` | `alt` |
| `input[type=image]` | `src` | `input-image` | `image` | `alt` |
| `source` | `src` | `media-source` | `embed` | empty |
| `source` | `srcset` | `source-candidate` | `image` | empty |
| `audio`, `video` | `src` | `media` | `embed` | empty |
| `video` | `poster` | `poster` | `embed` | empty |
| `script` | `src` | `script` | `embed` | empty |
| `iframe` | `src` | `frame` | `embed` | empty |
| `embed` | `src` | `embedded-resource` | `embed` | empty |
| `track` | `src` | `track` | `embed` | empty |

This is deliberately not a complete inventory of every URL-bearing HTML feature.
Form actions, citation attributes, ping lists, `srcdoc`, CSS URLs, SVG references,
and other element/attribute pairs are outside this concept's contract.

Only a primary `img[src]` reference exposes `attributes`. It contains every
decoded, parser-retained, source-backed attribute value on that element.
Referencing records HTML evidence without deciding which attributes another
mechanism may preserve. Attribute names are canonical lowercase. Repeated or
malformed attributes use the HTML parser's effective value, and attributes
without a parser source location are omitted. No `srcset` candidate,
`input[type=image]`, `source`, or other reference exposes `attributes`.

`raw` is the HTML-decoded attribute value, not its entity spelling in the source.
For `srcset`, the HTML-decoded value is parsed using the HTML candidate algorithm:
commas inside URL tokens, including data URLs, are retained; trailing separator
commas are removed; descriptor whitespace and parentheses are recognized; and a
candidate with invalid, repeated, zero, or mutually incompatible descriptors is ignored.
Each valid candidate is a separate reference. `index` is its zero-based order in
the valid candidates of that attribute. A non-`srcset` reference has index zero.

`line` and `column` are one-based positions in the generated HTML supplied to
`scan`, not positions in an authored template or Markdown source. They point to
the first source character spelling the URL. An empty or valueless attribute uses
the insertion position where its value would begin.

Every source-backed supported element receives an opaque `element` identity. All
references on that element share it. Every supported attribute containing at
least one reference receives an opaque `slot` identity. All candidates in one
`srcset` share it. These identities, together with `tag`, `attribute`, `role`, and
`index`, let a composition distinguish an `img` primary source from its candidates
and from candidates on a `source` element without interpreting strings.

A source identity is a collision-safe opaque encoding of its exact subject and
part and is reused by rescans and remove-then-scan. Subject and part remain
independent even when they contain punctuation or control characters. Each scan
has a new revision. Reference, element, and slot identities include that revision,
so an identity from an earlier scan or from before a drop can never name a later
record.

`Source`, `Element`, `Slot`, and `Reference` are identities introduced by the
state declarations. A `Source` is the stable identity of a subject-and-part scan
slot; it is not diagnostic source text.

#### Contracts

```contracts
contract one-source-per-slot
  At most one Source exists per Subject and Part.
```

### Rendering

**Purpose.** Track each page rendering attempt through body and layout settlement, so later
behavior observes one terminal event for the active owner attempt.

**Principle.** Ada begins a page with its selected profile and template and exact dependency
and output attempts. Settling the body and then the layout advances it to completion in order.
Repeating a settled transition reports no change. Retrying the same exact owner
attempts returns the same rendering. Beginning the page with two newer attempts
supersedes unfinished work, while an older or inconsistent pair is refused and
late completion of superseded work reports no change. Failing active work makes
the attempt terminal and reports no second transition when repeated.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `begin (subject: Subject, path: Path, profile: Profile, template: TemplateName, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger) : return (rendering: Rendering, subject: Subject, profile: Profile, template: TemplateName, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)`

**Authored behavior:**

    where subject, path, profile, or template is not Text
    then
      refuse INVALID_TEXT "Rendering subjects, paths, profile names, template names, and failure reasons must be well-formed text."
    where either attempt is not a positive safe integer
    then
      refuse INVALID_ATTEMPT "Rendering attempts require valid dependency and emission attempt identities."
    where the pair equals the latest pair and selects the same source policy
    then
      return the latest rendering without changing state
    where either attempt is not newer than the latest pair, or an equal pair selects different source policy
    then
      refuse STALE_ATTEMPT "This rendering owner-attempt pair is stale or inconsistent."
    then
      supersede the subject's unfinished latest rendering if one exists
      add and remember a started rendering with its selected profile and template
      return the new rendering, subject, profile, and template

**Registered refusal codes:** `INVALID_TEXT`, `INVALID_ATTEMPT`, `STALE_ATTEMPT`

##### `settleBody (rendering: Rendering) : return (rendering: Rendering, subject: Subject, transitioned: Flag)`

**Authored behavior:**

    where rendering is unknown
    then
      refuse RENDERING_NOT_FOUND "There is no such rendering attempt."
    where rendering is started
    then
      make it body-settled and return transitioned true
    where rendering is already body-settled, later, or superseded
    then
      return transitioned false

**Registered refusal codes:** `RENDERING_NOT_FOUND`

##### `settleLayout (rendering: Rendering) : return (rendering: Rendering, subject: Subject, transitioned: Flag)`

**Authored behavior:**

    where rendering is unknown
    then
      refuse RENDERING_NOT_FOUND "There is no such rendering attempt."
    where rendering is started
    then
      refuse STAGE_NOT_READY "The rendering attempt has not reached the required stage."
    where rendering is body-settled
    then
      make it completed and return transitioned true
    where rendering is already completed, failed, or superseded
    then
      return transitioned false

**Registered refusal codes:** `RENDERING_NOT_FOUND`, `STAGE_NOT_READY`

##### `fail (rendering: Rendering, reason: Text) : return (rendering: Rendering, subject: Subject, transitioned: Flag)`

**Authored behavior:**

    where rendering is unknown
    then
      refuse RENDERING_NOT_FOUND "There is no such rendering attempt."
    where reason is not Text
    then
      refuse INVALID_TEXT "Rendering subjects, paths, profile names, template names, and failure reasons must be well-formed text."
    where rendering is started or body-settled
    then
      make it failed with reason and return transitioned true
    where rendering is already completed, failed, or superseded
    then
      return transitioned false

**Registered refusal codes:** `RENDERING_NOT_FOUND`, `INVALID_TEXT`

#### Queries

##### `_attempt (rendering: Rendering) : optional AttemptRow`

**Authored behavior:**

    Includes historical superseded and completed attempts and returns no row for
    an unknown Rendering. In this and the other optional queries, failure is
    present and undefined unless the attempt failed. No query returns a mutable
    value.

##### `_active (rendering: Rendering) : optional AttemptRow`

**Authored behavior:**

    Returns the attempt only while it is its subject's latest unfinished attempt.
    An unknown or inactive Rendering returns no row.

##### `_latest (subject: Subject) : optional (rendering: Rendering, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure: Text | undefined, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)`

**Authored behavior:**

    Returns the most recently begun attempt for the subject, or no row for an
    unknown Subject.

##### `_all () : many (rendering: Rendering, subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure?: Text, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)`

**Authored behavior:**

    Returns all attempts in start order. Failure is omitted from a row unless the
    attempt failed.

#### Types

```types
Subject = Text
  A page identity.

Path = Text
  A portable source path.

Profile = Text
  An application-selected profile name, not a profile identity.

TemplateName = Text
  An application-selected template name, not a template identity.

Stage = "started" | "body-settled" | "completed" | "failed" | "superseded"

AttemptRow = record
  subject: Subject
  path: Path
  profile: Profile
  template: TemplateName
  stage: Stage
  failure: Text | undefined
  dependencyAttempt: PositiveInteger
  emissionAttempt: PositiveInteger
```

#### Contracts

```contracts
contract one-current-attempt-per-subject
  For each Subject, at most one Rendering is latest and at most one is active.
```

### RequestBoundary

**Purpose.** Let the outside world ask for things and receive answers, so each authored answer belongs to one pending call and failed waits settle without forging one.

**Principle.** A call arrives and becomes pending. An answer travels back once; timeout or abort ends only the wait, while a quiescent interpreter failure returns an opaque internal error.

Actions:

- `request (…)`
- `respond (…)` — may refuse `NOT_PENDING`

### Routing

**Purpose.** Give each thing one dependable canonical address in a shared space, so two
things cannot silently use the same address.

**Principle.** Ada gives one note the address `/notes/design/`. Giving another note that address
is refused, so the first note keeps it. Giving the first note the same address
again changes nothing, while moving it to a free address keeps the note's claim
identity. Releasing an address makes it free for someone else. Malformed
requests leave every existing claim untouched.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `claim (owner: Owner, address: Address) : return (claim: Claim, address: Address, changed: Flag)`

**Authored behavior:**

    where owner is not Text
    then
      refuse INVALID_OWNER "An owner must be a well-formed text identity."
    where owner is Text and address is not canonical
    then
      refuse INVALID_ADDRESS "An address must be a canonical site-absolute path."
    where another owner claims address
    then
      refuse ADDRESS_TAKEN "Another owner has already claimed this address."
    where owner already claims address
    then
      return that claim and address with changed false
    where address is free
    then
      replace any other claim for owner, preserving its identity
      add the claim at address and return it with changed true

**Registered refusal codes:** `INVALID_OWNER`, `INVALID_ADDRESS`, `ADDRESS_TAKEN`

##### `release (owner: Owner) : return (claim: Claim, address: Address)`

**Authored behavior:**

    where owner is not Text
    then
      refuse INVALID_OWNER "An owner must be a well-formed text identity."
    where owner has no claim
    then
      refuse NOT_CLAIMED "This owner has claimed no address."
    where owner has a claim
    then
      remove and return it with its address

**Registered refusal codes:** `INVALID_OWNER`, `NOT_CLAIMED`

#### Queries

##### `_address (owner: Owner) : optional (address: Address)`

**Authored behavior:**

    Uses the exact Owner. Returns no row when the lookup is not well-formed Text
    or the Owner has no current claim. Routing query results are Text values and
    expose no mutable retained buffer.

##### `_owner (address: Address) : optional (owner: Owner)`

**Authored behavior:**

    Requires the exact canonical Address spelling. Returns no row when the lookup
    is not well-formed Text, is noncanonical, or has no claim.

##### `_claims () : many (owner: Owner, address: Address)`

**Authored behavior:**

    Returns every current claim in ascending UTF-8 byte order of canonical
    Address, independent of claim arrival order.

#### Types

```types
Owner = Text
  An opaque Text identity supplied by the caller. Empty text and punctuation
  have no special meaning.

Path = Text
  A platform-neutral logical path with one or more NFC-normalized Unicode
  segments separated by `/`. A segment is nonempty, contains only Unicode
  scalar values, is neither `.` nor `..`, and contains no slash, backslash,
  NUL, ASCII control character, or DEL. A Path has no leading, trailing, or
  repeated `/`.

Address = Text
  A canonical URI-path spelling in the same segment grammar. It starts with
  exactly one `/`, has no query or fragment, and is `/`, a directory address
  ending in `/`, or a file address ending in a segment. An encoded segment
  leaves only ASCII letters, digits, and `-._~!$&'()*+,;=:@` literal; every
  other character is represented by its UTF-8 bytes as uppercase `%HH`.
  Percent escapes for literal characters, lowercase escapes, malformed UTF-8,
  raw non-ASCII characters, encoded separators, non-NFC text, empty segments,
  and encoded `.` or `..` segments are not canonical. `/index.html` and every
  file address ending in `/index.html` are not canonical; the corresponding
  directory address is canonical.
```

#### Contracts

```contracts
contract stable-claim-identity on claim, release
  Each Owner determines one collision-safe Claim identity. Moving, releasing,
  or reclaiming an Owner does not change it, and distinct Owners have distinct
  identities.
```

### Serving

**Purpose.** Answer host requests from one directory of already-published files, never
revealing anything outside it, and tell connected readers when to look again.

**Principle.** Ada opens a server on a loopback address and port 0; it reports the port the
host actually gave it. Until she points it at a directory it tells every reader
the site is unavailable. She points it at a published output directory, and a
request for `/` answers that directory's `index.html` with a small script that
listens for reload notices. A request for a missing path answers not found. A
request that climbs out of the directory, or reaches a symbolic link, answers
forbidden without reading the file. After a rebuild she publishes the
reconciled directory, and every listening reader is told to reload. Closing the
server ends the listeners and stops answering.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `open (host: Text, port: Port) : return (server: Server, host: Text, port: Port)`

**Authored behavior:**

    where host is not well-formed, non-empty text, or port is not an integer between 0 and 65535
    then
      refuse INVALID_SERVER "A server needs a host and a port between 0 and 65535."
    where the host refuses the address
    then
      refuse ADDRESS_UNAVAILABLE "This address could not be listened on."
    then
      add an open server with no directory and no readers
      return it with the address the host actually gave it

**Registered refusal codes:** `INVALID_SERVER`, `ADDRESS_UNAVAILABLE`

##### `publish (server: Server, directory: Path) : return (server: Server, directory: Path, readers: Number)`

**Authored behavior:**

    where server is unknown or not open
    then
      refuse SERVER_NOT_OPEN "There is no such open server."
    where directory is not well-formed, non-empty text
    then
      refuse INVALID_PUBLICATION "A publication needs a well-formed, non-empty directory path."
    where directory is missing, symbolic, not a directory, or cannot be resolved
    then
      refuse PUBLICATION_UNAVAILABLE "This published directory could not be served."
    then
      atomically replace the current canonical directory, tell every reader to look again, and return it with how many were told

**Registered refusal codes:** `SERVER_NOT_OPEN`, `INVALID_PUBLICATION`, `PUBLICATION_UNAVAILABLE`

##### `close (server: Server) : return (server: Server)`

**Authored behavior:**

    where server is unknown
    then
      refuse SERVER_NOT_FOUND "There is no such server."
    where host closure fails
    then
      end every Reader, stop answering, and make the Server failed
      refuse SERVER_CLOSE_FAILED "This server could not be closed."
    then
      end every reader, stop answering, and make the server closed

**Registered refusal codes:** `SERVER_NOT_FOUND`, `SERVER_CLOSE_FAILED`

#### Queries

##### `_server (server: Server) : optional (host: Text, port: Port, state: State, directory: Path | null)`

**Authored behavior:**

    Returns a row for every Server ever opened, including a closed Server. The
    directory is null until one is set.

##### `_readers (server: Server) : one (readers: Number)`

**Authored behavior:**

    Reports the current number of open reload listeners. The count is zero for an
    unknown or closed Server.

#### Types

```types
Path = Text
  A non-empty native host path.

Port = SafeInteger
  An integer from 0 through 65535 inclusive.

State = "open" | "closing" | "failed" | "closed"
```

#### Contracts

```contracts
contract request-paths
  Without a published directory, every request is unavailable. Otherwise the
  raw path is separated from its query and decoded once without WHATWG dot
  normalization. Malformed encoding is a bad request. A backslash, `..` segment,
  named symbolic-link component, or resolved path outside the directory is
  forbidden. A directory names its `index.html`; an absent, unreadable, or
  non-regular final entry, including a symbolic fallback index, is not found.

contract served-files
  Serving reads files at request time and retains no copy. HTML receives a
  no-cache reload script before its closing body tag or at the end; other files
  receive the media type implied by their extension, or generic bytes.

contract reload-readers on publish, close
  The reload endpoint retains one Reader per open event stream. Every successful
  `publish`, including an unchanged directory, tells each current Reader once.
  Closure or listener failure ends all Readers; an unexpected listener failure
  also makes the Server failed.
```

### Templating

**Purpose.** Fill a reusable Liquid pattern with supplied values, so one layout and its named
fragments can produce HTML for many subjects.

**Principle.** Mina makes event pages. She saves a frame and a masthead, and the frame renders
the masthead by its fixed name. Text such as `Ada & Bob` becomes safe HTML, while
the already-produced page body is inserted as HTML only because Mina's
application explicitly trusts the path `["page", "content"]`. A missing optional
subtitle is harmless in a condition, but printing an undefined value is an
error. Asking about the frame reports both the fragments and context paths it
can reach. Reusing the same source changes nothing; replacing it keeps the same
template identity. A missing fragment, recursive tree, unsupported dependency,
or Liquid error reports its location and leaves the last successful output
untouched. That failed fill or render is also available by its subject with its
normalized refusal code and any available location. A later successful fill or
render for that subject clears the failure.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `define (name: Name, source: JavaScriptString) : return (template: Template, changed: Flag)`

**Authored behavior:**

    where another origin owns name and source differs
    then
      refuse TEMPLATE_NAME_TAKEN "Another source already owns this template name."
    where source is not valid Liquid in the supported engine
    then
      refuse TEMPLATE_SYNTAX "This Liquid template cannot be parsed."
    where source uses a Liquid feature excluded above
    then
      refuse UNSUPPORTED_TEMPLATE "This Liquid feature is unsupported because its dependencies or escaping cannot be determined."
    where some template has name and exactly source
    then
      return that template and changed false
    where source is valid, supported, and different
    then
      replace any template with name and its direct metadata
      return template and changed true

**Registered refusal codes:** `TEMPLATE_NAME_TAKEN`, `TEMPLATE_SYNTAX`, `UNSUPPORTED_TEMPLATE`

##### `register (name: Name, source: JavaScriptString, origin: Origin) : return (template: Template, changed: Flag)`

**Authored behavior:**

    where origin is not Text
    then
      refuse INVALID_TEMPLATE_ORIGIN "A template origin must be well-formed text."
    where another origin owns name
    then
      refuse TEMPLATE_NAME_TAKEN "Another source already owns this template name."
    where source is not valid Liquid in the supported engine
    then
      refuse TEMPLATE_SYNTAX "This Liquid template cannot be parsed."
    where source uses a Liquid feature excluded above
    then
      refuse UNSUPPORTED_TEMPLATE "This Liquid feature is unsupported because its dependencies or escaping cannot be determined."
    then
      atomically claim name for origin, define or replace its source, and return template and changed

**Registered refusal codes:** `INVALID_TEMPLATE_ORIGIN`, `TEMPLATE_NAME_TAKEN`, `TEMPLATE_SYNTAX`, `UNSUPPORTED_TEMPLATE`

##### `forget (name: Name) : return (template: Template)`

**Authored behavior:**

    where no template has name
    then
      refuse TEMPLATE_NOT_FOUND "There is no such template."
    where some template has name
    then
      delete that template and renderings directly of it
      release its registered origin if present
      return template

**Registered refusal codes:** `TEMPLATE_NOT_FOUND`

##### `fill (subject: Subject, source: JavaScriptString, context: Values, trusted: Paths, sourceName?: Name, sourceLine?: PositiveInteger) : return (filling: Filling, output: JavaScriptString)`

**Authored behavior:**

    where source is not valid Liquid in the supported engine
    then
      replace any Failure for subject with code TEMPLATE_SYNTAX and any available location
      refuse TEMPLATE_SYNTAX "This Liquid template cannot be parsed."
    where source uses a Liquid feature excluded above
    then
      replace any Failure for subject with code UNSUPPORTED_TEMPLATE and any available location
      refuse UNSUPPORTED_TEMPLATE "This Liquid feature is unsupported because its dependencies or escaping cannot be determined."
    where a trusted entry is not an exact path or wildcard declaration as defined above
    then
      replace any Failure for subject with code INVALID_TRUSTED_PATH and any available location
      refuse INVALID_TRUSTED_PATH "A trusted path must contain one or more literal string segments."
    where an exact trusted path or selected wildcard value does not name an own string value
    then
      replace any Failure for subject with code INVALID_TRUSTED_VALUE and any available location
      refuse INVALID_TRUSTED_VALUE "A trusted path must name a string in the supplied context."
    where some literal name in the source's tree is not defined
    then
      replace any Failure for subject with code USED_TEMPLATE_NOT_FOUND and any available location
      refuse USED_TEMPLATE_NOT_FOUND "A rendered template is not defined."
    where the source's tree is recursive
    then
      replace any Failure for subject with code RECURSIVE_TEMPLATE and any available location
      refuse RECURSIVE_TEMPLATE "The template dependency tree is recursive."
    where strict evaluation reads an undefined value
    then
      replace any Failure for subject with code UNDEFINED_VARIABLE and any available location
      refuse UNDEFINED_VARIABLE "This Liquid template reads a context value that is not defined."
    where evaluation otherwise fails
    then
      replace any Failure for subject with code TEMPLATE_FAILED and any available location
      refuse TEMPLATE_FAILED "This Liquid template could not be evaluated."
    where evaluation succeeds
    then
      replace any filling for subject with its dependency snapshot
      clear any Failure for subject
      return filling and output

**Registered refusal codes:** `TEMPLATE_SYNTAX`, `UNSUPPORTED_TEMPLATE`, `INVALID_TRUSTED_PATH`, `INVALID_TRUSTED_VALUE`, `USED_TEMPLATE_NOT_FOUND`, `RECURSIVE_TEMPLATE`, `UNDEFINED_VARIABLE`, `TEMPLATE_FAILED`

##### `render (template: Template, subject: Subject, context: Values, trusted: Paths) : return (rendering: Rendering, output: JavaScriptString)`

**Authored behavior:**

    where template is not in Templates
    then
      replace any Failure for subject with code TEMPLATE_NOT_FOUND and any available location
      refuse TEMPLATE_NOT_FOUND "There is no such template."
    where a trusted entry is not an exact path or wildcard declaration as defined above
    then
      replace any Failure for subject with code INVALID_TRUSTED_PATH and any available location
      refuse INVALID_TRUSTED_PATH "A trusted path must contain one or more literal string segments."
    where an exact trusted path or selected wildcard value does not name an own string value
    then
      replace any Failure for subject with code INVALID_TRUSTED_VALUE and any available location
      refuse INVALID_TRUSTED_VALUE "A trusted path must name a string in the supplied context."
    where some literal name in the template's tree is not defined
    then
      replace any Failure for subject with code USED_TEMPLATE_NOT_FOUND and any available location
      refuse USED_TEMPLATE_NOT_FOUND "A rendered template is not defined."
    where the template's tree is recursive
    then
      replace any Failure for subject with code RECURSIVE_TEMPLATE and any available location
      refuse RECURSIVE_TEMPLATE "The template dependency tree is recursive."
    where strict evaluation reads an undefined value
    then
      replace any Failure for subject with code UNDEFINED_VARIABLE and any available location
      refuse UNDEFINED_VARIABLE "This Liquid template reads a context value that is not defined."
    where evaluation otherwise fails
    then
      replace any Failure for subject with code TEMPLATE_FAILED and any available location
      refuse TEMPLATE_FAILED "This Liquid template could not be evaluated."
    where evaluation succeeds
    then
      replace any rendering for template and subject with its dependency snapshot
      clear any Failure for subject
      return rendering and output

**Registered refusal codes:** `TEMPLATE_NOT_FOUND`, `INVALID_TRUSTED_PATH`, `INVALID_TRUSTED_VALUE`, `USED_TEMPLATE_NOT_FOUND`, `RECURSIVE_TEMPLATE`, `UNDEFINED_VARIABLE`, `TEMPLATE_FAILED`

#### Queries

##### `_template (name: Name) : optional (template: Template, digest: Digest)`

**Authored behavior:**

    Returns the current Template for the name, or no row when the name has no
    current Template.

##### `_uses (owner: Owner) : many (used: Name)`

**Authored behavior:**

    A use is one supported literal render name. Returns the direct uses of a
    Template or Filling, with no specified order. A Rendering or unknown owner
    returns no rows.

##### `_tree (owner: Owner) : many (used: Name)`

**Authored behavior:**

    Returns the transitive use closure of a Template, Filling, or Rendering in
    depth-first, first-mention order, with each name once. For a Template, the
    result describes its current source and currently defined tree. For a Filling
    or Rendering, it is the tree snapshot used by that successful evaluation;
    redefining or forgetting a template does not rewrite the snapshot. An unknown
    owner returns no rows.

##### `_usedBy (name: Name) : many (owner: Owner)`

**Authored behavior:**

    Returns Template and Filling owners that directly use the name. An unknown name
    returns no rows. No order is specified.

##### `_reads (owner: Owner) : many (path: Keys)`

**Authored behavior:**

    A read is a nonempty literal context path. It means that the value at the path,
    or a descendant of that value, may be inspected; the prefix meaning accounts
    for values passed as render arguments. Analysis includes partials, render
    arguments, assignments, and local scopes: a partial's global reads contribute
    to its caller, but a partial argument does not become a false global read.
    Returns unique paths in ascending lexicographic path order and a fresh Keys
    list in every row. For a Template, the paths describe its current source and
    currently defined tree. For a Filling or Rendering, they are the effective-read
    snapshot used by that successful evaluation; redefining or forgetting a
    template does not rewrite the snapshot. An unknown owner returns no rows.
    Apart from these fresh path lists, query rows contain no mutable values.

##### `_failure (subject: Subject) : optional (code: Code, templateName: Name | undefined, line: PositiveInteger | undefined, column: PositiveInteger | undefined)`

**Authored behavior:**

    Returns the latest failed fill or render for exactly the subject, or no row
    when none is recorded. The code is one of the declared refusal codes.
    templateName, line, and column are present and undefined when no corresponding
    location is available.

##### `_failureLocation (subject: Subject, fallbackSource: DiagnosticSource) : optional (source: DiagnosticSource, line: PositiveInteger | undefined, column: PositiveInteger | undefined)`

**Authored behavior:**

    Returns no row when the subject has no recorded failure. For a recorded
    failure, resolves a named location to that source and otherwise uses
    fallbackSource. This lets a host composition report one diagnostic without
    duplicating source-selection policy. Line and column are present and undefined
    when unavailable.

##### `_filling (subject: Subject) : optional (filling: Filling, output: JavaScriptString)`

**Authored behavior:**

    Returns the last successful filling for the subject, or no row when that result
    is absent.

##### `_rendering (template: Template, subject: Subject) : optional (rendering: Rendering, output: JavaScriptString)`

**Authored behavior:**

    Returns the last successful rendering for the template-and-subject key, or no
    row when that result is absent.

##### `_of (rendering: Rendering) : optional (template: Template, subject: Subject, output: JavaScriptString)`

**Authored behavior:**

    Returns the last successful result for the Rendering identity, or no row when
    that identity is unknown or absent.

#### Types

```types
Name = JavaScriptString
  A template name, distinct from the Template identity that owns the name.

Subject = JavaScriptString
  An application-supplied filling or rendering owner.

Origin = Text
  An identity that may own a registered template name.

Digest = Text
  A SHA-256 digest.

Code = "INVALID_TRUSTED_PATH" | "INVALID_TRUSTED_VALUE" | "RECURSIVE_TEMPLATE" | "TEMPLATE_FAILED" | "TEMPLATE_NOT_FOUND" | "TEMPLATE_SYNTAX" | "UNDEFINED_VARIABLE" | "UNSUPPORTED_TEMPLATE" | "USED_TEMPLATE_NOT_FOUND"

Keys = List<JavaScriptString>
  A nonempty literal context path.

WildcardPath = record
  wildcard: Keys

TrustedPath = Keys | WildcardPath
Paths = List<TrustedPath>

Values = external
  A JSON-like context record supplied by the application.

Owner = Template | Filling | Rendering
Tree = List<Name>

DiagnosticSource = JavaScriptString
  A diagnostic source label, not the identity of a scanned HTML Source.
```

This concept fills Liquid templates and returns text intended to be HTML. It
uses the built-in tags, expressions, and filters of the installed LiquidJS
engine with these exact restrictions:

- `include`, Liquid `layout`, and `cycle` tags are unsupported. `include` and
  `layout` hide template dependencies, and `cycle` can write a context value
  without passing it through output escaping.
- `render` takes one quoted, literal template name. Interpolation in that name
  and an unquoted expression are unsupported. Named arguments such as
  `{% render "card.html", item: page.data %}` are supported. The `with` and
  `for` forms are unsupported. A rendered template has Liquid's isolated local
  scope, plus supplied named arguments and the original global context.
  Argument names are safe ASCII identifiers other than `__proto__`, and each has
  an explicit `key: value`.
  Render names are nonempty and cannot begin with `/`, `./`, or `../`, so lookup
  is exact rather than relative to the calling template.
- Every context property access has literal segments. Dot identifiers, quoted
  bracket members, and literal numeric indexes are supported. An expression in
  brackets, such as `collections[which]`, is unsupported. This applies in every
  expression, not only output expressions.
- No custom author tags or filters are installed. The Liquid `raw` filter is
  retained only as an ordinary identity filter and never disables escaping.
  Liquid raw blocks contain authored literal text and remain supported.

Unknown tags and filters are syntax errors. A source is checked in full, so an
unsupported construct is refused even in a branch that would not execute.

`strictVariables` is enabled. An undefined value is allowed only where
LiquidJS's `lenientIf` permits one optional value: a condition of `if`, `elsif`,
or `unless`, or the input to `default`. Printing it, iterating it, using it in a
compound expression, or otherwise evaluating it refuses `UNDEFINED_VARIABLE`.

Contexts are JSON-like Values assembled elsewhere. An exact path is a nonempty,
ordinary dense array of literal string segments with the standard array
prototype and no extra properties: `["page", "content"]`, not a dotted string.
Empty segments, dots, names such as `__proto__`, and `*` have no special
meaning in an exact path. Read paths use strings for literal numeric indexes
too.

Alongside exact paths, `trusted` accepts a tagged wildcard declaration such as
`{ wildcard: ["collections", "*", "*", "excerpt"] }`. An ordinary string
array is always exact, so `["collections", "*", "*", "excerpt"]` still trusts
only literal `*` members rather than acting as a wildcard.

A structural declaration is an ordinary plain or null-prototype record with
exactly its enumerable data `wildcard` member and no other members. Its path
must be a nonempty dense string path containing at least one `*`. Each `*`
ranges over enumerable own data members of a plain record or items of a dense
standard array. Other segments read exact own properties. A missing or null
final value is skipped; every selected present value must be a string. This
excludes inherited values, accessors, proxies, sparse arrays, and decorated
containers while keeping application trust policy outside Templating.

All values written by Liquid output are HTML-escaped, replacing `&`, `<`, `>`,
`"`, and `'`. Authored literal template text is not escaped. The only exemption
is an exact path or selected structural excerpt in the action's `trusted`
input. Every selected value must resolve to an own string value in that action's
context. The context is not mutated.

Trust belongs to the exact internal value, not to a variable name or text with
the same contents. It survives an `assign` alias and a named `render` argument.
Any filter result is ordinary text and is escaped, even for `raw`, `default`, or
an identity-like filter. `capture` also produces ordinary text, so interpolating
a captured trusted value escapes it. Template authors cannot create a trusted
value.

Names and subjects are arbitrary JavaScript strings. Identities are
deterministic, injective length-prefixed encodings, so punctuation and control
characters cannot collide. A template keeps its identity when its source
changes. A filling keeps its identity for its subject. A rendering keeps its
identity for its exact template and subject pair.

#### Contracts

```contracts
contract template-result-and-failure-keys
  At most one Template exists per Name, one Filling per Subject, one Rendering
  per Template and Subject, and one Failure per Subject.
```

### Transcoding

**Purpose.** Make smaller copies of a raster image in common formats without changing its
shape or losing its motion.

**Principle.** Ada admits a readable image and receives the size a person sees, including its
EXIF orientation. She asks for several widths and formats. Invalid settings are
refused, larger widths are not upscaled, duplicate widths are removed, and the
remaining widths are ordered from smallest to largest. Formats stay in their
declared order, except that the source format is always last and always includes
an exact copy of the source as a fallback. Animated output is made only in a
format that preserves every frame, delay, and loop. Each result reports its
actual dimensions, format, media type, extension, a stable suggested filename,
whether it is the exact source fallback, exact bytes, and a SHA-256 digest of
those bytes. Repeating the request changes nothing.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `admit (subject: Subject, content: Bytes) : return (original: Original, digest: Digest, format: Format, width: Number, height: Number, animated: Flag, changed: Flag)`

**Authored behavior:**

    where subject is not well-formed text
    then
      refuse INVALID_SUBJECT "An image subject must be well-formed text."
    where content has no readable image metadata or all pixels cannot be decoded
    then
      refuse UNREADABLE_IMAGE "These bytes are not a fully readable image."
    where content is readable but its source format is unsupported
    then
      refuse UNSUPPORTED_SOURCE_FORMAT "The source image format is not supported."
    where an original has subject and the same exact content
    then
      return that original with its facts and changed false
    where content is a supported readable image and differs
    then
      remove any original for subject and all of its renditions
      add an original with copied content, its digest, displayed dimensions, format, and animation facts
      return it with changed true

**Registered refusal codes:** `INVALID_SUBJECT`, `UNREADABLE_IMAGE`, `UNSUPPORTED_SOURCE_FORMAT`

##### `render (original: Original, widths: Widths, formats: Formats) : return (original: Original, count: Number, derived: Number, changed: Flag)`

**Authored behavior:**

    where original is absent
    then
      refuse ORIGINAL_NOT_FOUND "There is no such image."
    where widths is not a dense list of positive safe integers
    then
      refuse INVALID_WIDTHS "Widths must be positive safe integers."
    where formats is not a dense list of supported available format names
    then
      refuse UNSUPPORTED_FORMAT "A rendition format is unsupported or unavailable."
    where its renditions already equal the normalized requested set and exact original fallback
    then
      return original, the final rendition count, the non-fallback rendition count, and changed false
    where producing or verifying any planned rendition fails
    then
      leave every existing rendition unchanged
      refuse RENDITION_FAILED "A requested image rendition could not be produced."
    where the planned rendition set differs and every rendition succeeds
    then
      atomically replace its renditions in normalized format and width order, with the original format last
      return original, the final rendition count, the non-fallback rendition count, and changed true

**Registered refusal codes:** `ORIGINAL_NOT_FOUND`, `INVALID_WIDTHS`, `UNSUPPORTED_FORMAT`, `RENDITION_FAILED`

##### `release (subject: Subject) : return (subject: Subject, count: Number)`

**Authored behavior:**

    where subject is not well-formed text
    then
      refuse INVALID_SUBJECT "An image subject must be well-formed text."
    then
      remove its original and renditions if present and return whether one original was removed

**Registered refusal codes:** `INVALID_SUBJECT`

#### Queries

##### `_original (subject: Subject) : optional (original: Original, digest: Digest, format: Format, width: Number, height: Number, animated: Flag)`

**Authored behavior:**

    Returns no row for an unknown or non-Text Subject.

##### `_renditions (original: Original) : many (rendition: Rendition, width: Number, height: Number, format: Format, animated: Flag, order: Number, digest: Digest, extension: Extension, name: Name, mediaType: MediaType, fallback: Flag, content: Bytes)`

**Authored behavior:**

    Returns no rows for an unknown, malformed, replaced, or released Original.
    Returns a fresh copy of each row's `content`. `order` starts at zero.
    Alternative formats come first in first-declared order after aliases and
    duplicates are merged; their non-upscaled widths ascend. The source-format
    group comes last and ends with the exact original fallback at the displayed
    source dimensions. Every render has this fallback. The source-format group
    also contains each requested smaller width that can preserve animation.

##### `_rendition (rendition: Rendition) : optional (original: Original, width: Number, height: Number, format: Format, animated: Flag, order: Number, digest: Digest, extension: Extension, name: Name, mediaType: MediaType, fallback: Flag)`

**Authored behavior:**

    Returns no row for an unknown, malformed, replaced, or released Rendition.
    Replacing or releasing its Original removes the Rendition from lookup.

#### Types

```types
Subject = Text
  A well-formed Unicode string identifying an admitted image.

Format = "avif" | "gif" | "jpeg" | "png" | "webp"

Widths = List<PositiveInteger>
  Requested displayed widths in pixels.

Formats = List<Format | "jpg" | "original">
  Requested output formats, including the JPEG alias and source sentinel.

Digest = Text
  A lowercase, 64-character hexadecimal SHA-256 digest.

Extension = "avif" | "gif" | "jpg" | "png" | "webp"

MediaType = "image/avif" | "image/gif" | "image/jpeg" | "image/png" | "image/webp"

Name = Text
  A rendition's suggested filename.
```

An admitted source must be JPEG, PNG (including APNG), WebP, GIF, or AVIF. SVG,
HEIC, TIFF, PDF, raw pixels, and every other format are unsupported. Source and
output formats use the canonical lowercase `Format` names. Render also accepts
`jpg` for `jpeg` and the sentinel `original`.

Width and height are positive whole pixel counts after EXIF orientation is
applied. For a multi-frame image, height is one displayed frame's height, not
the stacked decoder height. A generated rendition has exactly the requested
width and `max(1, round(source height * width / source width))` height. It is
never cropped, padded, stretched, or enlarged.

An original digest covers the admitted source bytes. A rendition digest covers
that rendition's bytes; the exact original fallback therefore has the original
digest. Original identity is a deterministic, unambiguous encoding of
`(subject, source digest)`. Rendition identity is a deterministic, unambiguous
encoding of `(original, width, format, rendition digest)`. Delimiter-like
subjects cannot collide. Re-admitting the same subject and bytes may recreate
the same content-addressed identities.

An extension is the canonical suffix without a dot. Its media type follows the
same row:

| Format | Extension | Media type |
| --- | --- | --- |
| `avif` | `avif` | `image/avif` |
| `gif` | `gif` | `image/gif` |
| `jpeg` | `jpg` | `image/jpeg` |
| `png` | `png` | `image/png` |
| `webp` | `webp` | `image/webp` |

A rendition's `name` is its content digest, a dot, and its extension. It is a
stable, collision-resistant suggested filename derived only from intrinsic
rendition facts. Equal names therefore imply equal content digests and canonical
extensions, absent a SHA-256 collision. The name is not a path, address, claim,
or publication decision.

#### Contracts

```contracts
contract rendition-keys
  At most one Original exists per Subject, and at most one Rendition exists per
  Original, width, and Format.
```

### Watching

**Purpose.** Report settled bursts of change under a host directory, so work happens once per
burst instead of once per event, and never in response to paths the watcher was
told to disregard.

**Principle.** Ada observes `/srv/site`, letting a burst settle after 75 milliseconds, with
`/srv/site/dist` excluded before observation starts. She attends the watch and waits.
Saving three files in quick succession reports one settled change, not three.
When she attends again she waits, because that burst was already reported. Files written
under `/srv/site/dist` report nothing at all. A burst that settles while nobody
is attending is still reported by the next attend. Closing the watch releases
whoever is attending and stops the observation for good.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `observe (directory: Path, settling: Duration, excluded: Path, prefix: Path) : return (watch: Watch)`

**Authored behavior:**

    where directory, excluded, or prefix is malformed, or settling is not a positive safe integer
    then
      refuse INVALID_WATCH "A watch needs a directory and a positive settling duration."
    where directory is missing
    then
      refuse DIRECTORY_MISSING "This required directory is missing."
    where directory is a symbolic link or not a directory
    then
      refuse DIRECTORY_UNSUPPORTED "This required location must be a directory that is not a symbolic link."
    where the host cannot observe directory
    then
      refuse DIRECTORY_UNOBSERVABLE "This directory could not be observed."
    then
      normalize the directory and fixed exclusions before host observation begins
      add an open Watch with settled false and return it

**Registered refusal codes:** `INVALID_WATCH`, `DIRECTORY_MISSING`, `DIRECTORY_UNSUPPORTED`, `DIRECTORY_UNOBSERVABLE`

##### `attend (watch: Watch, within: Duration) : return (changed: Flag, watching: Flag)`

**Authored behavior:**

    where watch is unknown
    then
      refuse WATCH_NOT_FOUND "There is no such watch."
    where within is not a positive safe integer
    then
      refuse INVALID_WATCH "A watch needs a directory and a positive settling duration."
    where the host watcher failed
    then
      refuse WATCH_FAILED "The host watch stopped unexpectedly."
    where the watch is closed
    then
      return changed false and watching false
    where the watch has a settled burst
    then
      take that burst and return changed true and watching true
    otherwise
      wait until a burst settles, the watch closes, or within passes
      return whether a burst is being reported, and whether the watch is still open

**Registered refusal codes:** `WATCH_NOT_FOUND`, `INVALID_WATCH`, `WATCH_FAILED`

##### `close (watch: Watch) : return (watch: Watch)`

**Authored behavior:**

    where watch is unknown
    then
      refuse WATCH_NOT_FOUND "There is no such watch."
    then
      stop observing, release whoever is attending, await host observation, and make the watch closed

**Registered refusal codes:** `WATCH_NOT_FOUND`

#### Queries

##### `_watch (watch: Watch) : optional (directory: Path, settling: Duration, state: State)`

**Authored behavior:**

    Returns no row for an unknown Watch and continues to return a row after
    failure or closure.

##### `_excluded (watch: Watch) : many (path: Path)`

**Authored behavior:**

    Returns no rows when no Paths match. This query and `_open` define no order.

##### `_open () : many (watch: Watch)`

**Authored behavior:**

    Returns no rows when no Watches match.

#### Types

```types
Duration = PositiveInteger
  A duration in milliseconds.

Path = Text
  A non-empty native host path.

State = "open" | "failed" | "closed"
```

#### Contracts

```contracts
contract excluded-changes on observe
  A tree exclusion ignores its path and descendants by native path components.
  A prefix exclusion matches only the first component below its own parent.

contract settled-bursts on observe, attend
  Each counted change restarts the settling Duration. A quiet Duration records
  one unreported burst; further bursts collapse into it until `attend` reports
  and consumes it.

contract terminal-watch on attend, close
  An unexpected host-watcher end makes the Watch failed and releases attendance.
  A closed Watch observes nothing. Failed and closed Watches retain their
  identities and never become open again.
```

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

```view
absolute site URL of address (address) — inputs (address); outputs (url); bindings (base, origin) — answers at most one (url)
  where
    Governing._site () has (base)
    Governing._origin () has (origin)
    url is projectAbsoluteSiteUrl (address, base, origin)
    isTextValue (value: url)
```

```view
active deployment work returned by queue transition (action, result) — inputs (action, result); outputs (work); bindings () — answers at most one (work)
  where
    work is deploymentTransitionWork (action, result)
    isTextValue (value: work)
    Deploying._work (work) has (status: "active")
```

```view
address of output path (path) — inputs (path); outputs (address); bindings () — answers at most one (address)
  where
    address is outputPathAddress (path)
    isTextValue (value: address)
```

```view
directory prefix of path (path) — inputs (path); outputs (prefix); bindings () — answers at most one (prefix)
  where
    prefix is directoryPath (path)
    isTextValue (value: prefix)
```

```view
output path of address (address) — inputs (address); outputs (path); bindings () — answers at most one (path)
  where
    path is addressOutputPath (address)
    isTextValue (value: path)
```

```view
path joining prefix (prefix) and name (name) — inputs (prefix, name); outputs (path); bindings () — answers at most one (path)
  where
    path is joinPath (name, prefix)
    isTextValue (value: path)
```

```view
beside-page output for page (page) and name (name) — inputs (page, name); outputs (path); bindings (pageAddress, pagePath, prefix) — answers at most one (path)
  where
    Routing._address (owner: page) has (address: pageAddress)
    view "output path of address (address)" with (address: pageAddress) has (path: pagePath)
    view "directory prefix of path (path)" with (path: pagePath) has (prefix)
    view "path joining prefix (prefix) and name (name)" with (name, prefix) has (path)
```

```view
committable deployment work of producer (producer) — inputs (producer); outputs (work); bindings () — answers at most one (work)
  where Deploying._forProducer (producer) has (kind: "nojekyll", status: "active", work)
  where Deploying._forProducer (producer) has (status: "prepared", work)
```

```view
content document file — inputs (); outputs (file, text); bindings (root, path) — answers any number of (file, text)
  where
    Filing._named (name: "content") has (root)
    Filing._under (prefix: "", root) has (file, path)
    patternHasResult (matched: true, path, pattern: "**/*.md")
    Filing._text (file) has (text)
  where
    Filing._named (name: "content") has (root)
    Filing._under (prefix: "", root) has (file, path)
    patternHasResult (matched: true, path, pattern: "**/*.html")
    Filing._text (file) has (text)
```

```view
relative body reference of source (source) — inputs (source); outputs (rendering, page, reference, raw, role); bindings () — answers any number of (rendering, page, reference, raw, role)
  where
    Referencing._source (source) has (part: "body", subject: rendering)
    Rendering._active (rendering) has (subject: page)
    Referencing._references (source) has (raw, reference, role)
    targetHasKind (kind: "relative", target: raw)
```

```view
resolved local body reference of source (source) — inputs (source); outputs (rendering, page, reference, raw, role, target); bindings () — answers any number of (rendering, page, reference, raw, role, target)
  where
    view "relative body reference of source (source)" with (source) has (page, raw, reference, rendering, role)
    Filing._resolve (address: raw, file: page) has (target)
```

```view
unrouted content body asset of source (source) — inputs (source); outputs (rendering, page, reference, raw, role, asset, sourcePath, name, content); bindings (root) — answers any number of (rendering, page, reference, raw, role, asset, sourcePath, name, content)
  where
    view "resolved local body reference of source (source)" with (source) has (page, raw, reference, rendering, role, target: asset)
    no Routing._address (owner: asset)
    no Documenting._document (subject: asset)
    Filing._file (file: asset) has (content, name, path: sourcePath, root)
    Filing._root (root) has (name: "content")
```

```view
copyable body asset of source (source) — inputs (source); outputs (rendering, page, reference, raw, asset, name, content); bindings (sourcePath) — answers any number of (rendering, page, reference, raw, asset, name, content)
  where view "unrouted content body asset of source (source)" with (source) has (asset, content, name, page, raw, reference, rendering) and not (role: "image")
  where
    view "unrouted content body asset of source (source)" with (source) has (asset, content, name, page, raw, reference, rendering, role: "image", sourcePath)
    patternHasResult (matched: false, path: sourcePath, pattern: "**/*.{avif,gif,jpeg,jpg,png,webp}")
```

```view
derived address of path (path) — inputs (path); outputs (address); bindings () — answers at most one (address)
  where
    address is deriveAddress (path)
    isTextValue (value: address)
```

```view
held body reference of source (source) — inputs (source); outputs (reference, raw); bindings () — answers any number of (reference, raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "absolute", target: raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "external", target: raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "fragment", target: raw)
```

```view
held deployment layout reference of source (source) — inputs (source); outputs (reference, raw); bindings () — answers any number of (reference, raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "external", target: raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "fragment", target: raw)
```

```view
held layout reference of source (source) — inputs (source); outputs (reference, raw); bindings () — answers any number of (reference, raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "external", target: raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "fragment", target: raw)
```

```view
the settled site build of job (job) — inputs (job); outputs (state); bindings () — answers at most one (state)
  where
    Phasing._job (job) has (name: "site-build")
    Phasing._outcome (job) has (state)
```

```view
unsettled route owner — inputs (); outputs (owner); bindings () — answers any number of (owner)
  where
    Routing._claims () has (owner)
    no Depending._current (subject: owner)
```

```view
job (job) is a publishable site build — inputs (job); outputs (); bindings ()
  where
    view "the settled site build of job (job)" with (job) has (state: "finished")
    Diagnosing._clean () has (clean: true)
    Deploying._outcome () has (state: "completed")
    no view "unsettled route owner"
```

```view
path (path) relative to prefix (prefix) — inputs (path, prefix); outputs (relative); bindings () — answers at most one (relative)
  where
    relative is relativePath (path, prefix)
    isTextValue (value: relative)
```

```view
pending failed rendering cleanup — inputs (); outputs (page, rendering); bindings (dependencyAttempt, emissionAttempt) — answers any number of (page, rendering)
  where
    Rendering._all () has (emissionAttempt, rendering, stage: "failed", subject: page)
    Rendering._latest (subject: page) has (rendering)
    Emitting._open (producer: page) has (attempt: emissionAttempt)
  where
    Rendering._all () has (dependencyAttempt, rendering, stage: "failed", subject: page)
    Rendering._latest (subject: page) has (rendering)
    Depending._attempt (subject: page) has (attempt: dependencyAttempt)
    Depending._state (subject: page) has (state: "building")
```

```view
primary raster body asset reference of source (source) — inputs (source); outputs (rendering, page, reference, raw, image, name, content); bindings (imagePath) — answers any number of (rendering, page, reference, raw, image, name, content)
  where
    view "unrouted content body asset of source (source)" with (source) has (asset: image, content, name, page, raw, reference, rendering, role: "image", sourcePath: imagePath)
    patternHasResult (matched: true, path: imagePath, pattern: "**/*.{avif,gif,jpeg,jpg,png,webp}")
```

```view
responsive body image embedding (embedding) — inputs (embedding); outputs (rendering, page, original); bindings (source, reference, raw, image) — answers at most one (rendering, page, original)
  where
    Embedding._embedding (embedding) has (subject: reference)
    Referencing._reference (reference) has (raw, role: "image", source)
    Referencing._source (source) has (part: "body", subject: rendering)
    Rendering._active (rendering) has (subject: page)
    targetHasKind (kind: "relative", target: raw)
    Filing._resolve (address: raw, file: page) has (target: image)
    Transcoding._original (subject: image) has (original)
```

```view
retargeted reference from original (original) to replacement (replacement) — inputs (replacement, original); outputs (target); bindings () — answers at most one (target)
  where
    target is retargetReference (original, replacement)
    isTextValue (value: target)
```

```view
routed deployment work (work) — inputs (work); outputs (owner, address); bindings () — answers at most one (owner, address)
  where Deploying._work (work) has (from: address, kind: "redirect", owner)
  where Deploying._work (work) has (address, kind: "pagination-page", owner)
```

```view
site URL of target (target) — inputs (target); outputs (url); bindings (base) — answers at most one (url)
  where
    Governing._site () has (base)
    url is projectSiteUrl (base, target)
    isTextValue (value: url)
```

```view
sitemap page — inputs (); outputs (owner, address, url); bindings () — answers any number of (owner, address, url)
  where
    Routing._claims () has (address, owner) and not (address: "/404.html")
    no Deploying._forOwner (owner) has (kind: "redirect")
    view "absolute site URL of address (address)" with (address) has (url)
```

```view
the Syncpress command represented by words (words) — inputs (words); outputs (name, operands); bindings () — answers at most one (name, operands)
  where
    syncpressCommandValid (words)
    name is syncpressCommandName (words)
    operands is syncpressCommandOperands (words)
```

```view
the Syncpress misuse report — inputs (); outputs (text); bindings () — answers exactly one (text)
  where text is syncpressMisuse
```

```view
the Syncpress usage report — inputs (); outputs (text); bindings () — answers exactly one (text)
  where text is syncpressUsage
```

```view
the inspection owner of target (target) — inputs (target); outputs (owner); bindings (root) — answers at most one (owner)
  where Routing._owner (address: target) has (owner)
  where
    Filing._named (name: "content") has (root)
    Filing._at (path: target, root) has (file: owner)
```

```view
the invalid rendering selection for path (path) and data (data) — inputs (path, data); outputs (error, detail); bindings () — answers at most one (error, detail)
  where
    pageRenderingSelectionHasValidity (data, path, valid: false)
    error is pageRenderingError (data, path)
    detail is pageRenderingErrorDetail (data, path)
```

```view
the publication place — inputs (); outputs (place, destination); bindings () — answers at most one (place, destination)
  where
    Locating._named (name: "destination") has (place)
    Locating._place (place) has (real: destination)
  where
    no Locating._named (name: "destination")
    Locating._named (name: "output") has (place)
    Locating._place (place) has (real: destination)
```

```view
the publication transaction prefix of destination (destination) — inputs (destination); outputs (prefix); bindings () — answers at most one (prefix)
  where
    prefix is publicationTransactionPrefix (destination)
    isTextValue (value: prefix)
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

```former
Former "the build diagnostics inspection" — inputs (); bindings (diagnostic, severity, code, message, source, line, column, relatedSource, relatedLine, relatedColumn, note); promises exactly one record — forms:
  a record of
    diagnostics: each Diagnosing._all () has (code, column, diagnostic, line, message, severity, source)
      form a record of
        code
        column
        diagnostic
        line
        message
        related: each Diagnosing._related (diagnostic) has (column: relatedColumn, line: relatedLine, note, source: relatedSource)
          form a record of
            column: relatedColumn
            line: relatedLine
            note
            source: relatedSource
        severity
        source
```

```former
Former "the catalog inspection of owner (owner)" — inputs (owner); bindings (catalog, name, index); promises exactly one record — forms:
  a record of
    memberships: each Cataloging._membership (item: owner) has (catalog, name)
      where Cataloging._position (catalog, item: owner) has (index)
      form a record of
        collection: catalog
        index
        name
```

```former
Former "the claim inspection of owner (owner)" — inputs (owner); bindings (address); promises exactly one record — forms:
  a record of
    claims: each Routing._claims () has (address, owner)
      form a record of
        address
        owner
```

```former
Former "the completed body render facts of rendering (rendering)" — inputs (rendering); bindings (content); promises exactly one record — forms:
  a record of
    where Referencing._finished (part: "body", subject: rendering) has (text: content)
    content
```

```former
Former "the dependency inspection of owner (owner)" — inputs (owner); bindings (state, reason, input); promises exactly one record — forms:
  a record of
    dependencies: a record of
      where Depending._state (subject: owner) has (state)
      where whether Depending._reason (subject: owner) has (reason)
      inputs: each Depending._uses (subject: owner) has (input)
        form a record of
          input
      reason
      state
```

```former
Former "the deployment entries of catalog (catalog)" — inputs (catalog); bindings (item, card); promises exactly one record — forms:
  each Cataloging._entries (catalog) has (card, item)
    form a record of
      card
      item
```

```former
Former "the diagnosed text" — inputs (); bindings (text); promises exactly one record — forms:
  a record of
    where Diagnosing._rendered () has (text)
    text
```

```former
Former "the layer inspection of owner (owner)" — inputs (owner); bindings (layer, rank, values, path, originRank, originLayer); promises exactly one record — forms:
  a record of
    layers: each Layering._layers (subject: owner) has (layer, rank, values)
      form a record of
        layer
        rank
        values
    origins: each Layering._leafOrigins (subject: owner) has (layer: originLayer, path, rank: originRank)
      form a record of
        layer: originLayer
        path
        rank: originRank
```

```former
Former "the originated page render facts of rendering (rendering)" — inputs (rendering); bindings (page, address, canonicalUrl); promises exactly one record — forms:
  a record of
    where Rendering._active (rendering) has (subject: page)
    where Routing._address (owner: page) has (address)
    where view "absolute site URL of address (address)" with (address) has (url: canonicalUrl)
    canonicalUrl
```

```former
Former "the page render facts of rendering (rendering)" — inputs (rendering); bindings (page, data, address, path); promises exactly one record — forms:
  a record of
    where Rendering._active (rendering) has (subject: page)
    where Layering._resolved (subject: page) has (values: data)
    where Routing._address (owner: page) has (address)
    where Filing._file (file: page) has (path)
    data
    source: a record of
      path
    url: address
```

```former
Former "the site render facts" — inputs (); bindings (site, collections); promises exactly one record — forms:
  a record of
    where Governing._site () has (site)
    where Cataloging._record () has (catalogs: collections)
    collections
    site
```

```former
Former "the originated completed render context of rendering (rendering)" — inputs (rendering); bindings (); promises exactly one record — forms:
  a record of
    page: a record of
      … former "the page render facts of rendering (rendering)" with (rendering)
      … former "the originated page render facts of rendering (rendering)" with (rendering)
      … former "the completed body render facts of rendering (rendering)" with (rendering)
    … former "the site render facts"
```

```former
Former "the originated render context of rendering (rendering)" — inputs (rendering); bindings (); promises exactly one record — forms:
  a record of
    page: a record of
      … former "the page render facts of rendering (rendering)" with (rendering)
      … former "the originated page render facts of rendering (rendering)" with (rendering)
    … former "the site render facts"
```

```former
Former "the output inspection of owner (owner)" — inputs (owner); bindings (path, digest, medium); promises exactly one record — forms:
  a record of
    outputs: each Emitting._byProducer (producer: owner) has (digest, medium, path)
      form a record of
        digest
        medium
        path
```

```former
Former "the publication card of page (page)" — inputs (page); bindings (data, address, excerpt, root, path); promises exactly one record — forms:
  a record of
    where Layering._resolved (subject: page) has (values: data)
    where Routing._address (owner: page) has (address)
    where whether Converting._excerpt (part: "excerpt", subject: page) has (excerpt)
    where Filing._named (name: "content") has (root)
    where Filing._file (file: page) has (path, root)
    data
    excerpt
    source: a record of
      path
    url: address
```

```former
Former "the rendering inspection of owner (owner)" — inputs (owner); bindings (rendering, path, profile, template, stage, bodySource, layoutSource, historicalRendering, historicalPath, historicalProfile, historicalTemplate, historicalStage); promises exactly one record — forms:
  a record of
    rendering: a record of
      where whether Rendering._latest (subject: owner) has (path, profile, rendering, stage, template)
      attempt: rendering
      body: a record of
        where whether Referencing._finished (part: "body", subject: rendering) has (source: bodySource)
        source: bodySource
      layout: a record of
        where whether Referencing._finished (part: "layout", subject: rendering) has (source: layoutSource)
        source: layoutSource
      path
      profile
      stage
      template
    renderings: each Rendering._all () has (path: historicalPath, profile: historicalProfile, rendering: historicalRendering, stage: historicalStage, subject: owner, template: historicalTemplate)
      form a record of
        attempt: historicalRendering
        path: historicalPath
        profile: historicalProfile
        stage: historicalStage
        template: historicalTemplate
```

```former
Former "the route inspection of owner (owner)" — inputs (owner); bindings (route); promises exactly one record — forms:
  a record of
    route: a record of
      where whether Routing._address (owner) has (address: route)
      address: route
```

```former
Former "the site build summary" — inputs (); bindings (owner, file, policy, destination, severity, code, message, source, line, column); promises exactly one record — forms:
  a record of
    where whether Governing._policy () has (policy)
    where whether view "the publication place" has (destination)
    destination
    diagnosis: former "the diagnosed text"
    diagnostics: each Diagnosing._all () has (code, column, line, message, severity, source)
      form a record of
        code
        column
        line
        message
        severity
        source
    files: the count of Filing._files () has (file)
    pages: the count of Routing._claims () has (owner)
    policy
```

```former
Former "the source inspection of owner (owner)" — inputs (owner); bindings (path, digest); promises exactly one record — forms:
  a record of
    source: a record of
      where whether Filing._file (file: owner) has (digest, path)
      digest
      path
```

```former
Former "the template inspection of owner (owner)" — inputs (owner); bindings (name, template, digest, used); promises exactly one record — forms:
  a record of
    template: a record of
      where whether Rendering._latest (subject: owner) has (template: name)
      where whether Templating._template (name) has (digest, template)
      digest
      name
      tree: each Templating._tree (owner: template) has (used)
        form a record of
          used
```

```former
Former "the site inspection of owner (owner)" — inputs (owner); bindings (); promises exactly one record — forms:
  a record of
    … former "the route inspection of owner (owner)" with (owner)
    … former "the source inspection of owner (owner)" with (owner)
    … former "the template inspection of owner (owner)" with (owner)
    … former "the layer inspection of owner (owner)" with (owner)
    … former "the rendering inspection of owner (owner)" with (owner)
    … former "the catalog inspection of owner (owner)" with (owner)
    … former "the dependency inspection of owner (owner)" with (owner)
    … former "the output inspection of owner (owner)" with (owner)
    … former "the claim inspection of owner (owner)" with (owner)
    … former "the build diagnostics inspection"
```

```former
Former "the sitemap urls" — inputs (); bindings (owner, address, url); promises exactly one record — forms:
  each view "sitemap page" has (address, owner, url)
    form a record of
      url
```

```former
Former "the unoriginated page render facts of rendering (rendering)" — inputs (rendering); bindings (page, address); promises exactly one record — forms:
  a record of
    where Rendering._active (rendering) has (subject: page)
    where Routing._address (owner: page) has (address)
    where no view "absolute site URL of address (address)" with (address)
```

```former
Former "the unoriginated completed render context of rendering (rendering)" — inputs (rendering); bindings (); promises exactly one record — forms:
  a record of
    page: a record of
      … former "the page render facts of rendering (rendering)" with (rendering)
      … former "the unoriginated page render facts of rendering (rendering)" with (rendering)
      … former "the completed body render facts of rendering (rendering)" with (rendering)
    … former "the site render facts"
```

```former
Former "the unoriginated render context of rendering (rendering)" — inputs (rendering); bindings (); promises exactly one record — forms:
  a record of
    page: a record of
      … former "the page render facts of rendering (rendering)" with (rendering)
      … former "the unoriginated page render facts of rendering (rendering)" with (rendering)
    … former "the site render facts"
```

## Reactions

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### fullSite.collections.CatalogIndexFailuresDiagnose

```reaction
when refused Cataloging.index (item: page, path, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "collect", transitioned: true)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "collection-indexing", severity: "error", source: path)
```

### fullSite.collections.CollectPhaseIndexesPages

```reaction
when Phasing.advance (name: "site-build", phase: "collect", transitioned: true)
where
  Routing._claims () has (owner: page)
  Filing._named (name: "content") has (root: content)
  Filing._file (file: page) has (path, root: content)
  Cataloging._catalogs () has (catalog)
then
  Cataloging.index (card: former "the publication card of page (page)" with (page), catalog, item: page, path, tiebreak: path)
```

### fullSite.commanding.AnnounceMisuse

```reaction
when RequestBoundary.request (path: "/cli/misuse", requestId)
where
  view "the Syncpress misuse report" has (text)
then
  Commanding.write (stream: "error", text)
```

### fullSite.commanding.AnnounceMisuse#2

```reaction
when Commanding.write (stream: "error", text), asked by fullSite.commanding.AnnounceMisuse
where
  earlier, RequestBoundary.request (path: "/cli/misuse", requestId)
then
  RequestBoundary.respond (requestId)
```

### fullSite.commanding.AnnounceUsage

```reaction
when RequestBoundary.request (path: "/cli/usage", requestId)
where
  view "the Syncpress usage report" has (text)
then
  Commanding.write (stream: "output", text)
```

### fullSite.commanding.AnnounceUsage#2

```reaction
when Commanding.write (stream: "output", text), asked by fullSite.commanding.AnnounceUsage
where
  earlier, RequestBoundary.request (path: "/cli/usage", requestId)
then
  RequestBoundary.respond (requestId)
```

### fullSite.commanding.HoldUntilStopped

```reaction
when RequestBoundary.request (path: "/cli/hold", requestId)
then
  Attending.hold ()
```

### fullSite.commanding.HoldUntilStopped#2

```reaction
when Attending.hold (reason), asked by fullSite.commanding.HoldUntilStopped
where
  earlier, RequestBoundary.request (path: "/cli/hold", requestId)
then
  RequestBoundary.respond (reason, requestId)
```

### fullSite.commanding.InterpretCommandLine

```reaction
when RequestBoundary.request (arguments: supplied, path: "/cli/interpret", requestId)
then
  Commanding.capture (arguments: supplied)
```

### fullSite.commanding.InterpretCommandLine:invalid#2

```reaction
when Commanding.capture (arguments: supplied, words), asked by fullSite.commanding.InterpretCommandLine
where
  no view "the Syncpress command represented by words (words)" with (words)
  earlier, RequestBoundary.request (arguments: supplied, path: "/cli/interpret", requestId)
then
  RequestBoundary.respond (error: "INVALID_USAGE", requestId)
```

### fullSite.commanding.InterpretCommandLine:recognized#2

```reaction
when Commanding.capture (arguments: supplied, words), asked by fullSite.commanding.InterpretCommandLine
where
  view "the Syncpress command represented by words (words)" with (words)
  earlier, RequestBoundary.request (arguments: supplied, path: "/cli/interpret", requestId)
then
  RequestBoundary.respond (requestId, words)
```

### fullSite.commanding.SetCommandLineExit

```reaction
when RequestBoundary.request (code, path: "/cli/exit", requestId)
then
  Commanding.exit (code)
```

### fullSite.commanding.SetCommandLineExit#2

```reaction
when Commanding.exit (code), asked by fullSite.commanding.SetCommandLineExit
where
  earlier, RequestBoundary.request (code, path: "/cli/exit", requestId)
then
  RequestBoundary.respond (requestId)
```

### fullSite.commanding.WriteCommandLine

```reaction
when RequestBoundary.request (path: "/cli/write", requestId, stream, text)
then
  Commanding.write (stream, text)
```

### fullSite.commanding.WriteCommandLine#2

```reaction
when Commanding.write (stream, text), asked by fullSite.commanding.WriteCommandLine
where
  earlier, RequestBoundary.request (path: "/cli/write", requestId, stream, text)
then
  RequestBoundary.respond (requestId)
```

### fullSite.deployment.AbsoluteDeploymentLayoutReferencesRebase

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  Referencing._references (source) has (raw, reference)
  targetHasKind (kind: "absolute", target: raw)
  view "site URL of target (target)" with (target: raw) has (url)
then
  Referencing.answer (form: "address", reference, value: url)
```

### fullSite.deployment.ActivatedFeedWorkSnapshotsInputs

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "feed")
  Cataloging._named (name: collectionName) has (catalog)
  Governing._site () has (site)
then
  Deploying.snapshotFeed (entries: former "the deployment entries of catalog (catalog)" with (catalog), site, work)
```

### fullSite.deployment.ActivatedFeedsWithoutCollectionsDiagnose:diagnose

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "feed")
  no Cataloging._named (name: collectionName)
then
  Diagnosing.report (code: "FEED_COLLECTION_NOT_FOUND", message: "Feed names no configured collection.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.ActivatedFeedsWithoutCollectionsDiagnose:reject

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "feed")
  no Cataloging._named (name: collectionName)
then
  Deploying.reject (work)
```

### fullSite.deployment.ActivatedNojekyllWorkBegins

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (kind: "nojekyll", producer)
then
  Emitting.begin (producer)
```

### fullSite.deployment.ActivatedPaginationPlansDivide

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, deployment, kind: "pagination-plan", templateName)
  Cataloging._named (name: collectionName) has (catalog)
  Templating._template (name: templateName) has (template)
then
  Deploying.divide (deployment, entries: former "the deployment entries of catalog (catalog)" with (catalog), template, work)
```

### fullSite.deployment.ActivatedPaginationPlansWithoutCollectionsDiagnose:diagnose

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "pagination-plan")
  no Cataloging._named (name: collectionName)
then
  Diagnosing.report (code: "PAGINATION_COLLECTION_NOT_FOUND", message: "A pagination rule names no configured collection.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.ActivatedPaginationPlansWithoutCollectionsDiagnose:reject

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "pagination-plan")
  no Cataloging._named (name: collectionName)
then
  Deploying.reject (work)
```

### fullSite.deployment.ActivatedPaginationPlansWithoutTemplatesDiagnose:diagnose

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "pagination-plan", templateName)
  Cataloging._named (name: collectionName)
  no Templating._template (name: templateName)
then
  Diagnosing.report (code: "TEMPLATE_NOT_FOUND", message: "A pagination rule selects an undefined template.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.ActivatedPaginationPlansWithoutTemplatesDiagnose:reject

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "pagination-plan", templateName)
  Cataloging._named (name: collectionName)
  no Templating._template (name: templateName)
then
  Deploying.reject (work)
```

### fullSite.deployment.ActivatedRoutedDeploymentWorkClaims

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  view "routed deployment work (work)" with (work) has (address, owner)
then
  Routing.claim (address, owner)
```

### fullSite.deployment.ActivatedSitemapWorkSnapshotsUrls

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (kind: "sitemap")
then
  Deploying.snapshotSitemap (urls: former "the sitemap urls", work)
```

### fullSite.deployment.BegunFeedsIntend

```reaction
when Emitting.begin (producer, attempt)
where
  Deploying._forProducer (producer) has (kind: "feed", work)
  earlier, Deploying.prepareFeed (work, content, origin: true, path)
then
  Emitting.intend (attempt, content, medium: "application/atom+xml", path, producer)
```

### fullSite.deployment.BegunNojekyllWorkIntends

```reaction
when Emitting.begin (producer, attempt)
where
  Deploying._forProducer (producer) has (kind: "nojekyll", path)
then
  Emitting.intend (attempt, content: "", medium: "text/plain", path, producer)
```

### fullSite.deployment.BegunPaginationPagesIntend

```reaction
when Emitting.begin (producer, attempt)
where
  Deploying._forProducer (producer) has (address, kind: "pagination-page")
  view "output path of address (address)" with (address) has (path)
  Referencing._finished (part: "deployment-layout", subject: producer) has (text)
then
  Emitting.intend (attempt, content: text, medium: "text/html", path, producer)
```

### fullSite.deployment.BegunRedirectsIntend

```reaction
when Emitting.begin (producer, attempt)
where
  Deploying._forProducer (producer) has (from: address, kind: "redirect", work)
  view "output path of address (address)" with (address) has (path)
  earlier, Deploying.redirect (work, content)
then
  Emitting.intend (attempt, content, medium: "text/html", path, producer)
```

### fullSite.deployment.BegunSitemapsIntend

```reaction
when Emitting.begin (producer, attempt)
where
  Deploying._forProducer (producer) has (kind: "sitemap", work)
  earlier, Deploying.prepareSitemap (work, content, path)
then
  Emitting.intend (attempt, content, medium: "application/xml", path, producer)
```

### fullSite.deployment.ClaimedExternalRedirectsPrepare

```reaction
when Routing.claim (owner)
where
  Deploying._forOwner (owner) has (kind: "redirect", to: target, work)
  targetHasKind (kind: "external", target)
  content is deploymentRedirectDocument (canonical: target, target)
then
  Deploying.redirect (canonical: target, content, target, work)
```

### fullSite.deployment.ClaimedLocalRedirectsPrepare

```reaction
when Routing.claim (owner)
where
  Deploying._forOwner (owner) has (kind: "redirect", to: raw, work)
  view "site URL of target (target)" with (target: raw) has (url: target)
  view "absolute site URL of address (address)" with (address: raw) has (url: canonical)
  content is deploymentRedirectDocument (canonical, target)
then
  Deploying.redirect (canonical, content, target, work)
```

### fullSite.deployment.ClaimedPaginationPagesPrepareContext

```reaction
when Routing.claim (owner)
where
  Deploying._forOwner (owner) has (address, cards, collection, kind: "pagination-page", next, number, pages, previous, sourcePath, title, work)
  Governing._site () has (site)
  Cataloging._record () has (catalogs: collections)
  whether view "absolute site URL of address (address)" with (address) has (url: canonicalUrl)
  context is deploymentPaginationContext (address, canonicalUrl, cards, collection, collections, next, number, pages, previous, site, sourcePath, title)
then
  Deploying.context (context, work)
```

### fullSite.deployment.ClaimedUnoriginatedRedirectsPrepare

```reaction
when Routing.claim (owner)
where
  Deploying._forOwner (owner) has (kind: "redirect", to: raw, work)
  view "site URL of target (target)" with (target: raw) has (url: target)
  no view "absolute site URL of address (address)" with (address: raw)
  content is deploymentRedirectDocument (canonical: target, target)
then
  Deploying.redirect (canonical: target, content, target, work)
```

### fullSite.deployment.CommittedDeploymentArtifactsComplete

```reaction
when Emitting.commit (attempt, producer)
where
  view "committable deployment work of producer (producer)" with (producer) has (work)
  Emitting._attempt (producer) has (attempt)
then
  Deploying.complete (work)
```

### fullSite.deployment.DeploymentBeginFailuresDiagnose

```reaction
when refused Emitting.begin (producer, detail, error)
where
  view "committable deployment work of producer (producer)" with (producer) has (work)
then
  Deploying.reject (work)
```

### fullSite.deployment.DeploymentBeginFailuresDiagnose#2

```reaction
when Deploying.reject (work), asked by fullSite.deployment.DeploymentBeginFailuresDiagnose
where
  earlier, refused Emitting.begin (producer, detail, error)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.DeploymentCommitFailuresDiagnose

```reaction
when refused Emitting.commit (attempt, producer, detail, error)
where
  view "committable deployment work of producer (producer)" with (producer) has (work)
  Emitting._open (producer) has (attempt)
then
  Deploying.reject (work)
```

### fullSite.deployment.DeploymentCommitFailuresDiagnose#2

```reaction
when Deploying.reject (work), asked by fullSite.deployment.DeploymentCommitFailuresDiagnose
where
  earlier, refused Emitting.commit (attempt, producer, detail, error)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.DeploymentIntentFailuresFailAndAbort

```reaction
when refused Emitting.intend (attempt, path, producer, detail, error)
where
  view "committable deployment work of producer (producer)" with (producer)
  Emitting._open (producer) has (attempt)
then
  Deploying.fail (code: error, detail, path, producer)
```

### fullSite.deployment.DeploymentIntentFailuresFailAndAbort#2

```reaction
when Deploying.fail (code: error, detail, path, producer), asked by fullSite.deployment.DeploymentIntentFailuresFailAndAbort
where
  earlier, refused Emitting.intend (attempt, path, producer, detail, error)
then
  Emitting.abort (attempt, producer)
```

### fullSite.deployment.DeploymentOutputFailuresRelateProducers

```reaction
when Diagnosing.report (code: "PATH_CONTESTED", diagnostic)
where
  earlier, Deploying.fail (path)
  Emitting._producers (path) has (producer)
then
  Diagnosing.relate (diagnostic, note: "Competing output producer.", source: producer)
```

### fullSite.deployment.DeploymentReferenceAnswerFailuresDiagnose:diagnose

```reaction
when refused Referencing.answer (reference, detail, error)
where
  Referencing._reference (reference) has (source)
  Referencing._source (source) has (part: "deployment-layout", subject: owner)
  Deploying._forOwner (owner)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.DeploymentReferenceAnswerFailuresDiagnose:reject

```reaction
when refused Referencing.answer (reference, detail, error)
where
  Referencing._reference (reference) has (source)
  Referencing._source (source) has (part: "deployment-layout", subject: owner)
  Deploying._forOwner (owner)
then
  Deploying.rejectOwner (owner)
```

### fullSite.deployment.DeploymentReferenceScanFailuresDiagnose

```reaction
when refused Referencing.scan (part: "deployment-layout", subject: owner, detail, error)
where
  Deploying._forOwner (owner)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.DeploymentReferenceScanFailuresDiagnose#2

```reaction
when Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml"), asked by fullSite.deployment.DeploymentReferenceScanFailuresDiagnose
where
  earlier, refused Referencing.scan (part: "deployment-layout", subject: owner, detail, error)
then
  Deploying.rejectOwner (owner)
```

### fullSite.deployment.DescribedDeploymentOutputFailuresDiagnose

```reaction
when Deploying.fail (path, code, message)
then
  Diagnosing.report (code, message, severity: "error", source: "site.yaml")
```

### fullSite.deployment.EmitPhaseStartsDeployment

```reaction
when Phasing.advance (name: "site-build", phase: "emit", transitioned: true)
where
  Governing._publishing () has (policy)
then
  Deploying.start (policy)
```

### fullSite.deployment.EmptyPaginationLayoutScansBegin

```reaction
when Referencing.scan (part: "deployment-layout", subject: owner, completed: true)
where
  Deploying._forOwner (owner) has (producer)
then
  Emitting.begin (producer)
```

### fullSite.deployment.FinishedPaginationLayoutAnswersBegin

```reaction
when Referencing.answer (completed: true, part: "deployment-layout", subject: owner)
where
  Deploying._forOwner (owner) has (producer)
then
  Emitting.begin (producer)
```

### fullSite.deployment.GeneratedClaimsBeginDependencies

```reaction
when Routing.claim (owner)
where
  Deploying._forOwner (owner)
then
  Depending.begin (subject: owner)
```

### fullSite.deployment.GeneratedDependenciesSettle

```reaction
when Depending.use (attempt, input: "site.yaml", subject: owner)
where
  Deploying._forOwner (owner)
then
  Depending.settle (attempt, subject: owner)
```

### fullSite.deployment.GeneratedDependenciesTrackConfiguration

```reaction
when Depending.begin (subject: owner, attempt)
where
  Deploying._forOwner (owner)
then
  Depending.use (attempt, input: "site.yaml", subject: owner)
```

### fullSite.deployment.GeneratedRouteCollisionsDiagnose

```reaction
when refused Routing.claim (owner, detail, error: "ADDRESS_TAKEN")
where
  Deploying._forOwner (owner)
then
  Diagnosing.report (code: "ROUTE_COLLISION", message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.GeneratedRouteCollisionsDiagnose#2

```reaction
when Diagnosing.report (code: "ROUTE_COLLISION", message: detail, severity: "error", source: "site.yaml"), asked by fullSite.deployment.GeneratedRouteCollisionsDiagnose
where
  earlier, refused Routing.claim (owner, detail, error: "ADDRESS_TAKEN")
then
  Deploying.rejectOwner (owner)
```

### fullSite.deployment.IntendedDeploymentArtifactsCommit

```reaction
when Emitting.intend (attempt, producer)
where
  view "committable deployment work of producer (producer)" with (producer)
  Emitting._open (producer) has (attempt)
then
  Emitting.commit (attempt, producer)
```

### fullSite.deployment.InvalidDeploymentLayoutReferencesDiagnose:diagnose

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  Referencing._source (source) has (subject: owner)
  Deploying._forOwner (owner)
  Referencing._references (source) has (raw)
  targetHasKind (kind: "relative", target: raw)
then
  Diagnosing.report (code: "RELATIVE_LAYOUT_REFERENCE", message: "A generated layout reference must be site-absolute, external, or fragment-only.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.InvalidDeploymentLayoutReferencesDiagnose:reject

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  Referencing._source (source) has (subject: owner)
  Deploying._forOwner (owner)
  Referencing._references (source) has (raw)
  targetHasKind (kind: "relative", target: raw)
then
  Deploying.rejectOwner (owner)
```

### fullSite.deployment.InvalidFeedEntriesDiagnose

```reaction
when Deploying.prepareFeed (work, origin: true, valid: false)
then
  Diagnosing.report (code: "INVALID_FEED_ENTRY", message: "Feed entries need a routed URL and a valid data.date.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.InvalidFeedEntriesDiagnose#2

```reaction
when Diagnosing.report (code: "INVALID_FEED_ENTRY", message: "Feed entries need a routed URL and a valid data.date.", severity: "error", source: "site.yaml"), asked by fullSite.deployment.InvalidFeedEntriesDiagnose
where
  earlier, Deploying.prepareFeed (work, origin: true, valid: false)
then
  Deploying.reject (work)
```

### fullSite.deployment.InvalidGeneratedRoutesDiagnose

```reaction
when refused Routing.claim (owner, detail, error: "INVALID_ADDRESS")
where
  Deploying._forOwner (owner)
then
  Diagnosing.report (code: "INVALID_ADDRESS", message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.InvalidGeneratedRoutesDiagnose#2

```reaction
when Diagnosing.report (code: "INVALID_ADDRESS", message: detail, severity: "error", source: "site.yaml"), asked by fullSite.deployment.InvalidGeneratedRoutesDiagnose
where
  earlier, refused Routing.claim (owner, detail, error: "INVALID_ADDRESS")
then
  Deploying.rejectOwner (owner)
```

### fullSite.deployment.MissingRequiredNotFoundPagesDiagnose

```reaction
when Phasing.advance (name: "site-build", phase: "emit", transitioned: true)
where
  Governing._deployment () has (requireNotFound: true)
  no Routing._owner (address: "/404.html")
then
  Diagnosing.report (code: "MISSING_NOT_FOUND", message: "deploy.requireNotFound requires an authored /404.html page.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.NonlocalDeploymentLayoutReferencesHold

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  view "held deployment layout reference of source (source)" with (source) has (raw, reference)
then
  Referencing.answer (form: "address", reference, value: raw)
```

### fullSite.deployment.OriginlessFeedsDiagnose

```reaction
when Deploying.prepareFeed (work, origin: false)
then
  Diagnosing.report (code: "ORIGIN_REQUIRED", message: "Feed generation requires a valid site.origin.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.OriginlessFeedsDiagnose#2

```reaction
when Diagnosing.report (code: "ORIGIN_REQUIRED", message: "Feed generation requires a valid site.origin.", severity: "error", source: "site.yaml"), asked by fullSite.deployment.OriginlessFeedsDiagnose
where
  earlier, Deploying.prepareFeed (work, origin: false)
then
  Deploying.reject (work)
```

### fullSite.deployment.PaginationContextsRender

```reaction
when Deploying.context (work, context, owner, template)
then
  Templating.render (context, subject: owner, template, trusted: [["page", "content"], (wildcard: ["collections", "*", "*", "excerpt"])])
```

### fullSite.deployment.PaginationTemplateFailuresDiagnose

```reaction
when refused Templating.render (subject: owner, detail, error)
where
  Deploying._forOwner (owner) has (kind: "pagination-page")
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.PaginationTemplateFailuresDiagnose#2

```reaction
when Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml"), asked by fullSite.deployment.PaginationTemplateFailuresDiagnose
where
  earlier, refused Templating.render (subject: owner, detail, error)
then
  Deploying.rejectOwner (owner)
```

### fullSite.deployment.PreparedFeedsBegin

```reaction
when Deploying.prepareFeed (work, origin: true, valid: true)
where
  Deploying._work (work) has (producer)
then
  Emitting.begin (producer)
```

### fullSite.deployment.PreparedRedirectsBegin

```reaction
when Deploying.redirect (work)
where
  Deploying._work (work) has (producer)
then
  Emitting.begin (producer)
```

### fullSite.deployment.PreparedSitemapsBegin

```reaction
when Deploying.prepareSitemap (work)
where
  Deploying._work (work) has (producer)
then
  Emitting.begin (producer)
```

### fullSite.deployment.RenderedPaginationLayoutsScan

```reaction
when Templating.render (subject: owner, output)
where
  Deploying._forOwner (owner) has (kind: "pagination-page")
then
  Referencing.scan (part: "deployment-layout", subject: owner, text: output)
```

### fullSite.deployment.SnapshottedFeedInputsPrepare

```reaction
when Deploying.snapshotFeed (work, description, entries, path, site, title)
where
  preparation is deploymentFeedPreparation (description, entries, path, site, title)
then
  Deploying.prepareFeed (preparation, work)
```

### fullSite.deployment.SnapshottedSitemapUrlsPrepare

```reaction
when Deploying.snapshotSitemap (work, urls)
where
  content is deploymentSitemapDocument (urls)
then
  Deploying.prepareSitemap (content, work)
```

### fullSite.deployment.UnprojectableDeploymentLayoutReferencesDiagnose:diagnose

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  Referencing._source (source) has (subject: owner)
  Deploying._forOwner (owner)
  Referencing._references (source) has (raw)
  targetHasKind (kind: "absolute", target: raw)
  no view "site URL of target (target)" with (target: raw)
then
  Diagnosing.report (code: "INVALID_LOCAL_REFERENCE", message: "A generated layout reference could not be projected.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.UnprojectableDeploymentLayoutReferencesDiagnose:reject

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  Referencing._source (source) has (subject: owner)
  Deploying._forOwner (owner)
  Referencing._references (source) has (raw)
  targetHasKind (kind: "absolute", target: raw)
  no view "site URL of target (target)" with (target: raw)
then
  Deploying.rejectOwner (owner)
```

### fullSite.endpoints.AdvanceSiteBuild

```reaction
when Phasing.advance (attempt, job, name: "site-build", transitioned: true)
at the flow's settlement frontier
where
  Phasing._job (job) has (attempt: nextAttempt, name: "site-build", state: "running")
  no view "pending failed rendering cleanup"
then
  Phasing.advance (attempt: nextAttempt, job)
```

### fullSite.endpoints.AdvanceStartedSiteBuild

```reaction
when Phasing.start (sequence, attempt, job, name: "site-build")
at the flow's settlement frontier
where
  Phasing._running (sequence) has (attempt, job, name: "site-build")
then
  Phasing.advance (attempt, job)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput

```reaction
when RequestBoundary.request (destination, directory, path: "/site/build", requestId)
where
  isAbsentValue (value: destination)
then
  Locating.request (name: "site", path: directory)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput#2

```reaction
when Locating.request (name: "site", path: directory), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput
then
  Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"])
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput#3

```reaction
when Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"], sequence), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#2
then
  Phasing.start (sequence)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput#4

```reaction
when Phasing.start (sequence, job), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#3
at the flow's settlement frontier
where
  view "the settled site build of job (job)" with (job)
then
  Delivering.settle (task: job)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput:errors#5

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#4
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  Diagnosing._clean () has (clean: false)
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_HAS_ERRORS", requestId)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput:failed#5

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#4
where
  view "the settled site build of job (job)" with (job) has (state: "failed")
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_FAILED", requestId)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput:incomplete#5

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#4
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  Diagnosing._clean () has (clean: true)
  no view "job (job) is a publishable site build" with (job)
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_INCOMPLETE", requestId)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput:published#5

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#4
where
  view "job (job) is a publishable site build" with (job)
then
  Emitting.reconcile ()
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput:published#6

```reaction
when Emitting.reconcile (kept, removed, replaced, written), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput:published#5
where
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (kept, removed, replaced, requestId, summary: former "the site build summary", written)
```

### fullSite.endpoints.BuildSiteAtDestination

```reaction
when RequestBoundary.request (destination, directory, path: "/site/build", requestId)
where
  isTextValue (value: destination)
then
  Locating.request (name: "site", path: directory)
```

### fullSite.endpoints.BuildSiteAtDestination#2

```reaction
when Locating.request (name: "site", path: directory), asked by fullSite.endpoints.BuildSiteAtDestination
where
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  Locating.request (name: "destination", path: destination)
```

### fullSite.endpoints.BuildSiteAtDestination#3

```reaction
when Locating.request (name: "destination", path: destination), asked by fullSite.endpoints.BuildSiteAtDestination#2
then
  Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"])
```

### fullSite.endpoints.BuildSiteAtDestination#4

```reaction
when Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"], sequence), asked by fullSite.endpoints.BuildSiteAtDestination#3
then
  Phasing.start (sequence)
```

### fullSite.endpoints.BuildSiteAtDestination#5

```reaction
when Phasing.start (sequence, job), asked by fullSite.endpoints.BuildSiteAtDestination#4
at the flow's settlement frontier
where
  view "the settled site build of job (job)" with (job)
then
  Delivering.settle (task: job)
```

### fullSite.endpoints.BuildSiteAtDestination:errors#6

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtDestination#5
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  Diagnosing._clean () has (clean: false)
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_HAS_ERRORS", requestId)
```

### fullSite.endpoints.BuildSiteAtDestination:failed#6

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtDestination#5
where
  view "the settled site build of job (job)" with (job) has (state: "failed")
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_FAILED", requestId)
```

### fullSite.endpoints.BuildSiteAtDestination:incomplete#6

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtDestination#5
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  Diagnosing._clean () has (clean: true)
  no view "job (job) is a publishable site build" with (job)
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_INCOMPLETE", requestId)
```

### fullSite.endpoints.BuildSiteAtDestination:published#6

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtDestination#5
where
  view "job (job) is a publishable site build" with (job)
then
  Emitting.reconcile ()
```

### fullSite.endpoints.BuildSiteAtDestination:published#7

```reaction
when Emitting.reconcile (kept, removed, replaced, written), asked by fullSite.endpoints.BuildSiteAtDestination:published#6
where
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (kept, removed, replaced, requestId, summary: former "the site build summary", written)
```

### fullSite.endpoints.InspectSite

```reaction
when RequestBoundary.request (directory, path: "/site/inspect", requestId, target)
then
  Locating.request (name: "site", path: directory)
```

### fullSite.endpoints.InspectSite#2

```reaction
when Locating.request (name: "site", path: directory), asked by fullSite.endpoints.InspectSite
then
  Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"])
```

### fullSite.endpoints.InspectSite#3

```reaction
when Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"], sequence), asked by fullSite.endpoints.InspectSite#2
then
  Phasing.start (sequence)
```

### fullSite.endpoints.InspectSite#4

```reaction
when Phasing.start (sequence, job), asked by fullSite.endpoints.InspectSite#3
at the flow's settlement frontier
where
  view "the settled site build of job (job)" with (job)
then
  Delivering.settle (task: job)
```

### fullSite.endpoints.InspectSite:failed#5

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.InspectSite#4
where
  view "the settled site build of job (job)" with (job) has (state: "failed")
  earlier, RequestBoundary.request (directory, path: "/site/inspect", requestId, target)
then
  RequestBoundary.respond (error: "BUILD_FAILED", requestId)
```

### fullSite.endpoints.InspectSite:found#5

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.InspectSite#4
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  earlier, RequestBoundary.request (directory, path: "/site/inspect", requestId, target)
  view "the inspection owner of target (target)" with (target) has (owner)
then
  RequestBoundary.respond (inspection: former "the site inspection of owner (owner)" with (owner), owner, requestId)
```

### fullSite.endpoints.InspectSite:missing#5

```reaction
when Delivering.settle (task: job, interrupted: false), asked by fullSite.endpoints.InspectSite#4
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  earlier, RequestBoundary.request (directory, path: "/site/inspect", requestId, target)
  no view "the inspection owner of target (target)" with (target)
then
  RequestBoundary.respond (error: "INSPECTION_TARGET_NOT_FOUND", requestId)
```

### fullSite.endpoints.ReadSiteSummary

```reaction
when RequestBoundary.request (path: "/site/summary", requestId)
then
  RequestBoundary.respond (requestId, summary: former "the site build summary")
```

### fullSite.endpoints.SiteBuildFaultsInterruptAggregateDelivery

```reaction
when any action is faulted
where
  earlier, Phasing.start (job, name: "site-build")
then
  Delivering.interrupt (task: job)
```

### fullSite.endpoints.SiteBuildRefusalsInterruptAggregateDelivery

```reaction
when any action is refused
where
  earlier, Phasing.start (job, name: "site-build")
then
  Delivering.interrupt (task: job)
```

### fullSite.excerpts.ExcerptConversionFailuresDiagnose

```reaction
when refused Converting.convert (part: "excerpt", subject: page, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "excerpt", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: path)
```

### fullSite.excerpts.PageExcerptsConvert

```reaction
when Phasing.advance (name: "site-build", phase: "excerpt", transitioned: true)
where
  Routing._claims () has (owner: page)
  Documenting._document (subject: page) has (body)
  Rendering._latest (subject: page) has (profile: profileName)
  Converting._profile (name: profileName) has (profile)
then
  Converting.convert (part: "excerpt", profile, source: body, subject: page)
```

### fullSite.images.AdmittedRasterImagesRender

```reaction
when Transcoding.admit (original)
where
  Governing._images () has (formats, widths)
then
  Transcoding.render (formats, original, widths)
```

### fullSite.images.CompletedEmbeddingsAnswer

```reaction
when Embedding.offer (embedding, completed: true)
where
  Embedding._embedding (embedding) has (subject: reference)
  Embedding._markup (embedding) has (markup)
then
  Referencing.answer (form: "markup", reference, value: markup)
```

### fullSite.images.DeclaredEmbeddingsAnswer

```reaction
when Embedding.declare (completed: true, embedding)
where
  Embedding._embedding (embedding) has (subject: reference)
  Embedding._markup (embedding) has (markup)
then
  Referencing.answer (form: "markup", reference, value: markup)
```

### fullSite.images.PrimaryRasterImagesAdmit

```reaction
when Referencing.scan (part: "body", source)
where
  view "primary raster body asset reference of source (source)" with (source) has (content, image)
then
  Transcoding.admit (content, subject: image)
```

### fullSite.images.RasterAdmissionsDiagnose

```reaction
when refused Transcoding.admit (subject: image, detail, error)
where
  earlier, Referencing.scan (part: "body", source)
  view "resolved local body reference of source (source)" with (source) has (page, role: "image", target: image)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.images.RasterEmbeddingDeclarationsDiagnose

```reaction
when refused Embedding.declare (subject: reference, detail, error)
where
  Referencing._reference (reference) has (source)
  Referencing._source (source) has (part: "body", subject: rendering)
  Rendering._active (rendering) has (subject: page)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.images.RasterFallbacksDeclare

```reaction
when Emitting.intend (attempt: emissionAttempt, path, producer: page)
where
  earlier, Transcoding.render (original, derived)
  earlier, Referencing.scan (part: "body", subject: rendering, source)
  view "primary raster body asset reference of source (source)" with (source) has (image, name, page, raw, reference, rendering)
  Rendering._active (rendering) has (emissionAttempt)
  Referencing._reference (reference) has (attributes, label)
  Transcoding._original (subject: image) has (original)
  view "beside-page output for page (page) and name (name)" with (name, page) has (path)
  view "address of output path (path)" with (path) has (address)
  view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address) has (target: fallback)
  Transcoding._renditions (original) has (fallback: true, format, height, width)
then
  Embedding.declare (alternative: label, attributes, expects: derived, height, original: fallback, originalFormat: format, subject: reference, width)
```

### fullSite.images.RasterFallbacksStage

```reaction
when Transcoding.render (original)
where
  earlier, Referencing.scan (part: "body", source)
  view "primary raster body asset reference of source (source)" with (source) has (image, name, page, rendering)
  Transcoding._original (subject: image) has (original)
  Rendering._active (rendering) has (emissionAttempt)
  view "beside-page output for page (page) and name (name)" with (name, page) has (path)
  Transcoding._renditions (original) has (content, fallback: true, mediaType)
then
  Emitting.intend (attempt: emissionAttempt, claim: image, content, medium: mediaType, path, producer: page)
```

### fullSite.images.RasterOffersDiagnose

```reaction
when refused Embedding.offer (embedding, detail, error)
where
  Embedding._embedding (embedding) has (subject: reference)
  Referencing._reference (reference) has (source)
  Referencing._source (source) has (part: "body", subject: rendering)
  Rendering._active (rendering) has (subject: page)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.images.RasterRendersDiagnose

```reaction
when refused Transcoding.render (original, detail, error)
where
  earlier, Referencing.scan (part: "body", source)
  view "resolved local body reference of source (source)" with (source) has (page, role: "image", target: image)
  Transcoding._original (subject: image) has (original)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.images.RasterRenditionsOffer

```reaction
when Emitting.intend (path, producer: page)
where
  earlier, Embedding.declare (embedding)
  view "responsive body image embedding (embedding)" with (embedding) has (original, page)
  Transcoding._renditions (original) has (fallback: false, format, name, order, width)
  Governing._paths () has (assets)
  view "path joining prefix (prefix) and name (name)" with (name, prefix: assets) has (path)
  view "address of output path (path)" with (path) has (address)
then
  Embedding.offer (address, embedding, format, order, width)
```

### fullSite.images.RasterRenditionsStage

```reaction
when Embedding.declare (embedding)
where
  view "responsive body image embedding (embedding)" with (embedding) has (original, page, rendering)
  Rendering._active (rendering) has (emissionAttempt)
  Transcoding._renditions (original) has (content, fallback: false, mediaType, name, rendition)
  Governing._paths () has (assets)
  view "path joining prefix (prefix) and name (name)" with (name, prefix: assets) has (path)
then
  Emitting.intend (attempt: emissionAttempt, claim: rendition, content, medium: mediaType, path, producer: page)
```

### fullSite.images.UnretargetableRasterPrimaryImagesDiagnose

```reaction
when Referencing.scan (part: "body", source)
where
  view "primary raster body asset reference of source (source)" with (source) has (name, page, raw)
  view "beside-page output for page (page) and name (name)" with (name, page) has (path: outputPath)
  view "address of output path (path)" with (path: outputPath) has (address)
  no view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address)
  Filing._file (file: page) has (path: sourcePath)
then
  Diagnosing.report (code: "INVALID_LOCAL_REFERENCE", message: "This local reference cannot be safely retargeted.", scope: "page-rendering", severity: "error", source: sourcePath)
```

### fullSite.references.AbsoluteLayoutReferencesRebase

```reaction
when Referencing.scan (part: "layout", source)
where
  Referencing._references (source) has (raw, reference)
  targetHasKind (kind: "absolute", target: raw)
  view "site URL of target (target)" with (target: raw) has (url)
then
  Referencing.answer (form: "address", reference, value: url)
```

### fullSite.references.ClaimedBodyReferencesRetarget

```reaction
when Referencing.scan (part: "body", source)
where
  view "resolved local body reference of source (source)" with (source) has (raw, reference, target)
  Routing._address (owner: target) has (address)
  view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address) has (target: value)
then
  Referencing.answer (form: "address", reference, value)
```

### fullSite.references.CopiedBodyAssetsAnswer

```reaction
when Emitting.intend (path, producer: page)
where
  earlier, Referencing.scan (part: "body", subject: rendering, source)
  view "copyable body asset of source (source)" with (source) has (name, page, raw, reference, rendering)
  view "beside-page output for page (page) and name (name)" with (name, page) has (path)
  view "address of output path (path)" with (path) has (address)
  view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address) has (target: value)
then
  Referencing.answer (form: "address", reference, value)
```

### fullSite.references.CopyableBodyAssetsCopy

```reaction
when Referencing.scan (part: "body", source)
where
  view "copyable body asset of source (source)" with (source) has (asset: target, content, name, page, rendering)
  Rendering._active (rendering) has (emissionAttempt)
  view "beside-page output for page (page) and name (name)" with (name, page) has (path)
then
  Emitting.intend (attempt: emissionAttempt, claim: target, content, medium: "application/octet-stream", path, producer: page)
```

### fullSite.references.InvalidBodyReferencesDiagnose

```reaction
when Referencing.scan (part: "body", source)
where
  view "relative body reference of source (source)" with (source) has (page, raw)
  Filing._resolution (address: raw, file: page) has (status: "invalid")
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "INVALID_LOCAL_REFERENCE", message: "This local reference has an invalid path spelling.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.references.MissingBodyReferencesDiagnose

```reaction
when Referencing.scan (part: "body", source)
where
  view "relative body reference of source (source)" with (source) has (page, raw)
  Filing._resolution (address: raw, file: page) has (status: "missing")
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "MISSING_LOCAL_REFERENCE", message: "This local reference names no staged content file.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.references.NonlocalBodyReferencesHold

```reaction
when Referencing.scan (part: "body", source)
where
  view "held body reference of source (source)" with (source) has (raw, reference)
then
  Referencing.answer (form: "address", reference, value: raw)
```

### fullSite.references.NonlocalLayoutReferencesHold

```reaction
when Referencing.scan (part: "layout", source)
where
  view "held layout reference of source (source)" with (source) has (raw, reference)
then
  Referencing.answer (form: "address", reference, value: raw)
```

### fullSite.references.OutsideBodyReferencesDiagnose

```reaction
when Referencing.scan (part: "body", source)
where
  view "relative body reference of source (source)" with (source) has (page, raw)
  Filing._resolution (address: raw, file: page) has (status: "outside")
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "OUTSIDE_LOCAL_REFERENCE", message: "This local reference leaves the content root.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.references.RelativeLayoutReferencesDiagnose

```reaction
when Referencing.scan (part: "layout", source)
where
  Referencing._source (source) has (subject: rendering)
  Rendering._active (rendering) has (subject: page)
  Referencing._references (source) has (raw)
  targetHasKind (kind: "relative", target: raw)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "RELATIVE_LAYOUT_REFERENCE", message: "A layout reference must be site-absolute, external, or fragment-only.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.references.UnpublishedDocumentBodyReferencesDiagnose

```reaction
when Referencing.scan (part: "body", source)
where
  view "resolved local body reference of source (source)" with (source) has (page, target)
  no Routing._address (owner: target)
  Documenting._document (subject: target)
  Filing._file (file: target) has (root)
  Filing._root (root) has (name: "content")
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "UNPUBLISHED_DOCUMENT_REFERENCE", message: "This local reference targets an unpublished document.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.references.UnretargetableClaimedBodyReferencesDiagnose

```reaction
when Referencing.scan (part: "body", source)
where
  view "resolved local body reference of source (source)" with (source) has (page, raw, target)
  Routing._address (owner: target) has (address)
  no view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "INVALID_LOCAL_REFERENCE", message: "This local reference cannot be safely retargeted.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.references.UnretargetableCopiedBodyAssetsDiagnose

```reaction
when Referencing.scan (part: "body", source)
where
  view "copyable body asset of source (source)" with (source) has (name, page, raw)
  view "beside-page output for page (page) and name (name)" with (name, page) has (path: outputPath)
  view "address of output path (path)" with (path: outputPath) has (address)
  no view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address)
  Filing._file (file: page) has (path: sourcePath)
then
  Diagnosing.report (code: "INVALID_LOCAL_REFERENCE", message: "This local reference cannot be safely retargeted.", scope: "page-rendering", severity: "error", source: sourcePath)
```

### fullSite.render.BodyConversionFailuresDiagnose

```reaction
when refused Converting.convert (part: "body", subject: rendering, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
  Rendering._active (rendering) has (subject: page)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.BodyTemplateFailuresDiagnose

```reaction
when refused Templating.fill (subject: rendering, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
  Rendering._active (rendering) has (subject: page)
  Filing._file (file: page) has (path)
  Templating._failureLocation (fallbackSource: path, subject: rendering) has (column, line, source)
then
  Diagnosing.report (code: error, column, line, message: detail, scope: "page-rendering", severity: "error", source)
```

### fullSite.render.BodyTemplateFailuresFailRendering

```reaction
when refused Templating.fill (subject: rendering, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
  Rendering._active (rendering)
then
  Rendering.fail (reason: error, rendering)
```

### fullSite.render.ClaimedRoutesBeginPageDependencies

```reaction
when Routing.claim (owner: page)
where
  earlier, Phasing.advance (name: "site-build", phase: "route", transitioned: true)
then
  Depending.begin (subject: page)
```

### fullSite.render.CommittedPageOutputsSettleDependencies

```reaction
when Emitting.commit (attempt: emissionAttempt, producer: page)
where
  earlier, Rendering.settleLayout (rendering, subject: page, transitioned: true)
  Rendering._latest (subject: page) has (dependencyAttempt, emissionAttempt, rendering, stage: "completed")
then
  Depending.settle (attempt: dependencyAttempt, subject: page)
```

### fullSite.render.ConvertedBodiesScan

```reaction
when Converting.convert (part: "body", subject: rendering, output)
then
  Referencing.scan (part: "body", subject: rendering, text: output)
```

### fullSite.render.EmptyBodyScansSettleRendering

```reaction
when Referencing.scan (part: "body", subject: rendering, completed: true)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
then
  Rendering.settleBody (rendering)
```

### fullSite.render.EmptyLayoutScansSettleRendering

```reaction
when Referencing.scan (part: "layout", subject: rendering, completed: true)
where
  Rendering._active (rendering)
then
  Rendering.settleLayout (rendering)
```

### fullSite.render.FailedRenderingsAbandonDependencies

```reaction
when Rendering.fail (rendering, subject: page, transitioned: true)
at the flow's settlement frontier
where
  Rendering._latest (subject: page) has (dependencyAttempt, rendering, stage: "failed")
then
  Depending.abandon (attempt: dependencyAttempt, subject: page)
```

### fullSite.render.FailedRenderingsAbortOutput

```reaction
when Rendering.fail (rendering, subject: page, transitioned: true)
at the flow's settlement frontier
where
  Rendering._latest (subject: page) has (emissionAttempt, rendering, stage: "failed")
then
  Emitting.abort (attempt: emissionAttempt, producer: page)
```

### fullSite.render.FilledBodiesConvert

```reaction
when Templating.fill (subject: rendering, output)
where
  Rendering._active (rendering) has (profile: name)
  Converting._profile (name) has (profile)
then
  Converting.convert (part: "body", profile, source: output, subject: rendering)
```

### fullSite.render.FilledBodiesTrackTemplates

```reaction
when Templating.fill (subject: rendering, filling)
where
  Rendering._active (rendering) has (dependencyAttempt, subject: page)
  Templating._tree (owner: filling) has (used)
  Templating._template (name: used) has (template)
then
  Depending.use (attempt: dependencyAttempt, input: template, subject: page)
```

### fullSite.render.FinishedBodyAnswersSettleRendering

```reaction
when Referencing.answer (completed: true, part: "body", subject: rendering)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
then
  Rendering.settleBody (rendering)
```

### fullSite.render.FinishedLayoutAnswersSettleRendering

```reaction
when Referencing.answer (completed: true, part: "layout", subject: rendering)
where
  Rendering._active (rendering)
then
  Rendering.settleLayout (rendering)
```

### fullSite.render.IntendedPageOutputsCommit

```reaction
when Emitting.intend (attempt: emissionAttempt, producer: page)
where
  earlier, Rendering.settleLayout (rendering, subject: page, transitioned: true)
  Rendering._latest (subject: page) has (emissionAttempt, rendering, stage: "completed")
then
  Emitting.commit (attempt: emissionAttempt, producer: page)
```

### fullSite.render.InvalidPageRenderingSelectionsAbandonDependencies

```reaction
when Emitting.begin (producer: page, attempt: emissionAttempt)
where
  earlier, Depending.begin (subject: page, attempt: dependencyAttempt)
  earlier, Phasing.advance (name: "site-build", phase: "route", transitioned: true)
  Filing._file (file: page) has (path)
  Layering._resolved (subject: page) has (values: data)
  view "the invalid rendering selection for path (path) and data (data)" with (data, path)
then
  Depending.abandon (attempt: dependencyAttempt, subject: page)
```

### fullSite.render.InvalidPageRenderingSelectionsAbortOutput

```reaction
when Emitting.begin (producer: page, attempt: emissionAttempt)
where
  earlier, Depending.begin (subject: page)
  earlier, Phasing.advance (name: "site-build", phase: "route", transitioned: true)
  Filing._file (file: page) has (path)
  Layering._resolved (subject: page) has (values: data)
  view "the invalid rendering selection for path (path) and data (data)" with (data, path)
then
  Emitting.abort (attempt: emissionAttempt, producer: page)
```

### fullSite.render.InvalidPageRenderingSelectionsDiagnose

```reaction
when Emitting.begin (producer: page, attempt: emissionAttempt)
where
  earlier, Depending.begin (subject: page)
  earlier, Phasing.advance (name: "site-build", phase: "route", transitioned: true)
  Filing._file (file: page) has (path)
  Layering._resolved (subject: page) has (values: data)
  view "the invalid rendering selection for path (path) and data (data)" with (data, path) has (detail, error)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.LayoutTemplateFailuresDiagnose

```reaction
when refused Templating.render (subject: rendering, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
  Rendering._active (rendering) has (subject: page)
  Filing._file (file: page) has (path)
  Templating._failureLocation (fallbackSource: path, subject: rendering) has (column, line, source)
then
  Diagnosing.report (code: error, column, line, message: detail, scope: "page-rendering", severity: "error", source)
```

### fullSite.render.LayoutTemplateFailuresFailRendering

```reaction
when refused Templating.render (subject: rendering, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
  Rendering._active (rendering)
then
  Rendering.fail (reason: error, rendering)
```

### fullSite.render.MissingRenderingProfilesDiagnose

```reaction
when Templating.fill (subject: rendering)
where
  Rendering._active (rendering) has (profile: name, subject: page)
  no Converting._profile (name)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "PROFILE_NOT_FOUND", message: "The selected body conversion profile is not defined.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.MissingRenderingTemplatesDiagnose

```reaction
when Rendering.settleBody (rendering, subject: page, transitioned: true)
where
  Rendering._active (rendering) has (template: name)
  no Templating._template (name)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "TEMPLATE_NOT_FOUND", message: "The selected page template is not defined.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.PageAssetEmissionFailuresDiagnose

```reaction
when refused Emitting.intend (attempt: emissionAttempt, producer: page, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
  Rendering._latest (subject: page) has (emissionAttempt, rendering: pageRendering)
  Rendering._active (rendering: pageRendering)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.PageDependenciesOpenEmission

```reaction
when Depending.begin (subject: page)
where
  earlier, Phasing.advance (name: "site-build", phase: "route", transitioned: true)
  Filing._file (file: page)
then
  Emitting.begin (producer: page)
```

### fullSite.render.PageEmissionFailuresDiagnose

```reaction
when refused Emitting.intend (attempt: emissionAttempt, producer: page, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
  Rendering._latest (subject: page) has (emissionAttempt, stage: "completed")
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.PageEmissionsBeginRendering

```reaction
when Emitting.begin (producer: page, attempt: emissionAttempt)
where
  earlier, Depending.begin (subject: page, attempt: dependencyAttempt)
  earlier, Phasing.advance (name: "site-build", phase: "route", transitioned: true)
  Depending._attempt (subject: page) has (attempt: dependencyAttempt)
  Filing._file (file: page) has (path)
  Layering._resolved (subject: page) has (values: data)
  pageRenderingSelectionHasValidity (data, path, valid: true)
  profile is pageRenderingProfile (data, path)
  template is pageRenderingTemplate (data, path)
then
  Rendering.begin (dependencyAttempt, emissionAttempt, path, profile, subject: page, template)
```

### fullSite.render.RenderedLayoutsScan

```reaction
when Templating.render (subject: rendering, output)
where
  Rendering._active (rendering)
then
  Referencing.scan (part: "layout", subject: rendering, text: output)
```

### fullSite.render.RenderedLayoutsTrackTemplates

```reaction
when Templating.render (subject: attempt, rendering)
where
  Rendering._active (rendering: attempt) has (dependencyAttempt: attemptDependency, subject: page)
  Templating._tree (owner: rendering) has (used)
  Templating._template (name: used) has (template)
then
  Depending.use (attempt: attemptDependency, input: template, subject: page)
```

### fullSite.render.RenderingAttemptsRetractDiagnostics

```reaction
when Phasing.advance (name: "site-build", phase: "render", transitioned: true)
where
  Routing._claims () has (owner: page)
  Rendering._latest (subject: page) has (stage: "started")
  Filing._file (file: page) has (path)
then
  Diagnosing.retract (scope: "page-rendering", source: path)
```

### fullSite.render.RenderingBeginningsAbandonDependencies

```reaction
when refused Rendering.begin (dependencyAttempt, subject: page, error)
where
  earlier, Depending.begin (subject: page, attempt: dependencyAttempt)
  Depending._attempt (subject: page) has (attempt: dependencyAttempt)
then
  Depending.abandon (attempt: dependencyAttempt, subject: page)
```

### fullSite.render.RenderingBeginningsAbortEmission

```reaction
when refused Rendering.begin (emissionAttempt, subject: page)
where
  earlier, Emitting.begin (producer: page, attempt: emissionAttempt)
  Emitting._open (producer: page) has (attempt: emissionAttempt)
then
  Emitting.abort (attempt: emissionAttempt, producer: page)
```

### fullSite.render.RenderingBeginningsDiagnose

```reaction
when refused Rendering.begin (dependencyAttempt, emissionAttempt, subject: page, detail, error)
where
  Depending._attempt (subject: page) has (attempt: dependencyAttempt)
  Emitting._open (producer: page) has (attempt: emissionAttempt)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.RenderingDiagnosticsFailActiveAttempts

```reaction
when Diagnosing.report (code, scope: "page-rendering", severity: "error", source: path)
where
  Filing._named (name: "content") has (root)
  Filing._under (prefix: "", root) has (file: page, path)
  Rendering._latest (subject: page) has (rendering)
  Rendering._active (rendering)
then
  Rendering.fail (reason: code, rendering)
```

### fullSite.render.RetractedRenderingAttemptsTrackSource

```reaction
when Diagnosing.retract (scope: "page-rendering", source: path)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
  Routing._claims () has (owner: page)
  Rendering._latest (subject: page) has (dependencyAttempt, stage: "started")
  Filing._file (file: page) has (path)
then
  Depending.use (attempt: dependencyAttempt, input: page, subject: page)
```

### fullSite.render.SettledBodiesRenderOriginatedPages

```reaction
when Rendering.settleBody (rendering, subject: page, transitioned: true)
where
  Routing._address (owner: page) has (address)
  view "absolute site URL of address (address)" with (address)
  Rendering._active (rendering) has (template: name)
  Templating._template (name) has (template)
then
  Templating.render (context: former "the originated completed render context of rendering (rendering)" with (rendering), subject: rendering, template, trusted: [["page", "content"], (wildcard: ["collections", "*", "*", "excerpt"])])
```

### fullSite.render.SettledBodiesRenderUnoriginatedPages

```reaction
when Rendering.settleBody (rendering, subject: page, transitioned: true)
where
  Routing._address (owner: page) has (address)
  no view "absolute site URL of address (address)" with (address)
  Rendering._active (rendering) has (template: name)
  Templating._template (name) has (template)
then
  Templating.render (context: former "the unoriginated completed render context of rendering (rendering)" with (rendering), subject: rendering, template, trusted: [["page", "content"], (wildcard: ["collections", "*", "*", "excerpt"])])
```

### fullSite.render.SettledLayoutsStagePageOutput

```reaction
when Rendering.settleLayout (rendering, subject: page, transitioned: true)
where
  Rendering._latest (subject: page) has (emissionAttempt, rendering, stage: "completed")
  Referencing._finished (part: "layout", subject: rendering) has (text)
  Routing._address (owner: page) has (address)
  view "output path of address (address)" with (address) has (path)
then
  Emitting.intend (attempt: emissionAttempt, content: text, medium: "text/html", path, producer: page)
```

### fullSite.render.TrackedRenderingSourcesFillBodies:originated

```reaction
when Depending.use (attempt: dependencyAttempt, input: page, subject: page)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
  Rendering._latest (subject: page) has (dependencyAttempt, rendering, stage: "started")
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
  Documenting._document (subject: page) has (body, bodyLine)
  Routing._address (owner: page) has (address)
  view "absolute site URL of address (address)" with (address)
then
  Templating.fill (context: former "the originated render context of rendering (rendering)" with (rendering), source: body, sourceLine: bodyLine, sourceName: path, subject: rendering, trusted: [(wildcard: ["collections", "*", "*", "excerpt"])])
```

### fullSite.render.TrackedRenderingSourcesFillBodies:unoriginated

```reaction
when Depending.use (attempt: dependencyAttempt, input: page, subject: page)
where
  earlier, Phasing.advance (name: "site-build", phase: "render", transitioned: true)
  Rendering._latest (subject: page) has (dependencyAttempt, rendering, stage: "started")
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
  Documenting._document (subject: page) has (body, bodyLine)
  Routing._address (owner: page) has (address)
  no view "absolute site URL of address (address)" with (address)
then
  Templating.fill (context: former "the unoriginated render context of rendering (rendering)" with (rendering), source: body, sourceLine: bodyLine, sourceName: path, subject: rendering, trusted: [(wildcard: ["collections", "*", "*", "excerpt"])])
```

### fullSite.routes.DerivedRoutesClaim

```reaction
when Phasing.advance (name: "site-build", phase: "route", transitioned: true)
where
  Documenting._all () has (subject: page)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
  Layering._flag (otherwise: true, path: ["build", "publish"], subject: page) has (value: true)
  no Layering._value (path: ["build", "route"], subject: page)
  view "derived address of path (path)" with (path) has (address)
then
  Routing.claim (address, owner: page)
```

### fullSite.routes.ExplicitRoutesClaim

```reaction
when Phasing.advance (name: "site-build", phase: "route", transitioned: true)
where
  Documenting._all () has (subject: page)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (root)
  Layering._flag (otherwise: true, path: ["build", "publish"], subject: page) has (value: true)
  Layering._value (path: ["build", "route"], subject: page) has (value: address)
then
  Routing.claim (address, owner: page)
```

### fullSite.routes.InvalidRouteClaimsDiagnose

```reaction
when refused Routing.claim (owner: page, detail, error: "INVALID_ADDRESS")
where
  earlier, Phasing.advance (name: "site-build", phase: "route", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
then
  Diagnosing.report (code: "INVALID_ADDRESS", message: detail, severity: "error", source: path)
```

### fullSite.routes.RouteCollisionsReport

```reaction
when refused Routing.claim (owner: page, error: "ADDRESS_TAKEN")
where
  earlier, Phasing.advance (name: "site-build", phase: "route", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
then
  Diagnosing.report (code: "ROUTE_COLLISION", message: "Two pages claim one address.", severity: "error", source: path)
```

### fullSite.routes.UnpublishedRoutesRelease

```reaction
when Phasing.advance (name: "site-build", phase: "route", transitioned: true)
where
  Documenting._all () has (subject: page)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (root)
  Layering._flag (otherwise: true, path: ["build", "publish"], subject: page) has (value: false)
  Routing._address (owner: page)
then
  Routing.release (owner: page)
```

### fullSite.serving.CloseSiteServer

```reaction
when RequestBoundary.request (path: "/serve/close", requestId, server)
then
  Serving.close (server)
```

### fullSite.serving.CloseSiteServer#2

```reaction
when Serving.close (server), asked by fullSite.serving.CloseSiteServer
where
  earlier, RequestBoundary.request (path: "/serve/close", requestId, server)
then
  RequestBoundary.respond (requestId)
```

### fullSite.serving.OpenSiteServer

```reaction
when RequestBoundary.request (host, path: "/serve/open", port, requestId)
then
  Serving.open (host, port)
```

### fullSite.serving.OpenSiteServer#2

```reaction
when Serving.open (host, port, result.port: bound, server), asked by fullSite.serving.OpenSiteServer
where
  earlier, RequestBoundary.request (host, path: "/serve/open", port, requestId)
then
  RequestBoundary.respond (host, port: bound, requestId, server)
```

### fullSite.serving.PublishSiteOutput

```reaction
when RequestBoundary.request (directory, path: "/serve/publish", requestId, server)
then
  Serving.publish (directory, server)
```

### fullSite.serving.PublishSiteOutput#2

```reaction
when Serving.publish (directory, server, readers), asked by fullSite.serving.PublishSiteOutput
where
  earlier, RequestBoundary.request (directory, path: "/serve/publish", requestId, server)
then
  RequestBoundary.respond (readers, requestId)
```

### fullSite.settings.AssessedConfigurationProblemsDiagnose

```reaction
when refused Governing.assess (error: "INVALID_CONFIGURATION")
where
  Governing._problems () has (code, column, line, message)
then
  Diagnosing.report (code, column, line, message, scope: "configuration-assessment", severity: "error", source: "site.yaml")
```

### fullSite.settings.ConfigurationAssessmentRetractsDiagnostics

```reaction
when requested Governing.assess ()
then
  Diagnosing.retract (scope: "configuration-assessment", source: "site.yaml")
```

### fullSite.settings.SettingsCollectionDeclarationFailuresDiagnose

```reaction
when refused Cataloging.declare (detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "settings", transitioned: true)
then
  Diagnosing.report (code: error, message: detail, scope: "configuration-settings", severity: "error", source: "site.yaml")
```

### fullSite.settings.SettingsDeclareCatalogs

```reaction
when Cataloging.reset ()
where
  earlier, Phasing.advance (name: "site-build", phase: "settings", transitioned: true)
  Governing._collections () has (condition, direction, match, name, sort)
then
  Cataloging.declare (condition, direction, name, selector: match, sort)
```

### fullSite.settings.SettingsDeclareMarkdownProfile

```reaction
when Diagnosing.retract (scope: "configuration-settings", source: "site.yaml")
where
  earlier, Phasing.advance (name: "site-build", phase: "settings", transitioned: true)
  Governing._markdown () has (extensions, raw, separator)
then
  Converting.declare (extensions, kind: "markdown", name: "markdown", raw, separator)
```

### fullSite.settings.SettingsDeclareVerbatimProfile

```reaction
when Diagnosing.retract (scope: "configuration-settings", source: "site.yaml")
where
  earlier, Phasing.advance (name: "site-build", phase: "settings", transitioned: true)
  Governing._markdown () has (separator)
then
  Converting.declare (extensions: [], kind: "verbatim", name: "verbatim", raw: true, separator)
```

### fullSite.settings.SettingsMarkdownProfileFailuresDiagnose

```reaction
when refused Converting.declare (extensions, kind: "markdown", name: "markdown", raw, separator, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "settings", transitioned: true)
  Governing._markdown () has (extensions, raw, separator)
then
  Diagnosing.report (code: error, message: detail, scope: "configuration-settings", severity: "error", source: "site.yaml")
```

### fullSite.settings.SettingsPhaseRetractsDiagnostics

```reaction
when Phasing.advance (name: "site-build", phase: "settings", transitioned: true)
then
  Diagnosing.retract (scope: "configuration-settings", source: "site.yaml")
```

### fullSite.settings.SettingsResetCatalogs

```reaction
when Diagnosing.retract (scope: "configuration-settings", source: "site.yaml")
where
  earlier, Phasing.advance (name: "site-build", phase: "settings", transitioned: true)
then
  Cataloging.reset ()
```

### fullSite.settings.SettingsVerbatimProfileFailuresDiagnose

```reaction
when refused Converting.declare (extensions: [], kind: "verbatim", name: "verbatim", raw: true, separator, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "settings", transitioned: true)
  Governing._markdown () has (separator)
then
  Diagnosing.report (code: error, message: detail, scope: "configuration-settings", severity: "error", source: "site.yaml")
```

### fullSite.sources.ClearedContentGetsAttributes

```reaction
when Layering.clear (subject)
where
  earlier, Phasing.advance (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file: subject) has (root)
  Documenting._document (subject) has (attributes)
then
  Layering.contribute (rank: 9007199254740991, subject, values: attributes)
```

### fullSite.sources.ClearedContentGetsDefaults

```reaction
when Layering.clear (subject)
where
  earlier, Phasing.advance (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "content") has (root: content)
  Filing._file (file: subject) has (path, root: content)
  Governing._defaults () has (index, text, values)
  patternHasResult (matched: true, path, pattern: text)
then
  Layering.contribute (rank: index, subject, values)
```

### fullSite.sources.ContentDocumentsParse

```reaction
when Phasing.advance (name: "site-build", phase: "read", transitioned: true)
where
  view "content document file" has (file, text)
then
  Documenting.parse (subject: file, text)
```

### fullSite.sources.DocumentParseFailuresDiagnose

```reaction
when refused Documenting.parse (subject: file, detail, error: "MALFORMED_ATTRIBUTES")
where
  earlier, Phasing.advance (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file) has (path, root)
then
  Diagnosing.report (code: "MALFORMED_ATTRIBUTES", message: detail, severity: "error", source: path)
```

### fullSite.sources.IncludeDefinitionFailuresDiagnose

```reaction
when refused Templating.register (name: path, origin: file, source: text, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "templates") has (root)
  Filing._under (prefix: "includes", root) has (file, path: physicalPath)
  view "path (path) relative to prefix (prefix)" with (path: physicalPath, prefix: "includes") has (relative: path)
  Filing._text (file) has (text)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: path)
```

### fullSite.sources.IncludesDefine

```reaction
when Phasing.advance (name: "site-build", phase: "read", transitioned: true)
where
  Filing._named (name: "templates") has (root)
  Filing._under (prefix: "includes", root) has (file, path: physicalPath)
  view "path (path) relative to prefix (prefix)" with (path: physicalPath, prefix: "includes") has (relative: path)
  Filing._text (file) has (text)
then
  Templating.register (name: path, origin: file, source: text)
```

### fullSite.sources.ParsedContentClearsLayers

```reaction
when Documenting.parse (subject)
where
  earlier, Phasing.advance (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file: subject) has (root)
then
  Layering.clear (subject)
```

### fullSite.sources.PublicFilesIntendOutput

```reaction
when Phasing.advance (name: "site-build", phase: "read", transitioned: true)
where
  Filing._named (name: "public") has (root)
  Filing._under (prefix: "", root) has (file, path)
  Filing._file (file) has (content)
then
  Emitting.intend (content, medium: "application/octet-stream", path, producer: file)
```

### fullSite.sources.TemplateDefinitionFailuresDiagnose

```reaction
when refused Templating.register (name: path, origin: file, source: text, detail, error)
where
  earlier, Phasing.advance (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "templates") has (root)
  Filing._under (prefix: "", root) has (file, path)
  Filing._text (file) has (text)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: path)
```

### fullSite.sources.TemplatesDefine

```reaction
when Phasing.advance (name: "site-build", phase: "read", transitioned: true)
where
  Filing._named (name: "templates") has (root)
  Filing._under (prefix: "", root) has (file, path)
  no view "path (path) relative to prefix (prefix)" with (path, prefix: "includes")
  Filing._text (file) has (text)
then
  Templating.register (name: path, origin: file, source: text)
```

### fullSite.staging.AdmittedConfigurationIsLoaded

```reaction
when Locating.admit (name: "settings", path, status: "admitted")
then
  Filing.loadFile (name: "project", path: "site.yaml", source: path)
```

### fullSite.staging.AdmittedSourceRootsAreLoaded

```reaction
when Locating.admit (name: root, path: directory, contained: true, real, resolved: true, status: "admitted")
where
  Governing._sources () has (name: root, path: directory)
then
  Filing.loadTree (directory: real, name: root)
```

### fullSite.staging.BegunSiteBuildDeliveriesRetractStagingDiagnostics

```reaction
when Delivering.begin (task: job)
where
  earlier, Phasing.start (job, name: "site-build", phase: "locate")
then
  Diagnosing.retract (scope: "project-staging", source: "site.yaml")
```

### fullSite.staging.ConfiguredOutputDirectsPublication

```reaction
when Locating.admit (name: "output", path: directory, contained: true, real, resolved: true, status: "admitted")
where
  view "the publication transaction prefix of destination (destination)" with (destination: real) has (prefix)
then
  Emitting.direct (destination: real, prefix)
```

### fullSite.staging.DestinationDirectsPublication

```reaction
when Locating.admit (name: "destination", path: directory, real, status: "admitted")
where
  view "the publication transaction prefix of destination (destination)" with (destination: real) has (prefix)
then
  Emitting.direct (destination: real, prefix)
```

### fullSite.staging.EscapingConfiguredOutputDiagnoses

```reaction
when Locating.admit (name: "output", path: directory, place: admitted, status: "admitted")
where
  no Locating._place (place: admitted) has (contained: true, resolved: true)
then
  Diagnosing.report (code: "OUTPUT_OUTSIDE_SITE", message: "Configured paths.output must stay inside the site directory after resolving symbolic links.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.EscapingContentRootDiagnoses

```reaction
when Locating.admit (name: "content", path: directory, place: admitted, status: "admitted")
where
  no Locating._place (place: admitted) has (contained: true, resolved: true)
then
  Diagnosing.report (code: "SOURCE_OUTSIDE_SITE", message: "Configured paths.content must stay inside the site directory after resolving symbolic links.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.EscapingPublicRootDiagnoses

```reaction
when Locating.admit (name: "public", path: directory, place: admitted, status: "admitted")
where
  no Locating._place (place: admitted) has (contained: true, resolved: true)
then
  Diagnosing.report (code: "SOURCE_OUTSIDE_SITE", message: "Configured paths.public must stay inside the site directory after resolving symbolic links.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.EscapingTemplateRootDiagnoses

```reaction
when Locating.admit (name: "templates", path: directory, place: admitted, status: "admitted")
where
  no Locating._place (place: admitted) has (contained: true, resolved: true)
then
  Diagnosing.report (code: "SOURCE_OUTSIDE_SITE", message: "Configured paths.templates must stay inside the site directory after resolving symbolic links.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.GroundedSiteAdmitsConfiguration

```reaction
when Locating.ground (status: "grounded")
then
  Locating.admit (name: "settings", path: "site.yaml")
```

### fullSite.staging.LoadedConfigurationIsAssessed

```reaction
when Filing.loadFile (name: "project", path: "site.yaml", file, root, status: "loaded")
where
  Filing._named (name: "project") has (root)
  Filing._text (file) has (text)
then
  Governing.assess (source: text)
```

### fullSite.staging.LocateGroundsSiteDirectory

```reaction
when Diagnosing.retract (scope: "project-staging", source: "site.yaml")
where
  earlier, Phasing.start (name: "site-build", phase: "locate")
  Locating._requested (name: "site") has (path)
then
  Locating.ground (path)
```

### fullSite.staging.OutputOverlappingConfigurationDiagnoses

```reaction
when Phasing.advance (name: "site-build", phase: "settings", transitioned: true)
where
  view "the publication place" has (place: publication)
  Locating._named (name: "settings") has (place: settings)
  Locating._overlapping (other: settings, place: publication) has (overlapping: true)
then
  Diagnosing.report (code: "OUTPUT_OVERLAPS_CONFIGURATION", message: "The output directory must not contain the site configuration.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.OutputOverlappingSourceRootDiagnoses

```reaction
when Phasing.advance (name: "site-build", phase: "settings", transitioned: true)
where
  view "the publication place" has (place: publication)
  Governing._sources () has (name: root)
  Locating._named (name: root) has (place: source)
  Locating._overlapping (other: source, place: publication) has (overlapping: true)
then
  Diagnosing.report (code: "OUTPUT_OVERLAPS_SOURCE", message: "The output directory must not overlap a configured source directory.", scope: "project-staging", severity: "error", source: root)
```

### fullSite.staging.StageAdmitsConfiguredOutput

```reaction
when Phasing.advance (name: "site-build", phase: "stage", transitioned: true)
where
  Governing._paths () has (output: directory)
  no Locating._requested (name: "destination")
then
  Locating.admit (name: "output", path: directory)
```

### fullSite.staging.StageAdmitsRequestedDestination

```reaction
when Phasing.advance (name: "site-build", phase: "stage", transitioned: true)
where
  Locating._requested (name: "destination") has (path: directory)
then
  Locating.admit (name: "destination", path: directory)
```

### fullSite.staging.StageAdmitsSourceRoots

```reaction
when Phasing.advance (name: "site-build", phase: "stage", transitioned: true)
where
  Governing._sources () has (name: root, path: directory)
then
  Locating.admit (name: root, path: directory)
```

### fullSite.staging.StartedSiteBuildsBeginAggregateDelivery

```reaction
when Phasing.start (job, name: "site-build", phase: "locate")
then
  Delivering.begin (task: job)
```

### fullSite.staging.UndecodableConfigurationDiagnoses

```reaction
when Filing.loadFile (name: "project", path: "site.yaml", file, root, status: "loaded")
where
  Filing._named (name: "project") has (root)
  no Filing._text (file)
then
  Diagnosing.report (code: "INVALID_TEXT", message: "The site configuration must be UTF-8 text.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.UndirectablePublicationDiagnoses

```reaction
when refused Emitting.direct (destination, detail, error)
then
  Diagnosing.report (code: error, message: detail, scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.UngroundableSiteDirectoryDiagnoses

```reaction
when Locating.ground (path, code, detail, status: "problem")
then
  Diagnosing.report (code, message: detail, scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.UnloadableSourceRootDiagnoses

```reaction
when Filing.loadTree (name: root, code, detail, status: "problem")
then
  Diagnosing.report (code, message: detail, scope: "project-staging", severity: "error", source: root)
```

### fullSite.staging.UnreadableConfigurationDiagnoses

```reaction
when Filing.loadFile (name: "project", path: "site.yaml", code, detail, status: "problem")
then
  Diagnosing.report (code, message: detail, scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.UnresolvableLocationDiagnoses

```reaction
when Locating.admit (name, path, code, detail, status: "problem")
then
  Diagnosing.report (code, message: detail, scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.watching.AttendSiteWatch

```reaction
when RequestBoundary.request (path: "/watch/attend", requestId, watch, within)
then
  Watching.attend (watch, within)
```

### fullSite.watching.AttendSiteWatch#2

```reaction
when Watching.attend (watch, within, changed, watching), asked by fullSite.watching.AttendSiteWatch
where
  earlier, RequestBoundary.request (path: "/watch/attend", requestId, watch, within)
then
  RequestBoundary.respond (changed, requestId, watching)
```

### fullSite.watching.CloseSiteWatch

```reaction
when RequestBoundary.request (path: "/watch/close", requestId, watch)
then
  Watching.close (watch)
```

### fullSite.watching.CloseSiteWatch#2

```reaction
when Watching.close (watch), asked by fullSite.watching.CloseSiteWatch
where
  earlier, RequestBoundary.request (path: "/watch/close", requestId, watch)
then
  RequestBoundary.respond (requestId)
```

### fullSite.watching.OpenSiteWatch

```reaction
when RequestBoundary.request (directory, output, path: "/watch/open", requestId, settling)
where
  isTextValue (value: output)
  view "the publication transaction prefix of destination (destination)" with (destination: output) has (prefix)
then
  Watching.observe (directory, excluded: output, prefix, settling)
```

### fullSite.watching.OpenSiteWatch#2

```reaction
when Watching.observe (directory, excluded: output, prefix, settling, watch), asked by fullSite.watching.OpenSiteWatch
where
  earlier, RequestBoundary.request (directory, output, path: "/watch/open", requestId, settling)
then
  RequestBoundary.respond (requestId, watch)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/cli/exit` — requires `code`
- `/cli/interpret` — requires `arguments`
- `/cli/write` — requires `stream`, `text`
- `/serve/close` — requires `server`
- `/serve/open` — requires `host`, `port`
- `/serve/publish` — requires `directory`, `server`
- `/site/build` — requires `directory`; fills `destination` with null when absent
- `/site/inspect` — requires `directory`, `target`
- `/watch/attend` — requires `watch`, `within`
- `/watch/close` — requires `watch`
- `/watch/open` — requires `directory`, `output`, `settling`
