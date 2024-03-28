import { z } from 'zod';
import { UNAVAILABLE_SPACE_SLUGS } from '$lib/const';
import { email, profileName } from './common';

const spaceName = z
  .string()
  .trim()
  .min(1, '스페이스 이름을 입력해주세요')
  .max(20, '스페이스 이름은 20자를 넘을 수 없어요');

const SpaceSlugSchema = z
  .string()
  .min(2, '스페이스 URL은 2글자 이상이어야 해요')
  .max(20, '스페이스 URL은 20자를 넘을 수 없어요')
  .regex(/^[\d._a-z]+$/, '영문 소문자, 숫자, ., _만 사용할 수 있어요')
  .refine((v) => !v.includes('..'), '.은 연속으로 사용할 수 없어요')
  .refine((v) => !v.startsWith('.') && !v.endsWith('.'), '.로 시작하거나 끝날 수 없어요')
  .refine(
    (v) => !UNAVAILABLE_SPACE_SLUGS.EXACT.includes(v) && !UNAVAILABLE_SPACE_SLUGS.CONTAIN.some((s) => v.includes(s)),
    '사용할 수 없는 URL이에요',
  );

export const CreateSpaceSchema = z.object({
  name: spaceName,
  slug: SpaceSlugSchema,
  iconId: z.string().optional(),
  profileName: profileName.optional(),
  profileAvatarId: z.string().optional(),
  isPublic: z.boolean(),
});

export const UpdateSpaceSchema = z.object({
  spaceId: z.string(),
  iconId: z.string().optional(),
  name: spaceName.optional(),
  slug: SpaceSlugSchema.optional(),
  description: z.string().max(200, '스페이스 소개는 200자를 넘을 수 없어요').optional(),
  // externalLinks: z.array(z.string().url()).optional(),
  isPublic: z.boolean().optional(),
});

export const CreateSpaceMemberInvitationSchema = z.object({
  spaceId: z.string(),
  email,
  role: z.enum(['ADMIN', 'MEMBER']),
});

export const AcceptSpaceMemberInvitationSchema = z.object({
  invitationId: z.string(),
  profileAvatarId: z.string().optional(),
  profileName: profileName.optional(),
});

export const UpdateSpaceProfileSchema = z.object({
  spaceId: z.string(),
  profileName,
  profileAvatarId: z.string(),
});
