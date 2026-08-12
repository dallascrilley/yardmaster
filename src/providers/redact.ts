/**
 * Provider auth probes print whatever the vendor CLI prints, and several of
 * them print the signed-in operator: `claude auth status` emits JSON carrying
 * `email`, `orgId`, `orgName`, and `subscriptionType`. `yardmaster providers
 * doctor` is meant to be pasted into issues and CI logs, so it redacts that
 * identity by default and only shows it when the caller asks with
 * `--show-identity`.
 *
 * Redaction runs on three surfaces, because provider output is not uniformly
 * shaped:
 *
 * 1. JSON objects found anywhere in the text, including ones wrapped in a
 *    version notice or a trailing hint line, and one per line for NDJSON.
 * 2. `Key: value` lines, which is how the human-readable CLIs print accounts.
 * 3. Bare email addresses and UUIDs anywhere else.
 *
 * This is a filter, not a proof. A provider that prints an opaque account
 * token with no surrounding label will pass through, so the user-facing
 * wording says identity fields are redacted rather than promising the output
 * is scrubbed of everything.
 */

/** Keys whose own scalar value is identity, wherever they appear. */
const IDENTITY_KEYS = new Set(
  [
    'email',
    'emailaddress',
    'email_address',
    'user',
    'username',
    'userid',
    'user_id',
    'login',
    'owner',
    'account',
    'accountid',
    'account_id',
    'org',
    'orgid',
    'org_id',
    'orgname',
    'org_name',
    'organization',
    'organizationid',
    'organization_id',
    'organizationname',
    'organization_name',
    'team',
    'teamid',
    'team_id',
    'teamname',
    'team_name',
    'workspace',
    'workspaceid',
    'workspace_id',
    'subject',
    'sub',
  ].map((key) => key.toLowerCase()),
)

/**
 * Keys that only mean identity when nested inside an identity container, so
 * `account.plan` survives while `account.name` does not.
 */
const NESTED_IDENTITY_KEYS = new Set(['id', 'name', 'email', 'login', 'slug', 'uuid', 'handle'])

// Quantifiers are bounded deliberately. An unbounded `[A-Za-z0-9._%+-]+@` scans
// the full run of candidate characters from every starting offset, so a long
// provider log with no `@` in it costs O(n^2): a 100 KB line took ~26s. The
// bounds keep the work per offset constant while still covering real addresses
// (RFC 5321 caps the local part at 64 and a domain at 255).
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}/g
const UUID_PATTERN = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g
const LABELLED_VALUE_PATTERN = /^(\s*)([A-Za-z][A-Za-z0-9 _-]{0,40}?)(\s*[:=]\s*)(\S.*)$/

/** Cap on JSON substrings parsed per string, so a pathological input cannot make the scan quadratic. */
const MAX_JSON_CANDIDATES = 32

export const REDACTED = '[redacted]'

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '')
}

function isIdentityKey(key: string): boolean {
  return IDENTITY_KEYS.has(key.toLowerCase()) || IDENTITY_KEYS.has(normalizeKey(key))
}

function isScalar(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'function')
}

function redactJsonValue(value: unknown, insideIdentity: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactJsonValue(entry, insideIdentity))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        const identity =
          isIdentityKey(key) || (insideIdentity && NESTED_IDENTITY_KEYS.has(normalizeKey(key)))

        if (identity && isScalar(entry)) {
          return [key, entry === null ? null : REDACTED]
        }

        return [key, redactJsonValue(entry, insideIdentity || identity)]
      }),
    )
  }

  if (typeof value === 'string') {
    return redactFreeText(value)
  }

  return value
}

/** Index of the `}`/`]` closing the structure that starts at `start`, or -1. */
function findBalancedEnd(text: string, start: number): number {
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') inString = true
    else if (char === open) depth += 1
    else if (char === close) {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

function redactFreeText(value: string): string {
  return value
    .split('\n')
    .map((line) => {
      const labelled = LABELLED_VALUE_PATTERN.exec(line)
      if (labelled && isIdentityKey(labelled[2] as string)) {
        return `${labelled[1]}${labelled[2]}${labelled[3]}${REDACTED}`
      }
      return line
    })
    .join('\n')
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(UUID_PATTERN, REDACTED)
}

/**
 * Strip operator identity from a provider CLI's output.
 *
 * JSON found in the text is reserialized with identity values replaced, so
 * machine consumers still parse it and non-identity fields survive. Everything
 * around it falls back to labelled-line, email, and UUID redaction.
 */
export function redactIdentity(value: string | undefined): string | undefined {
  if (value === undefined) return undefined

  let out = ''
  let plainStart = 0
  let candidates = 0
  let index = 0

  while (index < value.length && candidates < MAX_JSON_CANDIDATES) {
    const char = value[index]
    if (char !== '{' && char !== '[') {
      index += 1
      continue
    }

    const end = findBalancedEnd(value, index)
    if (end === -1) {
      // Nothing after this point can close, so no later candidate can either.
      break
    }

    candidates += 1
    try {
      const parsed: unknown = JSON.parse(value.slice(index, end + 1))
      if (parsed && typeof parsed === 'object') {
        out += redactFreeText(value.slice(plainStart, index))
        out += JSON.stringify(redactJsonValue(parsed, false), null, 2)
        index = end + 1
        plainStart = index
        continue
      }
    } catch {
      // Not JSON; leave it to free-text redaction.
    }

    index += 1
  }

  return out + redactFreeText(value.slice(plainStart))
}
