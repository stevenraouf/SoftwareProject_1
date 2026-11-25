"""Generate requirement-to-source, endpoint and verification indexes for the project."""
import argparse
import csv
import json
import re
from pathlib import Path

from import_sources import read_workbook

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/requirements'
WORKBOOK = 'Objectives/Final_ SP1_Reviewed_Requirements.xlsx'
EVIDENCE = 'docs/milestone-2/evidence/acceptance-2026-11-25.json'
API_TEST = 'backend/test/integration/platform.spec.ts'
UNIT_TEST = 'backend/test/unit/rules.spec.ts'
BONUS_TEST = 'backend/scripts/verify-bonuses.mjs'
REQUIREMENT_ID = re.compile(r'\b(?:ACC|FLT|HTL|PAY|ITN|BLG|GEN|BON)-\d+(?:-B|a)?\b')

BACKEND = {
    'ACC': ['auth/auth', 'admin/admin'],
    'FLT': ['flights/flights', 'bookings/inventory', 'bookings/bookings'],
    'HTL': ['hotels/hotels', 'bookings/inventory', 'community/community'],
    'PAY': ['payments/payments', 'bookings/bookings'],
    'ITN': ['itineraries/itineraries', 'ops'],
    'BLG': ['community/community', 'media/media'],
    'GEN': ['bootstrap', 'database', 'ops', 'jobs'],
    'BON': ['admin/admin', 'support/support'],
}
BACKEND_OVERRIDES = {
    'ACC-11': ['auth/auth', 'itineraries/itineraries', 'bookings/bookings'],
    'ACC-18': ['seed', 'auth/auth'],
    'ACC-19': ['auth/auth', 'bootstrap'],
    'FLT-02': ['support/support', 'seed'],
    'GEN-01': ['ops', 'support/support', 'jobs'],
    'GEN-02': ['bootstrap', 'common', 'dto'],
    'GEN-03': ['dto'],
    'GEN-04': ['common'],
    'GEN-05': ['common'],
    'GEN-06': ['flights/flights', 'bookings/bookings'],
    'GEN-07': ['admin/admin', 'ops'],
    'GEN-08': ['media/media'],
    'GEN-09': ['community/community'],
    'GEN-10': ['admin/admin', 'community/community', 'itineraries/itineraries'],
    'GEN-11': ['bookings/inventory', 'bookings/bookings', 'payments/payments', 'jobs'],
    'GEN-12': ['seed'],
    'GEN-13': ['auth/auth', 'bootstrap', 'dto', 'common'],
    'GEN-01-B': ['ops', 'jobs'],
    'ITN-18': ['itineraries/itineraries', 'ops', 'jobs'],
    'BON-01': ['admin/admin'],
    'BON-02': ['support/support'],
}

# Groups share a user-facing workflow. Server-only operations have no dedicated screen.
# Frontend paths are relative to frontend/src, browser specs to frontend/tests.
WORKFLOWS = [
    ('ACC-01 ACC-04 ACC-05 ACC-06 ACC-08 ACC-09 ACC-12', 'components/account.tsx lib/session.tsx', 'account'),
    ('ACC-02 ACC-07', 'components/verify-email.tsx components/account.tsx', ''),
    ('ACC-07a ACC-13 ACC-14 ACC-15 ACC-16 ACC-17 BON-01', 'features/staff/admin.tsx', 'staff'),
    ('ACC-10 ACC-11', 'components/account.tsx features/booking/flights.tsx features/booking/stays.tsx features/discovery/planner.tsx', 'booking public-rendering'),
    ('ACC-18', '', ''),
    ('ACC-19', 'lib/api.ts lib/session.tsx', 'account'),
    ('FLT-01 HTL-01', 'features/staff/admin.tsx features/staff/provider.tsx', 'staff'),
    ('FLT-02 FLT-11 FLT-12 FLT-15 FLT-17 FLT-19 FLT-21', 'features/booking/flights.tsx', 'booking'),
    ('FLT-03 FLT-04 FLT-05 FLT-06 FLT-29 FLT-30', 'features/staff/airline.tsx', 'staff'),
    ('FLT-08 FLT-09 HTL-09 HTL-10', 'features/staff/provider.tsx features/booking/shared.tsx', 'staff-pagination booking'),
    ('FLT-22 FLT-23 HTL-17 HTL-18 PAY-01 PAY-02 PAY-03 PAY-04', 'features/booking/payment.tsx features/booking/trips.tsx', 'booking'),
    ('FLT-25 FLT-26 FLT-27 FLT-28 HTL-20 HTL-21', 'features/booking/trips.tsx', 'booking'),
    ('HTL-02 HTL-11 HTL-12 HTL-15 HTL-16 HTL-23 HTL-24', 'features/booking/stays.tsx', 'booking'),
    ('HTL-03 HTL-04 HTL-05 HTL-06 HTL-08 HTL-22 HTL-26', 'features/staff/hotel.tsx', 'staff staff-pagination'),
    ('ITN-01 ITN-03 ITN-20 ITN-21 ITN-28', 'features/discovery/planner.tsx features/discovery/planner-data.tsx', 'discovery public-rendering'),
    ('ITN-05 ITN-07 ITN-08 ITN-09 ITN-10 ITN-12 ITN-14 ITN-16 ITN-18', 'features/discovery/day.tsx features/discovery/planner.tsx', 'discovery'),
    ('ITN-25 ITN-26 ITN-27', 'features/discovery/plan-travel.tsx', 'discovery'),
    ('BLG-01 BLG-02 BLG-03 BLG-04 BLG-05 BLG-06 BLG-07 BLG-08 BLG-09 BLG-10 BLG-12 BLG-13', 'features/discovery/journal.tsx features/discovery/shared.tsx', 'discovery public-rendering'),
    ('GEN-01', 'components/account.tsx components/shell.tsx', 'account'),
    ('GEN-01-B', '', ''),
    ('GEN-02', 'lib/form-errors.ts features/staff/ui.tsx features/discovery/shared.tsx features/booking/shared.tsx', 'account booking staff'),
    ('GEN-03 GEN-04 GEN-05', 'features/staff/ui.tsx features/booking/shared.tsx features/discovery/shared.tsx', 'booking staff-pagination discovery'),
    ('GEN-06', 'features/booking/flights.tsx features/booking/trips.tsx features/staff/airline.tsx', 'booking staff'),
    ('GEN-07 GEN-10', 'features/staff/admin.tsx', 'staff'),
    ('GEN-08 GEN-09', 'features/discovery/shared.tsx features/booking/stays.tsx features/staff/provider.tsx', 'discovery'),
    ('GEN-11', 'features/booking/payment.tsx features/booking/trips.tsx', 'booking'),
    ('GEN-12', 'lib/destinations.ts components/home.tsx', 'home'),
    ('GEN-13', 'lib/api.ts', 'account public-rendering'),
    ('GEN-14 GEN-15 GEN-16 GEN-17', 'components/shell.tsx components/home.tsx app/style.css', 'home account booking discovery staff'),
    ('BON-02', 'components/account.tsx features/discovery/planner.tsx features/booking/stays.tsx', 'discovery'),
]

NOTES = {
    'ACC-01': 'Registration validates consent, password and email. Browser coverage checks inline errors.',
    'ACC-04': 'Login selects the workspace for the authenticated role.',
    'ACC-10': 'Login restores the protected destination. Browser tests cover guest flight and hotel handoffs and a forced password change.',
    'ACC-18': 'The seed creates the administrator. Registration creates traveler accounts.',
    'ACC-19': 'The API issues secure httpOnly access and refresh cookies. The frontend restores the session through /auth/me.',
    'ACC-02': 'The bonus run exercised verification and the local SMTP inbox.',
    'ACC-07': 'The bonus run exercised reset email, token supersession and single use with a local SMTP inbox.',
    'GEN-01-B': 'The bonus run delivered notification email to a dedicated loopback SMTP inbox.',
    'PAY-01': 'Stripe Elements completed a sandbox payment and a signed webhook confirmed the booking.',
    'PAY-03': 'The browser cancellation produced a successful refund in the Stripe sandbox.',
    'ITN-18': 'Integration tests cover first use, conversion and cached fallback. A separate read-only check verified the configured provider response.',
    'GEN-02': 'The API returns field errors. The frontend associates them with the relevant inputs.',
    'GEN-03': 'Representative browser scenarios exercise confirmations for destructive actions.',
    'GEN-04': 'The browser suite checks that an empty flight search gives the traveler a recovery action.',
    'GEN-05': 'Coverage includes ten-row collection pages and nested staff date, calendar and refund-tier lists.',
    'GEN-06': 'Search, flight details and tickets display airport-local times.',
    'GEN-11': 'Wall-clock tests verified expiry and inventory release for both a flight and a hotel hold.',
    'GEN-12': 'The seed imports the supplied reference dataset and derives supported currencies.',
    'GEN-13': 'The API enforces validation and ownership. Regressions cover private booking references in public reviews and discovery responses.',
    'GEN-14': 'Browser workflows cover navigation across roles. Independent review of information architecture remains a human check.',
    'GEN-15': 'Task-flow tests cover search, booking and editing. Ease of learning still calls for first-time user feedback.',
    'GEN-16': 'Browser tests exercise validation, recovery and responsive layouts. The separate 360-pixel check covers 20 screens.',
    'GEN-17': 'Shared styles and responsive layouts are implemented. Visual consistency requires human review. Figma quota prevented a fresh frame comparison.',
}
MODULE_CHECKS = {
    'Accounts & Admin': 'Representative account, provider and audit workflows are covered.',
    'Flights': 'Representative flight scheduling, search, holds and ticket workflows are covered.',
    'Hotels': 'Representative availability, room selection, reservation and staff workflows are covered.',
    'Payments & Policies': 'Policy acceptance, settlement and refund scenarios are covered.',
    'Itineraries': 'Representative itinerary editing, budgeting, search and visibility workflows are covered.',
    'Blog': 'Representative publishing, search, comments, likes and public rendering workflows are covered.',
    'Cross-cutting': 'Representative API and cross-role browser workflows are covered.',
}


def verified_requirements():
    register = json.loads((OUTPUT / 'requirements.json').read_text(encoding='utf-8'))
    workbook = read_workbook((ROOT / WORKBOOK).read_bytes())
    original = []
    for classification, rows in workbook.items():
        for row in rows[1:]:
            original.append(dict(id=row['A'], module=row['B'], actors=row['C'], requirement=row['D'],
                                 dependencies=[x.strip() for x in row.get('E', '').split(',') if x.strip()],
                                 complexity=row['F'], classification=classification))
    if register != original:
        raise ValueError('Workbook and requirement register differ. Check the original specification.')
    return register


def main(requirements_only=False):
    requirements = verified_requirements()
    evidence = json.loads((ROOT / EVIDENCE).read_text(encoding='utf-8'))
    api = json.loads((ROOT / 'docs/api/openapi.json').read_text(encoding='utf-8'))
    endpoints = []
    for path, operations in api['paths'].items():
        for method, op in operations.items():
            if method not in ('get', 'post', 'patch', 'put', 'delete'):
                continue
            ids = list(dict.fromkeys(REQUIREMENT_ID.findall(op.get('summary', ''))))
            endpoints.append(dict(method=method.upper(), path=path, requirements=ids,
                                  access=op.get('x-access', 'See Swagger operation')))

    workflows = {}
    for ids, frontend, browser in WORKFLOWS:
        for ident in ids.split():
            if ident in workflows:
                raise ValueError(f'Duplicate workflow mapping for {ident}')
            workflows[ident] = (frontend.split(), browser.split())
    known = {r['id'] for r in requirements}
    if known != workflows.keys() or len(known) != 115 or len(requirements) != len(known):
        raise ValueError(f'Workflow mapping mismatch: {known.symmetric_difference(workflows)}')
    checked_bonus = set(evidence['bonusScenarios']['passed'])
    if checked_bonus != {r['id'] for r in requirements if r['classification'] == 'Bonus'}:
        raise ValueError('Bonus scenario evidence and workbook IDs differ')
    for req in requirements:
        ident = req['id']
        frontend, browser = workflows[ident]
        req['endpoints'] = [f"{e['method']} {e['path']}" for e in endpoints if ident in e['requirements']]
        sources = BACKEND_OVERRIDES.get(ident, BACKEND[ident.split('-')[0]])
        if ident in ('GEN-14', 'GEN-15', 'GEN-16', 'GEN-17'):
            sources = []
        implementation = [f'backend/src/{path}.ts' for path in sources]
        implementation.extend(f'frontend/src/{path}' for path in frontend)
        if ident in ('GEN-12', 'FLT-02'):
            implementation.append('backend/data/reference.json')
        tests = [API_TEST, *(f'frontend/tests/{name}.spec.ts' for name in browser), EVIDENCE]
        if ident in ('GEN-06', 'GEN-08', 'GEN-13', 'PAY-03'):
            tests.append(UNIT_TEST)
        if ident in checked_bonus:
            tests.append(BONUS_TEST)
        for path in implementation + tests:
            if not (ROOT / path).is_file():
                raise FileNotFoundError(f'{ident} maps to a missing file: {path}')
        req['implementation'] = implementation
        req['status'] = ('Implementation and representative bonus scenario verified' if ident in checked_bonus
                         else 'Implemented with human UX review outstanding' if ident in ('GEN-14', 'GEN-15', 'GEN-16', 'GEN-17')
                         else 'Implementation mapped with representative module checks')
        req['notes'] = NOTES.get(ident, MODULE_CHECKS[req['module']])
        req['verification'] = '; '.join(tests)

    (OUTPUT / 'traceability.json').write_text(json.dumps(requirements, indent=2, ensure_ascii=False), encoding='utf-8')
    with (OUTPUT / 'traceability.csv').open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['ID', 'Classification', 'Module', 'Status', 'Endpoints', 'Implementation', 'Notes', 'Verification'])
        for r in requirements:
            writer.writerow([r['id'], r['classification'], r['module'], r['status'], '; '.join(r['endpoints']),
                             '; '.join(r['implementation']), r['notes'], r['verification']])
    checks = evidence['checks']
    counts = {c: sum(r['classification'] == c for r in requirements) for c in ('Mandatory', 'Bonus')}
    if counts != {'Mandatory': 104, 'Bonus': 11}:
        raise ValueError(f'Unexpected workbook counts: {counts}')
    lines = ['# Requirements traceability', '',
             f"The workbook defines {counts['Mandatory']} mandatory requirements and {counts['Bonus']} bonuses. The generator compares the full register with the workbook before producing this index. [Original workbook](../../Objectives/Final_%20SP1_Reviewed_Requirements.xlsx)",
             '', f"The {evidence['date']} acceptance run recorded {checks['backendTests']['passed']}/{checks['backendTests']['total']} backend tests, {checks['browserTests']['expected']} passing Edge browser tests and {checks['apiOperations']['successful']}/{checks['apiOperations']['documented']} documented API operations with a successful response. The suite exercises representative scenarios. Independent usability review, visual judgment and student sign-off remain open. [Measured results](../milestone-2/evidence/acceptance-2026-11-25.json) · [Review scope](../milestone-2/ACCEPTANCE.md)",
             '', 'The JSON and CSV include source files and relevant test suites for each requirement. API mappings come from the exported Swagger summaries. [Detailed JSON](traceability.json) · [Detailed CSV](traceability.csv)', '']
    for classification in ('Mandatory', 'Bonus'):
        lines += [f'## {classification}', '', '| ID | Module | Mapped API operations | Evidence scope |',
                  '| --- | --- | --- | --- |']
        for r in requirements:
            if r['classification'] != classification:
                continue
            coverage = '<br>'.join(f"`{e}`" for e in r['endpoints']) or 'Shared rule or UI workflow'
            lines.append(f"| {r['id']} | {r['module']} | {coverage} | {r['notes']} |")
        lines.append('')
    (OUTPUT / 'TRACEABILITY.md').write_text('\n'.join(lines), encoding='utf-8')
    if not requirements_only:
        lines = ['# API endpoint coverage', '', f"{len(endpoints)} operations across {len(api['paths'])} paths. This index is derived from the exported OpenAPI document.", '', '| Method | Path | Requirements | Access |', '| --- | --- | --- | --- |']
        lines.extend(f"| {e['method']} | `{e['path']}` | {', '.join(e['requirements'])} | {e['access']} |" for e in endpoints)
        (ROOT / 'docs/api/ENDPOINTS.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Traced {len(requirements)} workbook requirements and {len(endpoints)} API operations')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--requirements-only', action='store_true', help='Leave the separate API endpoint index untouched')
    main(parser.parse_args().requirements_only)
