import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type KeycloakSettings = {
  enabled: true;
  url: string;
  internalUrl: string;
  realm: string;
  clientId: string;
  issuer: string;
};

export function keycloakSettings(): KeycloakSettings | { enabled: false } {
  const url = process.env.KEYCLOAK_URL?.replace(/\/$/, '');
  if (!url) return { enabled: false };
  const realm = process.env.KEYCLOAK_REALM || 'atom';
  const clientId = process.env.KEYCLOAK_CLIENT_ID || 'atom-web';
  const internalUrl = (process.env.KEYCLOAK_INTERNAL_URL || url).replace(/\/$/, '');
  return {
    enabled: true,
    url,
    internalUrl,
    realm,
    clientId,
    issuer: `${url}/realms/${realm}`,
  };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksUrl = '';

export async function verifyKeycloakAccessToken(accessToken: string): Promise<JWTPayload> {
  const settings = keycloakSettings();
  if (!settings.enabled) throw new Error('keycloak_not_configured');
  const certs = `${settings.internalUrl}/realms/${settings.realm}/protocol/openid-connect/certs`;
  if (!jwks || jwksUrl !== certs) {
    jwks = createRemoteJWKSet(new URL(certs));
    jwksUrl = certs;
  }
  const { payload } = await jwtVerify(accessToken, jwks, { issuer: settings.issuer });
  const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  const party = typeof payload.azp === 'string' ? payload.azp : '';
  if (party !== settings.clientId && !audiences.includes(settings.clientId)) {
    throw new Error('keycloak_client_mismatch');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) throw new Error('keycloak_subject_missing');
  return payload;
}
