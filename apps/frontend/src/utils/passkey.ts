import { apiClient } from '../api/client';
import {
  PasskeyDto,
  PasskeyRegistrationOptions,
  PasskeyAuthenticationOptions,
} from '@quiz-forge/shared';

export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Register a new passkey for the currently authenticated user
 */
export async function registerPasskey(nickname?: string): Promise<PasskeyDto> {
  if (!isPasskeySupported()) {
    throw new Error('WebAuthn / Passkeys are not supported in this browser.');
  }

  // 1. Fetch registration options from server (apiClient unwraps response data)
  const rawOptions = await apiClient.post<PasskeyRegistrationOptions>(
    '/api/auth/passkey/register-options'
  );
  const options = { ...rawOptions };
  if (options.excludeCredentials && options.excludeCredentials.length === 0) {
    delete (options as any).excludeCredentials;
  }

  // 2. Parse creation options
  let publicKey: PublicKeyCredentialCreationOptions;
  if (typeof (PublicKeyCredential as any).parseCreationOptionsFromJSON === 'function') {
    publicKey = (PublicKeyCredential as any).parseCreationOptionsFromJSON(options);
  } else {
    // Fallback manual buffer conversion
    publicKey = {
      ...options,
      challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
        c.charCodeAt(0)
      ),
      user: {
        ...options.user,
        id: Uint8Array.from(atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
          c.charCodeAt(0)
        ),
      },
      excludeCredentials: options.excludeCredentials?.map((cred) => ({
        ...cred,
        id: Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
          c.charCodeAt(0)
        ),
      })),
    } as any;
  }

  // 3. Prompt user for biometric / security key creation
  let credential: any;
  try {
    credential = await navigator.credentials.create({ publicKey });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'InvalidStateError') {
        throw new Error('A passkey for this device or account is already registered.');
      }
      if (err.name === 'NotAllowedError') {
        throw new Error('Passkey creation was cancelled or timed out.');
      }
    }
    throw err;
  }

  if (!credential) {
    throw new Error('Passkey creation returned empty credential.');
  }

  // 4. Encode response to JSON
  let encodedResponse: any;
  if (typeof credential.toJSON === 'function') {
    encodedResponse = credential.toJSON();
  } else {
    // Fallback manual buffer encoding
    const rawIdBuffer = new Uint8Array(credential.rawId);
    const clientDataJSONBuffer = new Uint8Array(credential.response.clientDataJSON);
    const attestationObjectBuffer = new Uint8Array(credential.response.attestationObject);

    const toBase64Url = (bytes: Uint8Array) =>
      btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    encodedResponse = {
      id: credential.id,
      rawId: toBase64Url(rawIdBuffer),
      type: credential.type,
      response: {
        clientDataJSON: toBase64Url(clientDataJSONBuffer),
        attestationObject: toBase64Url(attestationObjectBuffer),
        transports: credential.response.getTransports ? credential.response.getTransports() : [],
      },
    };
  }

  // 5. Send to server for verification
  try {
    const verified = await apiClient.post<PasskeyDto>(
      '/api/auth/passkey/register-verify',
      {
        ...encodedResponse,
        nickname: nickname || undefined,
      }
    );
    return verified;
  } catch (serverErr) {
    // Modern Web Guidance: Signal unknown credential if server rejects
    if ((PublicKeyCredential as any).signalUnknownCredential) {
      try {
        await (PublicKeyCredential as any).signalUnknownCredential({
          rpId: options.rp.id,
          credentialId: encodedResponse.id,
        });
      } catch {
        // ignore signal errors
      }
    }
    throw serverErr;
  }
}

/**
 * Authenticate returning user using discoverable passkey
 */
export async function loginWithPasskey(): Promise<{ user: any; token: string }> {
  if (!isPasskeySupported()) {
    throw new Error('WebAuthn / Passkeys are not supported in this browser.');
  }

  // 1. Fetch authentication options from server (apiClient unwraps response data)
  const rawOptions = await apiClient.post<PasskeyAuthenticationOptions>(
    '/api/auth/passkey/login-options'
  );
  const options = { ...rawOptions };
  if (options.allowCredentials && options.allowCredentials.length === 0) {
    delete (options as any).allowCredentials;
  }

  // 2. Parse request options
  let publicKey: PublicKeyCredentialRequestOptions;
  if (typeof (PublicKeyCredential as any).parseRequestOptionsFromJSON === 'function') {
    publicKey = (PublicKeyCredential as any).parseRequestOptionsFromJSON(options);
  } else {
    publicKey = {
      ...options,
      challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
        c.charCodeAt(0)
      ),
      allowCredentials: options.allowCredentials?.map((cred) => ({
        ...cred,
        id: Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
          c.charCodeAt(0)
        ),
      })),
    } as any;
  }

  // 3. Prompt user for biometric verification
  let credential: any;
  try {
    credential = await navigator.credentials.get({ publicKey });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Passkey sign-in was cancelled or timed out.');
      }
      if (err.name === 'AbortError') {
        throw new Error('Passkey authentication was aborted.');
      }
    }
    throw err;
  }

  if (!credential) {
    throw new Error('Passkey authentication returned empty credential.');
  }

  // 4. Encode response to JSON
  let encodedResponse: any;
  if (typeof credential.toJSON === 'function') {
    encodedResponse = credential.toJSON();
  } else {
    const rawIdBuffer = new Uint8Array(credential.rawId);
    const clientDataJSONBuffer = new Uint8Array(credential.response.clientDataJSON);
    const authDataBuffer = new Uint8Array(credential.response.authenticatorData);
    const sigBuffer = new Uint8Array(credential.response.signature);

    const toBase64Url = (bytes: Uint8Array) =>
      btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    encodedResponse = {
      id: credential.id,
      rawId: toBase64Url(rawIdBuffer),
      type: credential.type,
      response: {
        clientDataJSON: toBase64Url(clientDataJSONBuffer),
        authenticatorData: toBase64Url(authDataBuffer),
        signature: toBase64Url(sigBuffer),
        userHandle: credential.response.userHandle
          ? toBase64Url(new Uint8Array(credential.response.userHandle))
          : null,
      },
    };
  }

  // 5. Send to server for verification
  try {
    const verified = await apiClient.post<{
      user: any;
      token: string;
    }>('/api/auth/passkey/login-verify', encodedResponse);
    return verified;
  } catch (err: any) {
    // Modern Web Guidance: Signal unknown credential if HTTP 404
    if (err?.status === 404 && (PublicKeyCredential as any).signalUnknownCredential) {
      try {
        await (PublicKeyCredential as any).signalUnknownCredential({
          rpId: options.rpId,
          credentialId: encodedResponse.id,
        });
      } catch {
        // ignore signal errors
      }
    }
    throw err;
  }
}

/**
 * Fetch all registered passkeys for current user
 */
export async function getRegisteredPasskeys(): Promise<{
  rpId: string;
  credentials: PasskeyDto[];
}> {
  return await apiClient.get<{
    rpId: string;
    credentials: PasskeyDto[];
  }>('/api/auth/passkey/credentials');
}

/**
 * Rename a passkey nickname
 */
export async function renamePasskey(id: string, name: string): Promise<PasskeyDto> {
  return await apiClient.put<PasskeyDto>(
    `/api/auth/passkey/credentials/${id}`,
    { name }
  );
}

/**
 * Delete a passkey
 */
export async function deletePasskey(id: string): Promise<void> {
  await apiClient.delete(`/api/auth/passkey/credentials/${id}`);
}
