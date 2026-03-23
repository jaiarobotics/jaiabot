# jaia_state_tool

A compile-time C++ tool based on the [Clang 18 LibTooling API](https://clang.llvm.org/docs/LibTooling.html) that analyzes `boost::statechart` state machines in JaiaBot source code and generates human-readable YAML, Graphviz DOT, and Mermaid statechart diagram files.

## What it does

`jaia_state_tool` parses the C++ AST (Abstract Syntax Tree) of a target application's source files and:

1. **Finds all `boost::statechart::state` and `boost::statechart::state_machine` class template specializations.**
2. **Extracts the state hierarchy** — each state's parent state (or state machine), initial child state (`initial_state`) for composite states.
3. **Detects selection/choice pseudostates** — any state whose unqualified name ends with `"Selection"` (e.g. `MovementSelection`, `TaskSelection`) is classified as `type: choice` in the YAML. DOT renders them as filled black diamonds; Mermaid uses `<<choice>>` notation.
3. **Extracts all reactions** from `using reactions = boost::mpl::list<...>` type aliases, including:
   - `boost::statechart::transition<Event, TargetState>` — a state change triggered by an event
   - `boost::statechart::custom_reaction<Event>` — user-defined reaction handled by `react(const Event&)` — shown in the state box (DOT) or omitted (Mermaid)
   - `boost::statechart::in_state_reaction<Event, State, &State::handler>` — event handled without changing state — shown in the state box (DOT) or omitted (Mermaid)
   - `boost::statechart::deferral<Event>` — event deferred until a state change occurs — shown as a self-loop edge
4. **Writes a YAML file** (`<target>_states.yml`) with the full hierarchical state description.
5. **Writes a Graphviz DOT file** (`<target>_states.dot`) with composite-state clusters, initial-state markers, and styled transition edges. `in_state_reaction` and `custom_reaction` are shown inline in the state label.
6. **Writes a Mermaid statechart file** (`<target>_states.mmd`) with nested state blocks and labeled transitions. `in_state_reaction` and `custom_reaction` are omitted (Mermaid `stateDiagram-v2` does not support inline multi-line state labels).
7. Optionally **renders the DOT to PDF** using `dot` (if graphviz is installed).
8. Optionally **renders the Mermaid diagram to PDF** using `mmdc` (if `@mermaid-js/mermaid-cli` is installed).

## How to build

Enable the `build_state_diagrams` CMake option (default: `OFF`):

```bash
cmake -Dbuild_state_diagrams=ON ..
make
```

The tool itself is built as a regular CMake target (`jaia_state_tool`) under `src/bin/jaia_state_tool/` and is linked against the system's Clang 18 shared library (`clang-cpp`, `LLVM-18`).

**Prerequisites:**

| Package | Purpose |
|---------|---------|
| `libclang-18-dev` | Clang 18 AST/tooling C++ headers and static libs |
| `llvm-18-dev` | LLVM 18 development libraries |
| `graphviz` | `dot` executable for Graphviz PDF rendering (optional) |
| `@mermaid-js/mermaid-cli` | `mmdc` executable for Mermaid PDF rendering (optional) |

On Ubuntu 24.04:
```bash
sudo apt install libclang-18-dev graphviz
npm install -g @mermaid-js/mermaid-cli   # optional, for Mermaid PDF rendering
```

## Output files

After a successful build with `build_state_diagrams=ON`, the generated files are placed in:

```
<build>/share/jaiabot/state_diagrams/
├── jaiabot_mission_manager_states.yml             # YAML hierarchy (shared input for both diagrams)
├── jaiabot_mission_manager_states.dot             # Graphviz DOT source
├── jaiabot_mission_manager_states_graphviz.pdf    # Rendered PDF (if dot found)
├── jaiabot_mission_manager_states.mmd             # Mermaid statechart source
└── jaiabot_mission_manager_states_mermaid.pdf     # Rendered PDF (if mmdc found)
```

Both diagram formats are generated from the same in-memory state data (the same data that produces the YAML), so they are always in sync.  Either format can be removed in the future by disabling the corresponding generator or renderer.

### YAML format

```yaml
target: jaiabot_mission_manager
machine: jaiabot::statechart::MissionManagerStateMachine
initial_state: jaiabot::statechart::PreDeployment
states:
  - name: jaiabot::statechart::MissionManagerStateMachine
    type: machine
    initial_state: jaiabot::statechart::PreDeployment
  - name: jaiabot::statechart::PreDeployment
    type: state
    parent: jaiabot::statechart::MissionManagerStateMachine
    initial_state: jaiabot::statechart::predeployment::StartingUp
    reactions:
      - type: transition
        event: jaiabot::statechart::EvShutdown
        target: jaiabot::statechart::postdeployment::ShuttingDown
  - name: jaiabot::statechart::inmission::underway::movement::MovementSelection
    type: choice
    parent: jaiabot::statechart::inmission::underway::Movement
```

Fields:
- `type`: `machine` | `state` | `choice` — `choice` is used for UML choice pseudostates detected by the `*Selection` naming convention
- `initial_state`: the initial child state for any composite state (both machine and regular composite states use this field)

### DOT / PDF diagram (Graphviz)

The DOT output uses `compound=true` with `subgraph cluster_*` blocks to represent composite states. Edge styles indicate reaction type:

| Style | Reaction type |
|-------|---------------|
| Solid arrow | `transition` |
| Dashed arrow with `[H*]` label | `deep_history_transition` |
| Dotted self-loop | `deferral` |
| Bold arrow | Initial-state marker |
| Filled black diamond | Choice/selection pseudostate (`*Selection` states) |
| State label text | `in_state_reaction` and `custom_reaction` (embedded in the state box, not drawn as edges) |

`in_state_reaction` and `custom_reaction` reactions are shown inline in the state's label in the form `- in_state_reaction: EventName`, since they do not trigger a state change.

### Mermaid statechart diagram

The Mermaid output uses `stateDiagram-v2` syntax with nested `state "Label" as id { ... }` blocks for composite states. Each composite state also gets a `state "{this}" as id_this` pseudo-child — outgoing transitions from the composite state are drawn from `{this}` rather than directly from the composite state border, keeping edge routing cleaner. Transitions are written after the state hierarchy. Deep history transitions are annotated with `[H*]` in the edge label. Choice/selection pseudostates use `state id <<choice>>` notation. `in_state_reaction` and `custom_reaction` are omitted (Mermaid `stateDiagram-v2` does not support inline multi-line state labels). The `.mmd` file can be rendered to PDF using `mmdc` or previewed directly in GitHub, GitLab, or any Mermaid-compatible renderer.

## Adding state diagram generation to a new target

In the target's `CMakeLists.txt`, after `add_executable(...)`:

```cmake
if(build_state_diagrams)
    generate_state_diagram(${APP})
endif()
```

The `generate_state_diagram` macro is provided by `cmake/JaiaStateTool.cmake` (included automatically when `build_state_diagrams=ON`).

## Architecture / code walkthrough

The tool is a single `jaia_state_tool.cpp` file structured as follows:

```
main()
  └─ CommonOptionsParser (command-line: -gen, -target, -outdir, -p, source files)
  └─ ClangTool::run(StateChartAction)
       └─ StateChartConsumer::HandleTranslationUnit()
            └─ StateChartVisitor::VisitCXXRecordDecl()
                 ├─ processState()   → populates g_states map
                 └─ processMachine() → populates g_states map + g_machine_name
  └─ generateYAML()    → writes <target>_states.yml
  └─ generateDOT()     → writes <target>_states.dot
  └─ generateMermaid() → writes <target>_states.mmd
```

Key data structures:

- `ReactionInfo` — holds `type` ("transition" | "custom_reaction" | ...), `event` name, `target` state name
- `StateInfo` — holds `name`, `parent`, `initial_child`, `is_machine`, `is_choice`, `reactions`
- `g_states` — global `map<string, StateInfo>` populated by the visitor (protected by a mutex for future parallel use)

### Reaction extraction

The visitor walks each `CXXRecordDecl` looking for base classes that are specializations of `boost::statechart::state` or `boost::statechart::state_machine`.  For reactions, it locates the `using reactions = ...` typedef/alias inside the class and inspects the `boost::mpl::list<...>` template arguments.  Each argument is matched against known `boost::statechart::*` reaction templates via `TemplateSpecializationType::getTemplateName()`.

### DOT generation

Composite states (states with children) are rendered as `subgraph cluster_*` blocks.  An invisible anchor node inside each cluster is used as the source/target of edges involving the whole cluster (`ltail`/`lhead` with `compound=true`).  The `ltail`/`lhead` attributes are suppressed when the source or destination is a descendant of the referenced cluster, to avoid Graphviz "head/tail is inside cluster" warnings.

### Mermaid generation

`generateMermaid()` follows the same recursive structure as `generateDOT()`: it first writes the state hierarchy with nested `state "Label" as id { ... }` blocks, then writes all transitions outside the hierarchy. Each composite state gets a `{this}` pseudo-child inside the block; the transitions section uses `id_this` as the source node for any reactions declared on the composite state itself.  `in_state_reaction` and `custom_reaction` are omitted from Mermaid output since Mermaid `stateDiagram-v2` does not support inline multi-line state labels.  Both functions share the same `g_states` global, so the two diagram formats are always in sync.

## Modifying the tool

- **Add support for a new reaction type**: add a new `else if` branch in `extractReaction()` matching the new `boost::statechart::*` template name.
- **Change the DOT appearance**: edit `generateDOT()`. The edge-style lookup is in the `if (r.type == ...)` block near the `// ---- Transitions ----` comment. State label construction is in the `writeCluster` lambda.
- **Change the Mermaid appearance**: edit `generateMermaid()`. Transition labels are in the `// ---- Write all transitions ----` block.
- **Change the YAML schema**: edit `generateYAML()`.
- **Remove Graphviz output**: delete the `generateDOT()` call in `main()` and the `if(DOT_EXECUTABLE)` block in `cmake/JaiaStateTool.cmake`.
- **Remove Mermaid output**: delete the `generateMermaid()` call in `main()` and the `if(MMDC_EXECUTABLE)` block in `cmake/JaiaStateTool.cmake`.
