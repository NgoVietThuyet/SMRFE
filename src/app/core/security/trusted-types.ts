/**
 * Trusted Types bootstrap — imported once at application startup (main.ts).
 *
 * WHY THIS EXISTS
 * ---------------
 * The Content-Security-Policy header sent by the backend now includes:
 *   require-trusted-types-for 'script'
 *   trusted-types default angular
 *
 * This forces the browser to route every dangerous sink assignment
 * (innerHTML, outerHTML, script.src, etc.) through a named Trusted Types
 * policy before the value is accepted. Angular registers its own 'angular'
 * policy internally. The 'default' policy below is our backward-compatibility
 * bridge for any remaining third-party or legacy code that has not yet been
 * migrated to safe DOM APIs.
 *
 * SECURITY NOTE
 * -------------
 * The 'default' policy sanitizes HTML via DOMPurify before assignment. This
 * prevents hard runtime breakage during the migration period while still:
 *   • making every unsafe assignment visible and auditable in the browser's
 *     Trusted Types violation reports (via a future report-uri endpoint), and
 *   • allowing the team to progressively narrow or remove the policy as each
 *     innerHTML / eval usage is replaced with a safe alternative.
 *
 * DO NOT remove 'require-trusted-types-for' from the CSP — that would
 * silently re-allow all unsafe sinks with no audit trail.
 *
 * MIGRATION CHECKLIST (track in code review)
 * -------------------------------------------
 *  [x] chat.ts   – insertEmoji()          – migrated to createElement/insertNode
 *  [x] chat.ts   – sendMessage() clear    – migrated to replaceChildren()
 *  [x] gis.ts    – renderMarkers()        – migrated to createElement/textContent
 *  [x] mail.ts   – openCompose() clear    – migrated to replaceChildren()
 *  [x] mail.ts   – replyMail/forwardMail  – display via sanitizeHtml pipe
 *  [ ] any ng-zorro-antd internal usage   – covered by this default policy
 *  [ ] maplibre-gl internal usage         – covered by this default policy
 */

import { sanitizeHtml } from './html-sanitize';

if (typeof window !== 'undefined' && (window as any).trustedTypes?.createPolicy) {
  try {
    (window as any).trustedTypes.createPolicy('default', {
      createHTML: (s: string) => sanitizeHtml(s, 'richText'),
      createScript: () => '',
      createScriptURL: (s: string) => {
        try {
          const u = new URL(s, window.location.origin);
          return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
        } catch {
          return '';
        }
      },
    });
  } catch {
    // Policy already registered — happens in unit tests that re-import the module.
  }
}
