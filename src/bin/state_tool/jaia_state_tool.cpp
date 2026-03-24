// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.

// jaia_state_tool: Clang 18 AST-based tool for analyzing boost::statechart
// state machines and generating YAML/DOT state diagram files.
//
// Usage:
//   jaia_state_tool -gen -target <TARGET> -outdir <DIR> -p <BUILD_DIR>
//   <source_files...> [-- compiler-args]
//
// Outputs:
//   <outdir>/<target>_states.yml  - YAML state hierarchy
//   <outdir>/<target>_states.dot  - Graphviz DOT state diagram

#include <clang/AST/ASTConsumer.h>
#include <clang/AST/RecursiveASTVisitor.h>
#include <clang/Frontend/CompilerInstance.h>
#include <clang/Frontend/FrontendAction.h>
#include <clang/Tooling/CommonOptionsParser.h>
#include <clang/Tooling/Tooling.h>

#include <llvm/Support/CommandLine.h>
#include <llvm/Support/raw_ostream.h>

#include <filesystem>
#include <fstream>
#include <functional>
#include <map>
#include <mutex>
#include <set>
#include <string>
#include <vector>

using namespace clang;
using namespace clang::tooling;
using namespace llvm;

namespace fs = std::filesystem;

// ============================================================
// Command-line options
// ============================================================

static cl::OptionCategory StateToolCategory("jaia_state_tool options");

static cl::opt<bool> GenMode("gen", cl::desc("Generate YAML and DOT state diagram files"),
                             cl::cat(StateToolCategory));

static cl::opt<std::string> TargetName("target", cl::desc("Target application name"),
                                       cl::value_desc("name"), cl::cat(StateToolCategory));

static cl::opt<std::string> OutDir("outdir", cl::desc("Output directory for generated files"),
                                   cl::value_desc("directory"), cl::cat(StateToolCategory));

// ============================================================
// Data structures
// ============================================================

struct ReactionInfo
{
    /// "transition", "custom_reaction", "in_state_reaction", "deferral"
    std::string type;
    std::string event;  ///< event type name
    std::string target; ///< target state (transition only)
};

struct ChoiceTransition
{
    std::string condition; ///< case condition (e.g., fully qualified enum constant)
    std::string target;    ///< transit target state (fully qualified)
};

struct StateInfo
{
    std::string name;          ///< fully qualified C++ name
    std::string parent;        ///< parent state or machine name
    std::string initial_child; ///< initial child state (composite states)
    bool is_machine{false};    ///< true for boost::statechart::state_machine root
    bool is_choice{false}; ///< true for selection/choice pseudostates (names ending in "Selection")
    std::string initial_state; ///< initial state (state_machine only)
    std::vector<ReactionInfo> reactions;
    std::vector<ChoiceTransition> choices; ///< choice transitions (for *Selection states)
};

// ============================================================
// Shared state (written from AST visitors, read when generating output)
// ============================================================

static std::mutex g_mutex;
static std::map<std::string, StateInfo> g_states;
static std::string g_machine_name;

// ============================================================
// Helper utilities
// ============================================================

static std::string cleanTypeName(std::string name)
{
    for (const char* prefix : {"struct ", "class "})
    {
        std::string p(prefix);
        size_t pos;
        while ((pos = name.find(p)) != std::string::npos) name.erase(pos, p.size());
    }
    return name;
}

static std::string getTypeName(QualType qt, const PrintingPolicy& policy)
{
    // For record types (classes/structs), use the qualified name from the declaration
    // to ensure we always get a fully qualified name (e.g., active::Running, not just Running)
    if (const auto* rec = qt->getAs<RecordType>())
        return rec->getDecl()->getQualifiedNameAsString();
    // For elaborated types wrapping a record, unwrap first
    if (const auto* et = qt->getAs<ElaboratedType>())
    {
        if (const auto* rec = et->getNamedType()->getAs<RecordType>())
            return rec->getDecl()->getQualifiedNameAsString();
    }
    return cleanTypeName(qt.getAsString(policy));
}

/// Return the final component of a "::" qualified name.
static std::string shortName(const std::string& name)
{
    auto pos = name.rfind("::");
    return (pos != std::string::npos) ? name.substr(pos + 2) : name;
}

/// Make a valid DOT identifier from a qualified name.
static std::string dotId(const std::string& name)
{
    std::string id = name;
    for (char& c : id)
        if (c == ':' || c == ' ' || c == '<' || c == '>' || c == ',')
            c = '_';
    // Remove double underscores
    while (id.find("__") != std::string::npos)
    {
        size_t pos = id.find("__");
        id.replace(pos, 2, "_");
    }
    return id;
}

/// Make a valid Mermaid state identifier from a qualified name.
/// Mermaid identifiers must be alphanumeric + underscore only.
static std::string mermaidId(const std::string& name)
{
    std::string id = name;
    for (char& c : id)
        if (!std::isalnum(static_cast<unsigned char>(c)))
            c = '_';
    // Remove leading/trailing underscores and collapse runs
    while (id.size() >= 2 && id.find("__") != std::string::npos)
    {
        size_t pos = id.find("__");
        id.replace(pos, 2, "_");
    }
    return id;
}

// ============================================================
// Reaction extraction helpers
// ============================================================

static ReactionInfo extractReaction(const TemplateSpecializationType* tst,
                                    const PrintingPolicy& policy)
{
    ReactionInfo info;
    if (!tst)
        return info;

    const auto* td = tst->getTemplateName().getAsTemplateDecl();
    if (!td)
        return info;

    const std::string tmpl = td->getQualifiedNameAsString();

    if (tmpl == "boost::statechart::transition")
    {
        info.type = "transition";
        auto args = tst->template_arguments();
        if (args.size() >= 1)
            info.event = getTypeName(args[0].getAsType(), policy);
        if (args.size() >= 2)
        {
            QualType target_type = args[1].getAsType();
            // Check whether the target is boost::statechart::deep_history<DefaultState>.
            // deep_history<X> is a pseudo-state meaning "restore deep history of X's parent
            // composite state, defaulting to X".  We treat it as a special transition type
            // so the DOT generator can draw it with an H* annotation.
            const TemplateSpecializationType* target_tst =
                target_type->getAs<TemplateSpecializationType>();
            if (!target_tst)
                if (const auto* et = target_type->getAs<ElaboratedType>())
                    target_tst = et->getNamedType()->getAs<TemplateSpecializationType>();

            bool is_deep_history = false;
            if (target_tst)
            {
                const auto* target_td = target_tst->getTemplateName().getAsTemplateDecl();
                if (target_td &&
                    target_td->getQualifiedNameAsString() == "boost::statechart::deep_history")
                {
                    is_deep_history = true;
                    info.type = "deep_history_transition";
                    auto dh_args = target_tst->template_arguments();
                    if (!dh_args.empty() && dh_args[0].getKind() == TemplateArgument::Type)
                        info.target = getTypeName(dh_args[0].getAsType(), policy);
                }
            }
            if (!is_deep_history)
                info.target = getTypeName(target_type, policy);
        }
    }
    else if (tmpl == "boost::statechart::custom_reaction")
    {
        info.type = "custom_reaction";
        auto args = tst->template_arguments();
        if (args.size() >= 1)
            info.event = getTypeName(args[0].getAsType(), policy);
    }
    else if (tmpl == "boost::statechart::in_state_reaction")
    {
        info.type = "in_state_reaction";
        auto args = tst->template_arguments();
        if (args.size() >= 1)
            info.event = getTypeName(args[0].getAsType(), policy);
    }
    else if (tmpl == "boost::statechart::deferral")
    {
        info.type = "deferral";
        auto args = tst->template_arguments();
        if (args.size() >= 1)
            info.event = getTypeName(args[0].getAsType(), policy);
    }

    return info;
}

/// Extract all reaction types from a boost::mpl::list<...> template specialization.
static void extractReactionsFromMplList(const TemplateSpecializationType* list_tst,
                                        std::vector<ReactionInfo>& reactions,
                                        const PrintingPolicy& policy)
{
    if (!list_tst)
        return;

    for (const TemplateArgument& arg : list_tst->template_arguments())
    {
        if (arg.getKind() != TemplateArgument::Type)
            continue;

        QualType argType = arg.getAsType();

        // Skip boost::mpl::na / mpl_::na placeholders
        if (const auto* rec = argType->getAs<RecordType>())
        {
            const std::string rec_name = rec->getDecl()->getQualifiedNameAsString();
            if (rec_name == "boost::mpl::na" || rec_name == "mpl_::na")
                continue;
        }

        // Unwrap elaborated type if needed
        const TemplateSpecializationType* tst = argType->getAs<TemplateSpecializationType>();
        if (!tst)
            if (const auto* et = argType->getAs<ElaboratedType>())
                tst = et->getNamedType()->getAs<TemplateSpecializationType>();

        if (tst)
        {
            ReactionInfo r = extractReaction(tst, policy);
            if (!r.type.empty())
                reactions.push_back(r);
        }
    }
}

// ============================================================
// Choice transition extraction helpers (for *Selection states)
// ============================================================

/// Recursively search a statement tree for a call to transit<T>()
/// and return the fully qualified target type name.
static std::string findTransitTarget(const Stmt* stmt, const PrintingPolicy& policy)
{
    if (!stmt)
        return "";

    if (const auto* call = dyn_cast<CXXMemberCallExpr>(stmt))
    {
        const CXXMethodDecl* callee = call->getMethodDecl();
        if (callee && callee->getNameAsString() == "transit")
        {
            const TemplateArgumentList* targs = callee->getTemplateSpecializationArgs();
            if (targs && targs->size() >= 1 && (*targs)[0].getKind() == TemplateArgument::Type)
            {
                return getTypeName((*targs)[0].getAsType(), policy);
            }
        }
    }

    for (const auto* child : stmt->children())
    {
        if (!child)
            continue;
        std::string result = findTransitTarget(child, policy);
        if (!result.empty())
            return result;
    }

    return "";
}

/// Extract the string representation of a case expression
/// (typically a fully qualified enum constant name).
static std::string extractCaseCondition(const Expr* expr)
{
    if (!expr)
        return "";
    expr = expr->IgnoreParenImpCasts();

    if (const auto* dre = dyn_cast<DeclRefExpr>(expr))
        return dre->getDecl()->getQualifiedNameAsString();

    return "";
}

// ============================================================
// Clang AST visitor
// ============================================================

class StateChartVisitor : public RecursiveASTVisitor<StateChartVisitor>
{
  public:
    explicit StateChartVisitor(ASTContext& ctx) : ctx_(ctx), policy_(ctx.getLangOpts())
    {
        policy_.SuppressTagKeyword = true;
        policy_.SuppressScope = false;
        policy_.FullyQualifiedName = true; // ensure fully qualified names in output
    }

    /// Visit implicit template instantiations so we can detect states that use
    /// intermediate template base classes (e.g., struct Foo : MyBase<Foo, Parent>
    /// where MyBase<Derived, P> : boost::statechart::state<Derived, P>).
    bool shouldVisitTemplateInstantiations() const { return true; }

    bool VisitCXXRecordDecl(CXXRecordDecl* decl)
    {
        if (!decl->hasDefinition() || decl != decl->getDefinition())
            return true;
        if (!decl->getIdentifier())
            return true;

        for (const auto& base : decl->bases())
        {
            const ClassTemplateSpecializationDecl* spec = nullptr;
            if (const auto* rt = base.getType()->getAs<RecordType>())
                spec = dyn_cast<ClassTemplateSpecializationDecl>(rt->getDecl());
            if (!spec)
                continue;

            const auto* tmpl = spec->getSpecializedTemplate();
            if (!tmpl)
                continue;

            const std::string base_name = tmpl->getQualifiedNameAsString();
            if (base_name == "boost::statechart::state")
                processState(decl, spec);
            else if (base_name == "boost::statechart::state_machine")
                processMachine(decl, spec);
        }
        return true;
    }

  private:
    void processState(CXXRecordDecl* decl, const ClassTemplateSpecializationDecl* spec)
    {
        StateInfo info;
        info.is_machine = false;

        const auto& args = spec->getTemplateArgs();
        // Template arguments for boost::statechart::state<Self, Parent, [InitChild],
        // [HistoryMode]>:
        //   args[0] = Self
        //   args[1] = Parent state or machine
        //   args[2] = Initial child state (optional)
        //   args[3] = History mode (optional, ignore for our purposes)
        //
        // Use args[0] (Self) as the canonical state name rather than decl's name.
        // This correctly handles indirect inheritance via template intermediaries, e.g.:
        //   template<typename Derived, typename Parent>
        //   struct SurfaceDriftTaskCommon : boost::statechart::state<Derived, Parent> {...};
        //   struct SurfaceDrift : SurfaceDriftTaskCommon<SurfaceDrift, Task, ...> {};
        // When the AST visits the instantiation SurfaceDriftTaskCommon<SurfaceDrift, Task,...>,
        // decl->getQualifiedNameAsString() gives "SurfaceDriftTaskCommon" but args[0] correctly
        // identifies "SurfaceDrift" as the actual state.
        if (args.size() >= 1 && args[0].getKind() == TemplateArgument::Type &&
            !args[0].getAsType()->isDependentType())
            info.name = getTypeName(args[0].getAsType(), policy_);
        else
            info.name = decl->getQualifiedNameAsString();

        if (args.size() >= 2 && args[1].getKind() == TemplateArgument::Type)
            info.parent = getTypeName(args[1].getAsType(), policy_);

        if (args.size() >= 3 && args[2].getKind() == TemplateArgument::Type)
        {
            const std::string child = getTypeName(args[2].getAsType(), policy_);
            // Filter out boost::mpl placeholders and boost::statechart history-mode types
            // (e.g. boost::statechart::has_deep_history).  Do NOT filter out application
            // state names that happen to live in a "statechart" namespace (e.g.
            // jaiabot::statechart::*) — that was the original bug.
            if (child.find("mpl_::") == std::string::npos &&
                child.find("boost::mpl::") == std::string::npos &&
                child.find("boost::statechart::") == std::string::npos)
            {
                info.initial_child = child;
            }
        }

        // Detect selection/choice pseudostates by naming convention: any state whose
        // unqualified name ends with "Selection" is treated as a UML choice pseudostate.
        const std::string sn = shortName(info.name);
        if (sn.size() >= 9 && sn.compare(sn.size() - 9, 9, "Selection") == 0)
            info.is_choice = true;

        extractReactionsFromDecl(decl, info.reactions);

        if (info.is_choice)
            extractChoicesFromDecl(decl, info.choices);

        std::lock_guard<std::mutex> lock(g_mutex);
        // Always store the entry, overwriting any stub that was registered earlier via
        // the initial_child fallback path (a stub has an empty reactions list and may
        // have been added before the real definition was visited).
        auto it = g_states.find(info.name);
        if (it == g_states.end() || it->second.reactions.empty())
            g_states[info.name] = info;
    }

    void processMachine(CXXRecordDecl* decl, const ClassTemplateSpecializationDecl* spec)
    {
        StateInfo info;
        info.name = decl->getQualifiedNameAsString();
        info.is_machine = true;

        const auto& args = spec->getTemplateArgs();
        // boost::statechart::state_machine<Self, InitialState, ...>
        //   args[0] = Self  (skip)
        //   args[1] = Initial state
        if (args.size() >= 2 && args[1].getKind() == TemplateArgument::Type)
            info.initial_state = getTypeName(args[1].getAsType(), policy_);

        std::lock_guard<std::mutex> lock(g_mutex);
        if (!g_states.count(info.name))
        {
            g_states[info.name] = info;
            g_machine_name = info.name;
        }
    }

    void extractReactionsFromDecl(CXXRecordDecl* decl, std::vector<ReactionInfo>& reactions)
    {
        for (const auto* d : decl->decls())
        {
            // Handle both "typedef ... reactions" and "using reactions = ..."
            const TypedefNameDecl* alias = dyn_cast<TypedefNameDecl>(d);
            if (!alias || alias->getName() != "reactions")
                continue;

            QualType underlying = alias->getUnderlyingType();

            // Try to get the TemplateSpecializationType for the reaction type
            const TemplateSpecializationType* tst = underlying->getAs<TemplateSpecializationType>();
            if (!tst)
                if (const auto* et = underlying->getAs<ElaboratedType>())
                    tst = et->getNamedType()->getAs<TemplateSpecializationType>();
            if (!tst)
                continue;

            const auto* td = tst->getTemplateName().getAsTemplateDecl();
            if (!td)
                continue;

            const std::string tmpl_name = td->getQualifiedNameAsString();
            if (tmpl_name.rfind("boost::mpl::list", 0) == 0)
            {
                // boost::mpl::list<...> — extract each element in the list
                extractReactionsFromMplList(tst, reactions, policy_);
            }
            else
            {
                // Single reaction type (e.g. boost::statechart::custom_reaction<E>) —
                // not wrapped in mpl::list; extract it directly.
                ReactionInfo r = extractReaction(tst, policy_);
                if (!r.type.empty())
                    reactions.push_back(r);
            }
        }
    }

    /// Walk the react() method's switch statement in a *Selection state to extract
    /// case-condition → transit<Target>() pairs.
    void extractChoicesFromDecl(CXXRecordDecl* decl, std::vector<ChoiceTransition>& choices)
    {
        for (const auto* method : decl->methods())
        {
            if (method->getNameAsString() != "react")
                continue;
            if (!method->hasBody())
                continue;

            const Stmt* body = method->getBody();

            // Find the first SwitchStmt in the function body
            std::function<const SwitchStmt*(const Stmt*)> findSwitch;
            findSwitch = [&](const Stmt* s) -> const SwitchStmt*
            {
                if (!s)
                    return nullptr;
                if (const auto* sw = dyn_cast<SwitchStmt>(s))
                    return sw;
                for (const auto* child : s->children())
                {
                    if (const auto* found = findSwitch(child))
                        return found;
                }
                return nullptr;
            };

            const auto* sw = findSwitch(body);
            if (!sw)
                continue;

            // Walk through the switch cases
            const SwitchCase* sc = sw->getSwitchCaseList();
            while (sc)
            {
                if (const auto* cs = dyn_cast<CaseStmt>(sc))
                {
                    std::string condition = extractCaseCondition(cs->getLHS());
                    std::string target = findTransitTarget(cs->getSubStmt(), policy_);

                    if (!condition.empty() && !target.empty())
                        choices.push_back({condition, target});
                }
                sc = sc->getNextSwitchCase();
            }
        }
    }

    ASTContext& ctx_;
    PrintingPolicy policy_;
};

// ============================================================
// Clang frontend wiring
// ============================================================

class StateChartConsumer : public ASTConsumer
{
  public:
    explicit StateChartConsumer(ASTContext& ctx) : visitor_(ctx) {}
    void HandleTranslationUnit(ASTContext& ctx) override
    {
        visitor_.TraverseDecl(ctx.getTranslationUnitDecl());
    }

  private:
    StateChartVisitor visitor_;
};

class StateChartAction : public ASTFrontendAction
{
  public:
    std::unique_ptr<ASTConsumer> CreateASTConsumer(CompilerInstance& ci,
                                                   StringRef /*file*/) override
    {
        return std::make_unique<StateChartConsumer>(ci.getASTContext());
    }
};

// ============================================================
// YAML output
// ============================================================

static void generateYAML(const std::string& filename)
{
    std::ofstream out(filename);
    if (!out)
    {
        errs() << "Error: cannot open " << filename << " for writing\n";
        return;
    }

    out << "target: " << TargetName.getValue() << "\n";
    out << "machine: " << g_machine_name << "\n";

    if (g_states.count(g_machine_name))
        out << "initial_state: " << g_states.at(g_machine_name).initial_state << "\n";

    out << "states:\n";

    auto writeReactions = [&](const std::vector<ReactionInfo>& reactions)
    {
        if (reactions.empty())
            return;
        out << "    reactions:\n";
        for (const auto& r : reactions)
        {
            out << "      - type: " << r.type << "\n";
            if (!r.event.empty())
                out << "        event: " << r.event << "\n";
            if (!r.target.empty())
                out << "        target: " << r.target << "\n";
        }
    };

    // Machine entry first
    if (g_states.count(g_machine_name))
    {
        const auto& info = g_states.at(g_machine_name);
        out << "  - name: " << info.name << "\n";
        out << "    type: machine\n";
        if (!info.initial_state.empty())
            out << "    initial_state: " << info.initial_state << "\n";
    }

    // Then all states
    for (const auto& [name, info] : g_states)
    {
        if (info.is_machine)
            continue;
        out << "  - name: " << info.name << "\n";
        out << "    type: " << (info.is_choice ? "choice" : "state") << "\n";
        if (!info.parent.empty())
            out << "    parent: " << info.parent << "\n";
        if (!info.initial_child.empty())
            out << "    initial_state: " << info.initial_child << "\n";
        writeReactions(info.reactions);
        if (!info.choices.empty())
        {
            out << "    choices:\n";
            for (const auto& c : info.choices)
            {
                out << "      - condition: " << c.condition << "\n";
                out << "        target: " << c.target << "\n";
            }
        }
    }

    outs() << "Wrote YAML: " << filename << "\n";
}

// ============================================================
// DOT output  (hierarchical using graphviz clusters)
// ============================================================

static void generateDOT(const std::string& filename)
{
    std::ofstream out(filename);
    if (!out)
    {
        errs() << "Error: cannot open " << filename << " for writing\n";
        return;
    }

    // Build parent -> children map
    std::map<std::string, std::vector<std::string>> children;
    for (const auto& [name, info] : g_states)
        if (!info.parent.empty())
            children[info.parent].push_back(name);

    auto isComposite = [&](const std::string& name)
    { return children.count(name) && !children.at(name).empty(); };

    // Map: state name -> DOT node/cluster anchor id
    std::map<std::string, std::string> anchor;  // id to use in edges
    std::map<std::string, std::string> cluster; // cluster id for lhead/ltail

    // Assign ids
    for (const auto& [name, info] : g_states)
    {
        std::string id = dotId(name);
        if (isComposite(name) || info.is_machine)
        {
            anchor[name] = id + "_anchor";
            cluster[name] = "cluster_" + id;
        }
        else
        {
            anchor[name] = id;
        }
    }

    out << "digraph \"" << TargetName.getValue() << "_state_machine\" {\n";
    out << "    rankdir=TB;\n";
    out << "    compound=true;\n";
    out << "    splines=ortho;\n";
    out << "    node [fontname=\"Helvetica\", fontsize=10];\n";
    out << "    edge [fontname=\"Helvetica\", fontsize=8];\n\n";

    // ---- Recursive cluster writer ----
    std::function<void(const std::string&, int)> writeCluster;
    writeCluster = [&](const std::string& name, int indent)
    {
        const auto& info = g_states.at(name);
        std::string pad(indent * 4, ' ');
        std::string id = dotId(name);

        if (isComposite(name) || info.is_machine)
        {
            // Build label: short name + any in_state_reaction/custom_reaction annotations
            std::string cluster_label = shortName(name);
            for (const auto& r : info.reactions)
                if ((r.type == "in_state_reaction" || r.type == "custom_reaction") &&
                    !r.event.empty())
                    cluster_label += "\\n- " + r.type + ": " + shortName(r.event);

            out << pad << "subgraph " << cluster[name] << " {\n";
            out << pad << "    label=\"" << cluster_label << "\";\n";
            if (info.is_machine)
            {
                out << pad << "    style=bold;\n";
                out << pad << "    color=navy;\n";
                out << pad << "    bgcolor=\"#e8e8f0\";\n";
            }
            else
            {
                out << pad << "    style=rounded;\n";
                out << pad << "    color=steelblue;\n";
            }
            // Anchor node (invisible) for edges that reference this cluster
            out << pad << "    " << anchor[name] << " [shape=point, style=invis, width=0.01];\n";

            // Initial-state entry circle: declared INSIDE the cluster so graphviz
            // places the solid dot within the composite-state boundary.
            std::string init_target_name;
            if (info.is_machine)
                init_target_name = info.initial_state;
            else if (!info.initial_child.empty())
                init_target_name = info.initial_child;
            if (!init_target_name.empty() && g_states.count(init_target_name))
            {
                std::string init_id = "init_" + dotId(name);
                out << pad << "    " << init_id
                    << " [shape=point, style=filled, fillcolor=black,"
                       " color=black, width=0.2];\n";
            }

            if (children.count(name))
                for (const auto& child : children.at(name)) writeCluster(child, indent + 1);

            out << pad << "}\n";
        }
        else
        {
            // Leaf state: build label with in_state_reaction/custom_reaction annotations
            std::string node_label = shortName(name);
            for (const auto& r : info.reactions)
                if ((r.type == "in_state_reaction" || r.type == "custom_reaction") &&
                    !r.event.empty())
                    node_label += "\\n- " + r.type + ": " + shortName(r.event);
            out << pad << id << " [label=\"" << node_label
                << "\", shape=box, style=\"rounded,filled\", fillcolor=lightyellow];\n";
        }
    };

    if (!g_machine_name.empty() && g_states.count(g_machine_name))
        writeCluster(g_machine_name, 1);

    out << "\n    // ---- Initial-state markers ----\n";

    // Helper to emit the initial-state edge.  The node itself is declared inside the
    // cluster by writeCluster() above so graphviz places the solid dot correctly.
    auto writeInitArrow = [&](const std::string& container, const std::string& init_target,
                              const std::string& init_node_id)
    {
        if (!g_states.count(init_target))
            return;
        std::string dst = anchor[init_target];
        out << "    " << init_node_id << " -> " << dst << " [style=bold, arrowhead=vee";
        if (isComposite(init_target))
            out << ", lhead=" << cluster[init_target];
        out << "];\n";
    };

    for (const auto& [name, info] : g_states)
    {
        std::string init;
        if (info.is_machine)
            init = info.initial_state;
        else if (!info.initial_child.empty())
            init = info.initial_child;

        if (!init.empty())
        {
            std::string init_id = "init_" + dotId(name);
            writeInitArrow(name, init, init_id);
        }
    }

    // Returns true if 'state' is a proper descendant of 'ancestor' in the hierarchy.
    // Used to suppress lhead/ltail when they would cause graphviz "head/tail inside
    // cluster" warnings.
    auto isDescendant = [&](const std::string& state, const std::string& ancestor) -> bool
    {
        if (!g_states.count(state))
            return false;
        std::string cur = g_states.at(state).parent;
        while (!cur.empty() && g_states.count(cur))
        {
            if (cur == ancestor)
                return true;
            cur = g_states.at(cur).parent;
        }
        return false;
    };

    out << "\n    // ---- Transitions ----\n";

    for (const auto& [name, info] : g_states)
    {
        for (const auto& r : info.reactions)
        {
            std::string src = anchor[name];
            std::string dst;
            bool has_target = false;

            if (r.type == "transition" && !r.target.empty())
            {
                has_target = g_states.count(r.target) > 0;
                if (has_target)
                    dst = anchor[r.target];
                else
                {
                    // External target: add a placeholder node
                    std::string ext_id = "ext_" + dotId(r.target);
                    out << "    " << ext_id << " [label=\"" << shortName(r.target)
                        << "\", shape=box, style=dashed, color=gray];\n";
                    dst = ext_id;
                }

                out << "    " << src << " -> " << dst << " [xlabel=\"" << shortName(r.event)
                    << "\", color=black, style=solid";
                // Suppress ltail when destination is inside the source cluster (graphviz
                // warns: "head is inside tail cluster").
                if (cluster.count(name) && !isDescendant(r.target, name))
                    out << ", ltail=" << cluster[name];
                // Suppress lhead when source is inside the destination cluster (graphviz
                // warns: "tail is inside head cluster").
                if (has_target && cluster.count(r.target) && !isDescendant(name, r.target))
                    out << ", lhead=" << cluster[r.target];
                out << "];\n";
            }
            else if (r.type == "deep_history_transition" && !r.target.empty())
            {
                // boost::statechart::deep_history<DefaultState> means: restore the deep
                // history of the target composite state (defaulting to DefaultState).
                // UML notation: edge with "[H*]" label pointing to the history container.
                // We find the parent composite state of DefaultState and point to that
                // cluster; if not found we fall back to the default state node itself.
                std::string history_container;
                if (g_states.count(r.target))
                {
                    // Point to the parent of the default state (the composite that has history)
                    const std::string& parent = g_states.at(r.target).parent;
                    if (!parent.empty() && g_states.count(parent))
                        history_container = parent;
                    else
                        history_container = r.target;
                }
                has_target = !history_container.empty();
                if (has_target)
                    dst = anchor[history_container];
                else
                {
                    std::string ext_id = "ext_" + dotId(r.target);
                    out << "    " << ext_id << " [label=\"[H*] " << shortName(r.target)
                        << "\", shape=box, style=dashed, color=gray];\n";
                    dst = ext_id;
                }

                out << "    " << src << " -> " << dst << " [xlabel=\"" << shortName(r.event)
                    << " [H*]\", color=black, style=dashed";
                if (cluster.count(name) && !isDescendant(history_container, name))
                    out << ", ltail=" << cluster[name];
                if (has_target && cluster.count(history_container) &&
                    !isDescendant(name, history_container))
                    out << ", lhead=" << cluster[history_container];
                out << "];\n";
            }
            else if (r.type == "deferral" && !r.event.empty())
            {
                // Deferral: show as a self-loop on the state
                out << "    " << src << " -> " << src << " [xlabel=\"" << shortName(r.event)
                    << " [deferral]\", color=gray30, style=dotted";
                if (cluster.count(name))
                    out << ", ltail=" << cluster[name] << ", lhead=" << cluster[name];
                out << "];\n";
            }
            // in_state_reaction and custom_reaction are embedded in the state label, not drawn
        }
    }

    out << "\n    // ---- Choice transitions ----\n";

    for (const auto& [name, info] : g_states)
    {
        for (const auto& c : info.choices)
        {
            std::string src = anchor[name];
            if (g_states.count(c.target))
            {
                std::string dst = anchor[c.target];
                out << "    " << src << " -> " << dst << " [xlabel=\"" << shortName(c.condition)
                    << "\", color=darkgreen, style=solid";
                if (cluster.count(name) && !isDescendant(c.target, name))
                    out << ", ltail=" << cluster[name];
                if (cluster.count(c.target) && !isDescendant(name, c.target))
                    out << ", lhead=" << cluster[c.target];
                out << "];\n";
            }
        }
    }

    out << "}\n";
    outs() << "Wrote DOT:  " << filename << "\n";
}

// ============================================================
// Mermaid statechart output
// ============================================================

static void generateMermaid(const std::string& filename)
{
    std::ofstream out(filename);
    if (!out)
    {
        errs() << "Error: cannot open " << filename << " for writing\n";
        return;
    }

    // Build parent -> children map
    std::map<std::string, std::vector<std::string>> children;
    for (const auto& [name, info] : g_states)
        if (!info.parent.empty())
            children[info.parent].push_back(name);

    auto isComposite = [&](const std::string& name)
    { return children.count(name) && !children.at(name).empty(); };

    out << "stateDiagram-v2\n";
    out << "    direction LR\n";

    // ---- Recursive state hierarchy writer ----
    // Composite states: state "ShortName" as id { state "id {this}" as id_this ... }
    // Leaf states:      state "ShortName" as id
    std::function<void(const std::string&, int)> writeStateBlock;
    writeStateBlock = [&](const std::string& name, int indent)
    {
        const auto& info = g_states.at(name);
        std::string pad(indent * 4, ' ');
        std::string id = mermaidId(name);

        if (info.is_machine)
        {
            // State machine root: emit initial arrow then recurse into direct children
            if (!info.initial_state.empty() && g_states.count(info.initial_state))
                out << pad << "[*] --> " << mermaidId(info.initial_state) << "\n";
            if (children.count(name))
                for (const auto& child : children.at(name)) writeStateBlock(child, indent);
        }
        else if (isComposite(name))
        {
            out << pad << "state \"" << shortName(name) << "\" as " << id << " {\n";
            // {this} pseudo-child: used as the source of outgoing transitions from this
            // composite state so that arrows are drawn from inside the box (visually cleaner)
            out << pad << "    state \"" << shortName(name) << "\{this}\" as " << id << "_this\n";
            if (!info.initial_child.empty() && g_states.count(info.initial_child))
                out << pad << "    [*] --> " << mermaidId(info.initial_child) << "\n";
            for (const auto& child : children.at(name)) writeStateBlock(child, indent + 1);
            out << pad << "}\n";
        }
        else
        {
            out << pad << "state \"" << shortName(name) << "\" as " << id << "\n";
        }
    };

    if (!g_machine_name.empty() && g_states.count(g_machine_name))
        writeStateBlock(g_machine_name, 1);

    // ---- Write all transitions ----
    out << "\n";

    // Returns true if 'state' is a descendant of 'ancestor' in the hierarchy.
    // Used to implement the {this} rule:
    //   - Use composite_this as SOURCE (tail) only when transitioning from a composite
    //     state TO one of its own descendants (parent → child).
    //   - Use composite_this as DESTINATION (head) only when transitioning from a
    //     descendant TO its containing composite ancestor (child → parent).
    //   - Sibling-to-sibling or unrelated transitions use plain IDs.
    auto isDescendantMmd = [&](const std::string& state, const std::string& ancestor) -> bool
    {
        if (!g_states.count(state))
            return false;
        std::string cur = g_states.at(state).parent;
        while (!cur.empty() && g_states.count(cur))
        {
            if (cur == ancestor)
                return true;
            cur = g_states.at(cur).parent;
        }
        return false;
    };

    for (const auto& [name, info] : g_states)
    {
        if (info.is_machine)
            continue;
        bool src_is_composite = isComposite(name);

        for (const auto& r : info.reactions)
        {
            std::string effective_target;
            if (r.type == "transition" && !r.target.empty())
                effective_target = r.target;
            else if (r.type == "deep_history_transition" && !r.target.empty())
            {
                if (g_states.count(r.target))
                {
                    const std::string& par = g_states.at(r.target).parent;
                    effective_target = (!par.empty() && g_states.count(par)) ? par : r.target;
                }
                else
                {
                    effective_target = r.target;
                }
            }

            // Determine source: use {this} only when source is composite AND the
            // target is a descendant of the source (parent → child transition).
            std::string src;
            if (src_is_composite && !effective_target.empty() &&
                isDescendantMmd(effective_target, name))
                src = mermaidId(name) + "_this";
            else
                src = mermaidId(name);

            if (r.type == "transition" && !r.target.empty())
            {
                // Determine destination: use {this} only when target is composite AND
                // the source is a descendant of the target (child → parent transition).
                std::string dst;
                if (isComposite(r.target) && isDescendantMmd(name, r.target))
                    dst = mermaidId(r.target) + "_this";
                else
                    dst = mermaidId(r.target);
                out << "    " << src << " --> " << dst << " : " << shortName(r.event) << "\n";
            }
            else if (r.type == "deep_history_transition" && !r.target.empty())
            {
                // Determine destination with same {this} rule for the history container
                std::string dst;
                if (isComposite(effective_target) && isDescendantMmd(name, effective_target))
                    dst = mermaidId(effective_target) + "_this";
                else
                    dst = mermaidId(effective_target);
                out << "    " << src << " --> " << dst << " : " << shortName(r.event) << " [H*]\n";
            }
            else if (r.type == "deferral" && !r.event.empty())
            {
                // Deferral: self-loop with annotation
                std::string self = src_is_composite ? mermaidId(name) + "_this" : mermaidId(name);
                out << "    " << self << " --> " << self << " : " << shortName(r.event)
                    << " [deferral]\n";
            }
            // in_state_reaction and custom_reaction are omitted from Mermaid output
            // (Mermaid stateDiagram-v2 does not support inline multi-line state labels)
        }
    }

    // ---- Write choice transitions ----
    for (const auto& [name, info] : g_states)
    {
        for (const auto& c : info.choices)
        {
            std::string src = mermaidId(name);
            std::string dst;
            if (g_states.count(c.target))
            {
                bool dst_is_composite = isComposite(c.target);
                if (dst_is_composite && isDescendantMmd(name, c.target))
                    dst = mermaidId(c.target) + "_this";
                else
                    dst = mermaidId(c.target);
            }
            else
            {
                dst = mermaidId(c.target);
            }
            out << "    " << src << " --> " << dst << " : " << shortName(c.condition) << "\n";
        }
    }

    outs() << "Wrote Mermaid: " << filename << "\n";
}
// ============================================================
// main
// ============================================================

int main(int argc, const char** argv)
{
    auto ExpectedParser = CommonOptionsParser::create(argc, argv, StateToolCategory);
    if (!ExpectedParser)
    {
        errs() << ExpectedParser.takeError();
        return 1;
    }
    CommonOptionsParser& op = ExpectedParser.get();

    if (!GenMode)
    {
        errs() << "Error: specify -gen mode\n";
        return 1;
    }
    if (OutDir.getValue().empty())
    {
        errs() << "Error: -outdir is required\n";
        return 1;
    }
    if (TargetName.getValue().empty())
    {
        errs() << "Error: -target is required\n";
        return 1;
    }

    ClangTool tool(op.getCompilations(), op.getSourcePathList());
    int result = tool.run(newFrontendActionFactory<StateChartAction>().get());
    if (result != 0 && g_states.empty())
    {
        errs() << "Error running clang tool (exit code " << result
               << ") and no states found - cannot generate output\n";
        return result;
    }
    else if (result != 0)
    {
        errs() << "Warning: clang tool reported errors (exit code " << result
               << ") but states were found - proceeding with output generation\n";
    }

    if (g_machine_name.empty())
    {
        errs() << "Warning: no boost::statechart::state_machine found in source files\n";
    }

    // Create output directory
    fs::create_directories(OutDir.getValue());

    // Write YAML
    generateYAML(OutDir.getValue() + "/" + TargetName.getValue() + "_states.yml");
    // Write DOT (Graphviz)
    generateDOT(OutDir.getValue() + "/" + TargetName.getValue() + "_states.dot");
    // Write Mermaid statechart
    generateMermaid(OutDir.getValue() + "/" + TargetName.getValue() + "_states.mmd");

    return 0;
}
