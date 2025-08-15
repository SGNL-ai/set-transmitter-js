export const EventTypes = {
  SESSION_REVOKED: 'https://schemas.openid.net/secevent/caep/event-type/session-revoked',
  TOKEN_CLAIMS_CHANGE: 'https://schemas.openid.net/secevent/caep/event-type/token-claims-change',
  CREDENTIAL_CHANGE: 'https://schemas.openid.net/secevent/caep/event-type/credential-change',
  ASSURANCE_LEVEL_CHANGE:
    'https://schemas.openid.net/secevent/caep/event-type/assurance-level-change',
  DEVICE_COMPLIANCE_CHANGE:
    'https://schemas.openid.net/secevent/caep/event-type/device-compliance-change',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

export const CONTENT_TYPE_SET = 'application/secevent+jwt';
export const CONTENT_TYPE_JSON = 'application/json';
export const DEFAULT_USER_AGENT = 'SGNL-Action-Framework/1.0';
