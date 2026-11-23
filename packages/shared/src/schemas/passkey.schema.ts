import { z } from 'zod';

export const passkeyDeviceTypeEnum = z.enum(['singleDevice', 'multiDevice']);
export type PasskeyDeviceType = z.infer<typeof passkeyDeviceTypeEnum>;

export const passkeyDtoSchema = z.object({
  id: z.string(), // Base64URL-encoded credential ID
  userId: z.string(),
  name: z.string(),
  deviceType: passkeyDeviceTypeEnum.default('multiDevice'),
  backedUp: z.boolean().default(false),
  aaguid: z.string().optional().nullable(),
  transports: z.array(z.string()).default([]),
  registeredAt: z.string(),
  lastUsedAt: z.string().optional().nullable(),
});
export type PasskeyDto = z.infer<typeof passkeyDtoSchema>;

export const passkeyRegistrationOptionsSchema = z.object({
  challenge: z.string(), // Base64URL
  rp: z.object({
    id: z.string(),
    name: z.string(),
  }),
  user: z.object({
    id: z.string(), // Base64URL
    name: z.string(),
    displayName: z.string(),
  }),
  pubKeyCredParams: z.array(
    z.object({
      type: z.literal('public-key'),
      alg: z.number(), // e.g. -7 (ES256), -257 (RS256)
    })
  ),
  timeout: z.number().default(60000),
  excludeCredentials: z
    .array(
      z.object({
        type: z.literal('public-key'),
        id: z.string(),
        transports: z.array(z.string()).optional(),
      })
    )
    .default([]),
  authenticatorSelection: z.object({
    residentKey: z.enum(['discouraged', 'preferred', 'required']).default('required'),
    requireResidentKey: z.boolean().default(true),
    userVerification: z.enum(['discouraged', 'preferred', 'required']).default('preferred'),
    authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  }),
  attestation: z.enum(['none', 'indirect', 'direct', 'enterprise']).default('none'),
});
export type PasskeyRegistrationOptions = z.infer<typeof passkeyRegistrationOptionsSchema>;

export const passkeyRegistrationVerifyInputSchema = z.object({
  id: z.string(), // Base64URL
  rawId: z.string(),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: z.string(), // Base64URL
    attestationObject: z.string(), // Base64URL
    transports: z.array(z.string()).optional(),
  }),
  clientExtensionResults: z.any().optional(),
  nickname: z.string().min(1).max(50).optional(),
});
export type PasskeyRegistrationVerifyInput = z.infer<typeof passkeyRegistrationVerifyInputSchema>;

export const passkeyAuthenticationOptionsSchema = z.object({
  challenge: z.string(), // Base64URL
  rpId: z.string(),
  timeout: z.number().default(60000),
  allowCredentials: z
    .array(
      z.object({
        type: z.literal('public-key'),
        id: z.string(),
        transports: z.array(z.string()).optional(),
      })
    )
    .default([]),
  userVerification: z.enum(['discouraged', 'preferred', 'required']).default('preferred'),
});
export type PasskeyAuthenticationOptions = z.infer<typeof passkeyAuthenticationOptionsSchema>;

export const passkeyAuthenticationVerifyInputSchema = z.object({
  id: z.string(), // Base64URL credential ID
  rawId: z.string(),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: z.string(), // Base64URL
    authenticatorData: z.string(), // Base64URL
    signature: z.string(), // Base64URL
    userHandle: z.string().nullable().optional(),
  }),
  clientExtensionResults: z.any().optional(),
});
export type PasskeyAuthenticationVerifyInput = z.infer<typeof passkeyAuthenticationVerifyInputSchema>;

export const renamePasskeyInputSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(50, 'Name too long'),
});
export type RenamePasskeyInput = z.infer<typeof renamePasskeyInputSchema>;
