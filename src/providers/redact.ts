/**
 * Provider auth probes print whatever the vendor CLI prints, and several of
 * them print the signed-in operator: `claude auth status` emits JSON carrying
 * `email`, `orgId`, `orgName`, and `subscriptionType`. `yardmaster providers
 * doctor` is meant to be pasted into issues and CI logs, so it redacts that
 * identity by default and only shows it when the caller asks with
 * `--show-identity`.
 */

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

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const UUID_PATTERN = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g

export const REDACTED = '[redacted]'

function redactFreeText(value: string): string {
  return value.replace(EMAIL_PATTERN, REDACTED).replace(UUID_PATTERN, REDACTED)
}

function redactJsonValue(value: unknown, keyIsIdentity: boolean): unknown {
  if (typeof value === 'string') {
    return keyIsIdentity ? REDACTED : redactFreeText(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return keyIsIdentity ? REDACTED : value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactJsonValue(entry, keyIsIdentity))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        redactJsonValue(entry, keyIsIdentity || IDENTITY_KEYS.has(key.toLowerCase())),
      ]),
    )
  }

  return value
}

/**
 * Strip operator identity from a provider CLI's output.
 *
 * JSON payloads keep their shape so machine consumers still parse them; only
 * identity-bearing values are replaced. Non-JSON output falls back to pattern
 * redaction of email addresses and UUIDs.
 */
export function redactIdentity(value: string | undefined): string | undefined {
  if (value === undefined) return undefined

  const trimmed = value.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        return JSON.stringify(redactJsonValue(parsed, false), null, 2)
      }
    } catch {
      // Not JSON after all; fall through to pattern redaction.
    }
  }

  return redactFreeText(value)
}
