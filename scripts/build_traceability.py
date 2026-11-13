"""Build a source-derived requirement register and endpoint matrix."""
from pathlib import Path
import csv
import json
import re

ROOT = Path(__file__).resolve().parents[1]
PREFIX_SOURCE = {
    'ACC': ['backend/src/auth/auth.ts', 'backend/src/admin/admin.ts'],
    'FLT': ['backend/src/flights/flights.ts', 'backend/src/bookings/inventory.ts', 'backend/src/bookings/bookings.ts'],
    'HTL': ['backend/src/hotels/hotels.ts', 'backend/src/bookings/inventory.ts', 'backend/src/community/community.ts'],
    'PAY': ['backend/src/payments/payments.ts', 'backend/src/bookings/inventory.ts'],
    'ITN': ['backend/src/itineraries/itineraries.ts', 'backend/src/ops.ts'],
    'BLG': ['backend/src/community/community.ts', 'backend/src/media/media.ts'],
    'GEN': ['backend/src/bootstrap.ts', 'backend/src/database.ts', 'backend/src/ops.ts', 'backend/src/jobs.ts'],
    'BON': ['backend/src/admin/admin.ts', 'backend/src/support/support.ts'],
}
SPECIAL = {
    'ACC-01': 'Consent/password validation and unique-email index; inline UI belongs to M2.',
    'ACC-04': 'Role landing path returned by API; actual dashboard pages belong to M2.',
    'ACC-06': 'Server inactivity, refresh revocation and cookie clearing are implemented.',
    'ACC-10': 'Restricted APIs return 401. Login redirect and return-to-action navigation belong to M2.',
    'ACC-18': 'Administrator is seeded; no admin self-registration route exists.',
    'ACC-19': 'httpOnly/Secure/SameSite cookies, refresh rotation and /auth/me; frontend storage behavior needs M2 inspection.',
    'PAY-01': 'Signed HTTP webhook and adapter workflows pass locally; a real Stripe test account is not configured.',
    'PAY-03': 'Refund records, compensation, idempotency and retry tested with adapter fixtures; real Stripe refund unverified.',
    'ITN-18': 'Actual FXRatesAPI fetch/cache verified separately; outage fallback tested with cached fixture.',
    'GEN-01-B': 'Email queue/retry implemented; SMTP account delivery not configured or verified.',
    'ACC-02': 'Verification gate and single-use links tested; actual inbox delivery unverified.',
    'ACC-07': 'Reset expiry/supersession/single-use implemented; actual inbox delivery unverified.',
    'GEN-02': 'Field-specific backend errors implemented; inline rendering belongs to M2.',
    'GEN-03': 'Destructive endpoints require explicit confirmation where applicable; confirmation dialogs belong to M2.',
    'GEN-04': 'Empty search/list results are explicit; friendly visual states belong to M2.',
    'GEN-05': 'Paginated collection endpoints use page size 10. Nested document structures and exports are not collection pages.',
    'GEN-06': 'Flight detail/search include local timestamps; tickets include both airport zones.',
    'GEN-11': 'Booking transitions and scheduled completion/expiry implemented. Provider cancellation invalidates pending holds as Expired.',
    'GEN-12': 'Official countries/cities/airports/attractions and derived supported currencies are seeded idempotently.',
    'GEN-13': 'Global DTO validation, service rules, ownership checks and salted scrypt password hashing.',
    'GEN-14': 'Milestone 2 frontend information architecture; role paths, resource APIs and validation contracts available now.',
    'GEN-15': 'Milestone 2 frontend ease of use and visual workflow evaluation.',
    'GEN-16': 'Milestone 2 responsive/loading/success/error UI; backend errors and operation results available now.',
    'GEN-17': 'Milestone 2 palette, typography, spacing and component consistency.',
}
OVERRIDE = {
    'ACC-18': ['backend/src/seed.ts'], 'ACC-19': ['backend/src/auth/auth.ts', 'backend/src/bootstrap.ts'],
    'GEN-02': ['backend/src/bootstrap.ts', 'backend/src/dto.ts'],
    'GEN-03': ['backend/src/dto.ts'], 'GEN-04': ['backend/src/common.ts'],
    'GEN-05': ['backend/src/common.ts'], 'GEN-06': ['backend/src/flights/flights.ts', 'backend/src/bookings/bookings.ts'],
    'GEN-07': ['backend/src/admin/admin.ts', 'backend/src/ops.ts'], 'GEN-08': ['backend/src/media/media.ts'],
    'GEN-09': ['backend/src/community/community.ts'], 'GEN-10': ['backend/src/admin/admin.ts'],
    'GEN-11': ['backend/src/bookings/inventory.ts', 'backend/src/bookings/bookings.ts', 'backend/src/payments/payments.ts'],
    'GEN-12': ['backend/src/seed.ts', 'backend/data/reference.json'],
    'GEN-13': ['backend/src/auth/auth.ts', 'backend/src/bootstrap.ts', 'backend/src/dto.ts'],
}

def main():
    requirements = json.loads((ROOT/'docs/requirements/requirements.json').read_text(encoding='utf-8'))
    api = json.loads((ROOT/'docs/api/openapi.json').read_text(encoding='utf-8'))
    endpoints = []
    for path, operations in api['paths'].items():
        for method, op in operations.items():
            if method not in ('get','post','patch','put','delete'): continue
            ids = re.findall(r'(?:ACC|FLT|HTL|PAY|ITN|BLG|GEN|BON)-\d+(?:-B|a)?',op.get('summary',''))
            endpoints.append(dict(method=method.upper(),path=path,requirements=list(dict.fromkeys(ids)),access=op.get('x-access','See Swagger operation'),summary=op.get('summary','')))
    for req in requirements:
        req['endpoints'] = [f"{e['method']} {e['path']}" for e in endpoints if req['id'] in e['requirements']]
        req['implementation'] = OVERRIDE.get(req['id'], PREFIX_SOURCE[req['id'].split('-')[0]])
        req['status'] = 'Milestone 2 frontend' if req['id'] in ('GEN-14','GEN-15','GEN-16','GEN-17') else 'Backend implemented; acceptance evidence requires review'
        req['notes'] = SPECIAL.get(req['id'],'Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance.')
        req['verification'] = 'backend/test/integration/platform.spec.ts; backend/test/unit/rules.spec.ts; docs/milestone-1/REVIEW_AND_VERIFICATION.md'
    out = ROOT/'docs/requirements'
    (out/'traceability.json').write_text(json.dumps(requirements,indent=2,ensure_ascii=False),encoding='utf-8')
    with (out/'traceability.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.writer(f);writer.writerow(['ID','Classification','Module','Status','Endpoints','Implementation','Notes','Verification'])
        for r in requirements: writer.writerow([r['id'],r['classification'],r['module'],r['status'],'; '.join(r['endpoints']),'; '.join(r['implementation']),r['notes'],r['verification']])
    lines=['# Requirements traceability','',f"All {len(requirements)} workbook requirements are preserved. Endpoint coverage is derived from Swagger summaries; source mappings cover cross-cutting rules without dedicated endpoints.",'','**Implemented does not mean externally verified or independently human-reviewed.** The JSON register preserves complete source text, dependencies, evidence locations, and limitations. Four mandatory visual/UI requirements remain in Milestone 2. Other UI portions are identified in the notes.','']
    for classification in ['Mandatory','Bonus']:
        lines += [f'## {classification}','','| ID | Module | Endpoint coverage | Status / notes |','| --- | --- | --- | --- |']
        for r in requirements:
            if r['classification']!=classification:continue
            coverage='<br>'.join(f'`{e}`' for e in r['endpoints']) or 'Shared service, seed, or frontend contract'
            lines.append(f"| {r['id']} | {r['module']} | {coverage} | {r['notes'].replace('|','/')} |")
        lines.append('')
    (out/'TRACEABILITY.md').write_text('\n'.join(lines),encoding='utf-8')
    lines=['# API endpoint coverage','',f"{len(endpoints)} operations across {len(api['paths'])} paths. This index is derived from the exported OpenAPI document.",'','| Method | Path | Requirements | Access |','| --- | --- | --- | --- |']
    lines += [f"| {e['method']} | `{e['path']}` | {', '.join(e['requirements'])} | {e['access']} |" for e in endpoints]
    (ROOT/'docs/api/ENDPOINTS.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    assert len({r['id'] for r in requirements})==115
    assert sum(r['classification']=='Mandatory' for r in requirements)==104
    print(f'Traced {len(requirements)} requirements and {len(endpoints)} API operations')

if __name__=='__main__':main()
