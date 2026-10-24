"""Rebuild the repository map with the separately installed graphifyy package."""
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from graphify.analyze import god_nodes, suggest_questions, surprising_connections
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.detect import detect, save_manifest
from graphify.diagnostics import diagnose_extraction, format_diagnostic_report
from graphify.export import to_html, to_json
from graphify.extract import extract
from graphify.report import generate

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'graphify-out'
EXCLUDES = ['.env*', '.agents/**', '.codex/**', '.local-data/**', '.server-build/**',
            '.test-build/**', '.venv*/**', '.vite/**', 'node_modules/**', 'dist/**',
            'datasets/**', 'runpod/**', 'submission/**', 'graphify-out/**', '*.pdf',
            'tests/fixtures/**', '.impeccable.md', 'docs/project-map.md']


def write(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding='utf-8')


def node_id(path):
    return re.sub(r'[^a-z0-9_]', '_', str(Path(path).with_suffix('')).replace('\\', '_').replace('/', '_').lower())


def main():
    detection = detect(ROOT, extra_excludes=EXCLUDES, gitignore=True)
    if detection['total_files'] > 500 or detection['total_words'] > 2_000_000:
        raise SystemExit('Corpus grew beyond reviewed scope; review exclusions before rebuilding.')
    write('.graphify_build.json', {'excludes': EXCLUDES, 'gitignore': True})
    write('.graphify_detect.json', detection)
    (OUT / '.graphify_root').write_text(str(ROOT), encoding='utf-8')
    (OUT / '.graphify_python').write_text(sys.executable, encoding='utf-8')
    ast = extract([Path(f) for f in detection['files']['code']], root=ROOT, cache_root=ROOT, parallel=False)
    nodes, edges = list(ast['nodes']), list(ast['edges'])
    known = {n['id'] for n in nodes}
    code = {Path(f).relative_to(ROOT).as_posix(): node_id(Path(f).relative_to(ROOT))
            for f in detection['files']['code']}
    coverage = {}

    # Document structure and explicit source references only; no guessed implementation edges.
    for filename in detection['files']['document']:
        path = Path(filename)
        relative = path.relative_to(ROOT).as_posix()
        lines = path.read_text(encoding='utf-8').splitlines()
        coverage[relative] = len(lines)
        stem = node_id(relative)
        document = stem + '_document'
        nodes.append({'id': document, 'label': relative, 'file_type': 'document',
                      'source_file': relative, 'source_location': 'Document', '_origin': 'semantic'})
        parent = document
        heading_ids = set()
        for number, line in enumerate(lines, 1):
            heading = re.match(r'^#{1,3}\s+(.+)', line)
            if heading:
                title = heading.group(1).strip()
                current = stem + '_' + re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')
                if current not in heading_ids:
                    heading_ids.add(current)
                    nodes.append({'id': current, 'label': title, 'file_type': 'concept',
                                  'source_file': relative, 'source_location': f'Section: {title}',
                                  '_origin': 'semantic'})
                    edges.append({'source': document, 'target': current, 'relation': 'contains',
                                  'confidence': 'EXTRACTED', 'confidence_score': 1.0,
                                  'source_file': relative, 'source_location': f'Line {number}', '_origin': 'semantic'})
                parent = current
            for source, target in code.items():
                if target in known and source in line:
                    edges.append({'source': parent, 'target': target, 'relation': 'references',
                                  'confidence': 'EXTRACTED', 'confidence_score': 1.0,
                                  'source_file': relative, 'source_location': f'Line {number}', '_origin': 'semantic'})

    extraction = {'nodes': nodes, 'edges': edges, 'hyperedges': [], 'input_tokens': 0, 'output_tokens': 0}
    graph = build_from_json(extraction, root=str(ROOT), directed=True)
    assert graph.number_of_nodes() and all(n.get('source_file') for n in nodes)
    assert not any('.local-data/' in n['source_file'].replace('\\', '/') for n in nodes)
    communities = cluster(graph)
    names = {'store': 'State and invoice actions', 'actions': 'Invoice actions and safeguards',
             'receipts': 'Receipt matching rules', 'reminderEngine': 'Reminder eligibility and checkpoints',
             'replyAnalysis': 'Buyer reply interpretation', 'types': 'Shared business records',
             'useDemoStore': 'Reactive state refresh', 'format': 'Money and date formatting',
             'frontend': 'Frontend HTTP serving', 'build': 'Server build helpers',
             'logic.test': 'Business rule regression tests', 'customer-orders-server.test': 'Customer order API tests',
             'OrdersView': 'Order intake and approval',
             'CustomerIntake': 'Phone lookup and onboarding', 'customerOrders': 'Customer and order rules',
             'CustomerReplyCard': 'Buyer reply review', 'ToneStudio': 'Reminder tone editing',
             'DashboardView': 'Collection dashboard', 'SellerWins': 'Seller progress',
             'email-mvp-plan': 'Planned email workflow', 'ActionCenterView': 'Action Center approvals',
             'DemoControls': 'Demo simulation controls', 'App': 'Application shell',
             'InvoiceDetailDrawer': 'Invoice review and payments', 'InvoicesView': 'Invoice browsing',
             'CustomersView': 'Customer history', 'aiService': 'Invoice assistant rules',
             'integrations': 'OCR and AI integrations', 'tsconfig': 'Frontend compiler settings',
             'AiAssistantView': 'Assistant conversation', 'AppHeader': 'Navigation and notifications',
             'PaymentCelebration': 'Payment feedback',
             'replit': 'Replit deployment notes', 'AttentionQueue': 'Shared attention queue',
             'DemoAccess': 'Demo passcode screen', 'commands': 'Browser backend commands',
             'tsconfig.logic-tests': 'Test compiler settings', 'app': 'HTTP and SQLite backend',
             'display': 'Shared display labels', 'logic.test': 'Business rule regression tests',
             'access': 'Demo access guard',
             'tsconfig.server': 'Server compiler settings', 'priorityEngine': 'Customer payment priorities',
             'pyproject': 'Python environment', 'postcss.config': 'CSS build settings',
             'requirements': 'OCR Python dependencies'}
    labels = {}
    for cid, members in communities.items():
        sources = Counter(str(graph.nodes[n].get('source_file', '')).replace('\\', '/') for n in members)
        dominant = next((s for s, _ in sources.most_common() if s), '')
        stem = Path(dominant).stem
        labels[cid] = names.get(stem, 'Build and runtime dependencies')
        if stem == 'README':
            labels[cid] = 'Backend setup and integrations' if dominant.startswith('server/') else 'Project setup and scope'
        if stem == 'package':
            symbols = {graph.nodes[n].get('label') for n in members}
            labels[cid] = ('Development commands' if 'scripts' in symbols else
                           'Build tool dependencies' if 'devDependencies' in symbols else
                           'Frontend dependencies' if 'dependencies' in symbols else 'Package and runtime settings')
    cohesion = score_all(graph, communities)
    gods = god_nodes(graph)
    surprises = surprising_connections(graph, communities)
    questions = suggest_questions(graph, communities, labels)
    if not to_json(graph, communities, str(OUT / 'graph.json'), community_labels=labels):
        raise SystemExit('Graphify shrink guard refused update. Review changes before replacing the graph.')
    report = generate(graph, communities, cohesion, labels, gods, surprises, detection,
                      {'input': 0, 'output': 0}, str(ROOT), suggested_questions=questions)
    diagnostic = diagnose_extraction(extraction, directed=True, root=ROOT)
    audit = format_diagnostic_report(diagnostic)
    notes = '''
## Scope and interpretation

- Code relationships come from Graphify's deterministic AST extraction. Document nodes represent headings and literal source-path references; they are a navigation index, not a claim of complete semantic understanding.
- `docs/email-mvp-plan.md` describes proposed work. A document referencing a source file does not mean that proposal is implemented. Telegram integration has been removed; legacy record fields may remain in source.
- Secrets, environment files, runtime customer databases, dependencies, builds, datasets, RunPod assets, submission material and binary fixtures/PDFs are excluded. Source CSS, lockfiles and other unsupported formats may not have nodes.
- SQL relationships require the optional `tree_sitter_sql` parser.
- Vue template interactions, dynamic dispatch and runtime effects may be absent or approximate. Verify critical behavior in source and tests.
- No external LLM extraction was used; extraction token counters are zero, and host-session token usage is unavailable rather than measured as zero.
- `graphify-out/` was written into the working tree. Commit only the outputs the team wants to share; generated caches and machine-specific interpreter paths need not be committed.
'''
    (OUT / 'GRAPH_REPORT.md').write_text(report + notes + '\n## Extraction health\n\n```text\n' + audit + '\n```\n', encoding='utf-8')
    write('.graphify_labels.json', {str(k): v for k, v in labels.items()})
    write('.graphify_analysis.json', {'communities': communities, 'cohesion': cohesion, 'gods': gods,
                                     'surprises': surprises, 'questions': questions})
    write('coverage.json', {'document_lines': coverage, 'scope': EXCLUDES,
                           'extraction': 'AST plus document headings and literal code-path references',
                           'host_session_tokens': None, 'generated_at': datetime.now(timezone.utc).isoformat()})
    if not to_html(graph, communities, str(OUT / 'graph.html'), community_labels=labels):
        raise SystemExit('HTML export failed')
    # Structural document indexing is not full semantic extraction: leave documents unstamped.
    save_manifest({'code': detection['files']['code']}, root=ROOT,
                  scan_corpus={f for group in detection['files'].values() for f in group})
    print(f"Corpus: {detection['total_files']} files, ~{detection['total_words']} words")
    print(f'Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges, {len(communities)} communities')
    print(audit)


if __name__ == '__main__':
    main()
