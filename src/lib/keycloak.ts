import Keycloak from 'keycloak-js';

export type KeycloakPublicConfig = {
  enabled: boolean;
  url?: string;
  realm?: string;
  clientId?: string;
};

let client: Keycloak | null = null;
let ready: Promise<boolean> | null = null;

export function keycloakClient(config: KeycloakPublicConfig): Keycloak {
  if (!config.enabled || !config.url || !config.realm || !config.clientId) {
    throw new Error('Keycloak is not configured');
  }
  if (!client) {
    client = new Keycloak({ url: config.url, realm: config.realm, clientId: config.clientId });
  }
  return client;
}

export function ensureKeycloak(config: KeycloakPublicConfig): Promise<boolean> {
  const instance = keycloakClient(config);
  if (!ready) {
    ready = instance.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });
  }
  return ready;
}

export async function logoutKeycloak(): Promise<boolean> {
  if (!client?.authenticated) return false;
  await client.logout({ redirectUri: window.location.origin });
  return true;
}
