# jaia_state_tool

A compile-time C++ tool based on the [Clang 18 LibTooling API](https://clang.llvm.org/docs/LibTooling.html) that analyzes `boost::statechart` state machines in JaiaBot source code and generates human-readable YAML + Graphviz DOT state diagram files.

## What it does

`jaia_state_tool` parses the C++ AST (Abstract Syntax Tree) of a target application's source files and:

1. **Finds all `boost::statechart::state` and `boost::statechart::state_machine` class template specializations.**
2. **Extracts the state hierarchy** — each state's parent state (or state machine), initial child state for composite states.
3. **Extracts all reactions** from `using reactions = boost::mpl::list<...>` type aliases, including:
   - `boost::statechart::transition<Event, TargetState>` — a state change triggered by an event
   - `boost::statechart::custom_reaction<Event>` — user-defined reaction handled by `react(const Event&)`
   - `boost::statechart::in_state_reaction<Event, State, &State::handler>` — event handled without changing state
   - `boost::statechart::deferral<Event>` — event deferred until a state change occurs
4. **Writes a YAML file** (`<target>_states.yml`) with the full hierarchical state description.
5. **Writes a Graphviz DOT file** (`<target>_states.dot`) with composite-state clusters, initial-state markers, and styled transition edges.
6. Optionally **renders the DOT to SVG** using the `dot` executable (if graphviz is installed).

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
| `graphviz` | `dot` executable for SVG rendering (optional) |

On Ubuntu 24.04:
```bash
sudo apt install libclang-18-dev graphviz
```

## Output files

After a successful build with `build_state_diagrams=ON`, the generated files are placed in:

```
<build>/share/jaiabot/state_diagrams/
├── jaiabot_mission_manager_states.yml   # YAML hierarchy
├── jaiabot_mission_manager_states.dot   # Graphviz DOT source
└── jaiabot_mission_manager_states.svg   # Rendered SVG (if dot found)
```

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
    initial_child: jaiabot::statechart::predeployment::StartingUp
    reactions:
      - type: transition
        event: jaiabot::statechart::EvShutdown
        target: jaiabot::statechart::postdeployment::ShuttingDown
```

### DOT / SVG diagram

The DOT output uses `compound=true` with `subgraph cluster_*` blocks to represent composite states. Edge styles indicate reaction type:

| Style | Reaction type |
|-------|---------------|
| Solid arrow | `transition` |
| Dashed arrow | `in_state_reaction` (self-loop) |
| Dotted arrow | `custom_reaction` (self-loop) |
| Bold arrow | Initial-state marker |

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
  └─ generateYAML()  → writes <target>_states.yml
  └─ generateDOT()   → writes <target>_states.dot
```

Key data structures:

- `ReactionInfo` — holds `type` ("transition" | "custom_reaction" | ...), `event` name, `target` state name
- `StateInfo` — holds `name`, `parent`, `initial_child`, `is_machine`, `reactions`
- `g_states` — global `map<string, StateInfo>` populated by the visitor (protected by a mutex for future parallel use)

### Reaction extraction

The visitor walks each `CXXRecordDecl` looking for base classes that are specializations of `boost::statechart::state` or `boost::statechart::state_machine`.  For reactions, it locates the `using reactions = ...` typedef/alias inside the class and inspects the `boost::mpl::list<...>` template arguments.  Each argument is matched against known `boost::statechart::*` reaction templates via `TemplateSpecializationType::getTemplateName()`.

### DOT generation

Composite states (states with children) are rendered as `subgraph cluster_*` blocks.  An invisible anchor node inside each cluster is used as the source/target of edges involving the whole cluster (`ltail`/`lhead` with `compound=true`).

## Modifying the tool

- **Add support for a new reaction type**: add a new `else if` branch in `extractReaction()` matching the new `boost::statechart::*` template name.
- **Change the DOT appearance**: edit `generateDOT()`. The edge-style lookup is in the `if (r.type == ...)` block near the `// ---- Transitions ----` comment.
- **Change the YAML schema**: edit `generateYAML()`.
