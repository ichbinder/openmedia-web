import { randomBytes } from "node:crypto";

/**
 * Helpers for uploading NZBs via the backend /downloads/request endpoint
 * directly — bypassing the browser extension flow. Playwright specs use
 * these so they don't have to install and fire an extension just to
 * exercise the review flow.
 *
 * All calls go to the backend on localhost:4000 (the webServer in
 * playwright.config.ts). The helper accepts a token so the spec can
 * choose which user's session the upload belongs to — essential for the
 * multi-user hash-sharing spec.
 */

const BACKEND_URL = "http://localhost:4000";

export interface UploadResponse {
  jobId: string;
  status: string;
  needsReview: boolean;
  nzbFileId: string;
  hash: string;
  reused: boolean;
}

/**
 * Build a valid-enough NZB XML payload. Real downloaded NZBs are several
 * KB with real message-ids, but the backend only needs enough XML for its
 * parser to extract a hash and recognize it as NZB. The payload's bytes
 * determine the sha256 hash, so the same inputs always produce the same
 * hash — that's what lets the multi-user spec test hash-based dedup.
 *
 * The title is embedded in a fake segment id so different calls with
 * different titles produce different hashes (single-user spec wants a
 * fresh NzbFile each run). Pass the same title to simulate two uploads
 * of the "same" file.
 */
export function buildUnmatchableNzbContent(title: string): string {
  // Pad to >= 50 bytes (the backend's minimum length guard) with enough
  // real NZB structure that the XML parser can extract segments.
  return `<?xml version="1.0" encoding="iso-8859-1" ?>
<!DOCTYPE nzb PUBLIC "-//newzBin//DTD NZB 1.1//EN" "http://www.newzbin.com/DTD/nzb/nzb-1.1.dtd">
<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">
  <head>
    <meta type="title">${escapeXml(title)}</meta>
  </head>
  <file poster="e2e-test@local" date="1700000000" subject="&quot;${escapeXml(title)}.nzb&quot; yEnc (1/1)">
    <groups>
      <group>alt.binaries.test.e2e</group>
    </groups>
    <segments>
      <segment bytes="1024" number="1">e2e-${title}-segment-1@local</segment>
    </segments>
  </file>
</nzb>
`;
}

/**
 * Generate a title that no TMDB query will ever match — combines a
 * random hex blob with a distinct prefix. Used to force the backend into
 * the needs_review branch regardless of what the TMDB mock is seeded with.
 */
export function makeUnmatchableTitle(): string {
  const rand = randomBytes(6).toString("hex");
  return `e2e-unmatchable-${rand}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * POST the NZB content to the backend as the given user. Returns the
 * essential fields the spec needs: jobId, status, and the shared
 * nzbFileId (so the multi-user spec can assert that both uploads hit the
 * same NzbFile row via hash dedup).
 *
 * Throws on non-2xx responses so the spec fails loudly instead of
 * silently proceeding with an undefined job.
 */
export async function uploadNzbDirect(params: {
  nzbContent: string;
  title: string;
  filename?: string;
  token: string;
}): Promise<UploadResponse> {
  const res = await fetch(`${BACKEND_URL}/downloads/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      nzbContent: params.nzbContent,
      title: params.title,
      filename: params.filename ?? `${params.title}.nzb`,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      `[e2e-upload] ${res.status} ${res.statusText}: ${JSON.stringify(body)}`,
    );
  }

  const job = body.job as {
    id?: string;
    status?: string;
    nzbFile?: { id?: string; hash?: string };
  } | undefined;

  if (!job?.id || !job.status || !job.nzbFile?.id || !job.nzbFile.hash) {
    throw new Error(
      `[e2e-upload] backend response missing required fields: ${JSON.stringify(body)}`,
    );
  }

  return {
    jobId: job.id,
    status: job.status,
    needsReview: body.needsReview === true,
    reused: body.reused === true,
    nzbFileId: job.nzbFile.id,
    hash: job.nzbFile.hash,
  };
}

/**
 * One-shot helper for the most common case: build a fresh unmatchable
 * NZB with a unique title and upload it. Returns the upload response plus
 * the title used (so the spec can match on filename in the UI if needed).
 */
export async function uploadFreshUnmatchableNzb(
  token: string,
): Promise<UploadResponse & { title: string }> {
  const title = makeUnmatchableTitle();
  const nzbContent = buildUnmatchableNzbContent(title);
  const result = await uploadNzbDirect({ nzbContent, title, token });
  return { ...result, title };
}
