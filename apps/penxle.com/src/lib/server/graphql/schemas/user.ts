import { webcrypto } from 'node:crypto';
import dayjs from 'dayjs';
import { and, desc, eq, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import qs from 'query-string';
import { random } from 'radash';
import * as R from 'radash';
import { match } from 'ts-pattern';
import {
  AuthScope,
  ContentFilterAction,
  ContentFilterCategory,
  PointKind,
  PostAgeRating,
  PostState,
  UserEmailVerificationKind,
  UserNotificationCategory,
  UserNotificationMethod,
  UserSingleSignOnAuthorizationType,
  UserSingleSignOnProvider,
  UserState,
} from '$lib/enums';
import { IntentionalError, NotFoundError, PermissionDeniedError } from '$lib/errors';
import {
  BookmarkGroups,
  database,
  Images,
  PointTransactions,
  PostLikes,
  PostPurchases,
  PostReactions,
  Posts,
  PostViews,
  Profiles,
  ProvisionedUsers,
  Revenues,
  RevenueWithdrawals,
  SpaceFollows,
  SpaceMembers,
  Spaces,
  TagFollows,
  UserContentFilterPreferences,
  UserEmailVerifications,
  UserEventEnrollments,
  UserMarketingConsents,
  UserNotificationPreferences,
  UserNotifications,
  UserPersonalIdentities,
  Users,
  UserSessions,
  UserSettlementIdentities,
  UserSingleSignOns,
  UserSpaceMutes,
  UserTagMutes,
  UserWithdrawalConfigs,
} from '$lib/server/database';
import { sendEmail } from '$lib/server/email';
import { LoginUser, UpdateUserEmail } from '$lib/server/email/templates';
import { coocon, google, naver, twitter } from '$lib/server/external-api';
import {
  createAccessToken,
  createRandomAvatar,
  decryptAES,
  directUploadImage,
  encryptAES,
  getUserPoint,
  getUserRevenue,
  isAdulthood,
  isGte15,
} from '$lib/server/utils';
import { getMonthlyWithdrawalDayjs } from '$lib/utils';
import {
  CreateUserSchema,
  DeleteUserSchema,
  IssueUserEmailAuthorizationUrlSchema,
  LoginUserSchema,
  UpdateUserEmailSchema,
  UpdateUserProfileSchema,
  VerifyPassportIdentitySchema,
  VerifySettlementIdentitySchema,
} from '$lib/validations';
import { builder } from '../builder';
import { createObjectRef } from '../utils';
import { BookmarkGroup } from './bookmark';
import { Image } from './image';
import { IUserNotification } from './notification';
import { PointTransaction } from './point';
import { Post } from './post';
import { Revenue, RevenueWithdrawal } from './revenue';
import { Space } from './space';
import { Tag } from './tag';

/**
 * * Types
 */

export const Profile = createObjectRef('Profile', Profiles);
Profile.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),

    avatar: t.field({ type: Image, resolve: (parent) => parent.avatarId }),
  }),
});

export const ProvisionedUser = createObjectRef('ProvisionedUser', ProvisionedUsers);
ProvisionedUser.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    name: t.exposeString('name', { nullable: true }),
    avatarUrl: t.exposeString('avatarUrl', { nullable: true }),
  }),
});

export const User = createObjectRef('User', Users);
User.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    state: t.expose('state', { type: UserState }),

    profile: t.field({
      type: Profile,
      resolve: (user) => user.profileId,
    }),

    contentFilterPreferences: t.field({
      type: [UserContentFilterPreference],
      resolve: async (user) => {
        const preferences = await database
          .select({ id: UserContentFilterPreferences.id })
          .from(UserContentFilterPreferences)
          .where(eq(UserContentFilterPreferences.userId, user.id));

        return preferences.map((preference) => preference.id);
      },
    }),

    notificationPreferences: t.field({
      type: [UserNotificationPreference],
      resolve: async (user) => {
        const preferences = await database
          .select({ id: UserNotificationPreferences.id })
          .from(UserNotificationPreferences)
          .where(eq(UserNotificationPreferences.userId, user.id));

        return preferences.map((preference) => preference.id);
      },
    }),

    marketingConsent: t.field({
      type: UserMarketingConsent,
      nullable: true,
      resolve: async (user) => {
        const consents = await database
          .select({ id: UserMarketingConsents.id })
          .from(UserMarketingConsents)
          .where(eq(UserMarketingConsents.userId, user.id));

        if (consents.length === 0) {
          return null;
        }

        return consents[0].id;
      },
    }),

    personalIdentity: t.field({
      type: UserPersonalIdentity,
      nullable: true,
      resolve: async (user) => {
        const identities = await database
          .select({ id: UserPersonalIdentities.id })
          .from(UserPersonalIdentities)
          .where(eq(UserPersonalIdentities.userId, user.id));

        if (identities.length === 0) {
          return null;
        }

        return identities[0].id;
      },
    }),

    singleSignOns: t.field({
      type: [UserSingleSignOn],
      resolve: async (user) => {
        const ssos = await database
          .select({ id: UserSingleSignOns.id })
          .from(UserSingleSignOns)
          .where(eq(UserSingleSignOns.userId, user.id));

        return ssos.map((sso) => sso.id);
      },
    }),

    bookmarkGroups: t.field({
      type: [BookmarkGroup],
      resolve: async (user) => {
        const groups = await database
          .select({ id: BookmarkGroups.id })
          .from(BookmarkGroups)
          .where(eq(BookmarkGroups.userId, user.id));

        return groups.map((group) => group.id);
      },
    }),

    isAdulthood: t.boolean({
      resolve: async (user) => {
        const identities = await database
          .select({ birthday: UserPersonalIdentities.birthday })
          .from(UserPersonalIdentities)
          .where(eq(UserPersonalIdentities.userId, user.id));

        if (identities.length === 0) {
          return false;
        }

        return isAdulthood(identities[0].birthday);
      },
    }),

    allowedAgeRating: t.field({
      type: [PostAgeRating],
      resolve: async (user) => {
        const identities = await database
          .select({ birthday: UserPersonalIdentities.birthday })
          .from(UserPersonalIdentities)
          .where(eq(UserPersonalIdentities.userId, user.id));

        if (identities.length === 0) {
          return ['ALL'] as const;
        }

        return R.sift([isAdulthood(identities[0].birthday) && 'R19', isGte15(identities[0].birthday) && 'R15', 'ALL']);
      },
    }),

    point: t.int({
      args: { kind: t.arg({ type: PointKind, required: false }) },
      resolve: async (user, args) => {
        return await getUserPoint({ userId: user.id, kind: args.kind ?? undefined });
      },
    }),

    points: t.field({
      type: [PointTransaction],
      resolve: async (user) => {
        const transactions = await database
          .select({ id: PointTransactions.id })
          .from(PointTransactions)
          .where(eq(PointTransactions.userId, user.id))
          .orderBy(desc(PointTransactions.createdAt));

        return transactions.map((transaction) => transaction.id);
      },
    }),

    spaces: t.field({
      type: [Space],
      resolve: async (user) => {
        const spaces = await database
          .select({ id: Spaces.id })
          .from(Spaces)
          .innerJoin(SpaceMembers, eq(Spaces.id, SpaceMembers.spaceId))
          .where(and(eq(SpaceMembers.userId, user.id), eq(Spaces.state, 'ACTIVE'), eq(SpaceMembers.state, 'ACTIVE')));

        return spaces.map((space) => space.id);
      },
    }),

    followedSpaces: t.field({
      type: [Space],
      resolve: async (user) => {
        const spaces = await database
          .select({ id: Spaces.id })
          .from(Spaces)
          .innerJoin(SpaceFollows, eq(Spaces.id, SpaceFollows.spaceId))
          .where(and(eq(SpaceFollows.userId, user.id), eq(Spaces.state, 'ACTIVE')));

        return spaces.map((space) => space.id);
      },
    }),

    mutedSpaces: t.field({
      type: [Space],
      resolve: async (user) => {
        const spaces = await database
          .select({ id: Spaces.id })
          .from(Spaces)
          .innerJoin(UserSpaceMutes, eq(Spaces.id, UserSpaceMutes.spaceId))
          .where(and(eq(UserSpaceMutes.userId, user.id), eq(Spaces.state, 'ACTIVE')));

        return spaces.map((space) => space.id);
      },
    }),

    followedTags: t.field({
      type: [Tag],
      resolve: async (user) => {
        const follows = await database
          .select({ tagId: TagFollows.id })
          .from(TagFollows)
          .where(and(eq(TagFollows.userId, user.id)));

        return follows.map((tag) => tag.tagId);
      },
    }),

    mutedTags: t.field({
      type: [Tag],
      resolve: async (user) => {
        const mutes = await database
          .select({ tagId: UserTagMutes.tagId })
          .from(UserTagMutes)
          .where(and(eq(UserTagMutes.userId, user.id)));

        return mutes.map((mute) => mute.tagId);
      },
    }),

    posts: t.field({
      type: [Post],
      args: { state: t.arg({ type: PostState, defaultValue: 'PUBLISHED' }) },
      resolve: async (user, args) => {
        const posts = await database
          .select({ id: Posts.id })
          .from(Posts)
          .where(and(eq(Posts.userId, user.id), eq(Posts.state, args.state)))
          .orderBy(desc(Posts.createdAt));

        return posts.map((post) => post.id);
      },
    }),

    recentlyViewedPosts: t.field({
      type: [Post],
      resolve: async (user) => {
        const posts = await database
          .selectDistinct({ id: Posts.id })
          .from(Posts)
          .innerJoin(PostViews, eq(PostViews.postId, Posts.id))
          .innerJoin(Spaces, eq(Spaces.id, Posts.spaceId))
          .innerJoin(SpaceMembers, eq(SpaceMembers.spaceId, Spaces.id))
          .where(
            and(
              eq(PostViews.userId, user.id),
              eq(Posts.state, 'PUBLISHED'),
              eq(Spaces.state, 'ACTIVE'),
              or(
                eq(Posts.visibility, 'PUBLIC'),
                eq(Posts.visibility, 'UNLISTED'),
                and(eq(Posts.visibility, 'SPACE'), eq(SpaceMembers.userId, user.id)),
              ),
              or(
                eq(Spaces.visibility, 'PUBLIC'),
                and(eq(Spaces.visibility, 'PRIVATE'), eq(SpaceMembers.userId, user.id)),
              ),
            ),
          )
          .orderBy(desc(PostViews.createdAt))
          .limit(100);

        return posts.map((post) => post.id);
      },
    }),

    likedPosts: t.field({
      type: [Post],
      resolve: async (user) => {
        const posts = await database
          .selectDistinct({ id: Posts.id })
          .from(Posts)
          .innerJoin(PostLikes, eq(PostLikes.postId, Posts.id))
          .innerJoin(Spaces, eq(Spaces.id, Posts.spaceId))
          .innerJoin(SpaceMembers, eq(SpaceMembers.spaceId, Spaces.id))
          .where(
            and(
              eq(PostLikes.userId, user.id),
              eq(Posts.state, 'PUBLISHED'),
              eq(Spaces.state, 'ACTIVE'),
              or(
                eq(Posts.visibility, 'PUBLIC'),
                eq(Posts.visibility, 'UNLISTED'),
                and(eq(Posts.visibility, 'SPACE'), eq(SpaceMembers.userId, user.id)),
              ),
              or(
                eq(Spaces.visibility, 'PUBLIC'),
                and(eq(Spaces.visibility, 'PRIVATE'), eq(SpaceMembers.userId, user.id)),
              ),
            ),
          )
          .orderBy(desc(PostLikes.createdAt));

        return posts.map((post) => post.id);
      },
    }),

    emojiReactedPosts: t.field({
      type: [Post],
      resolve: async (user) => {
        const posts = await database
          .selectDistinct({ id: Posts.id })
          .from(Posts)
          .innerJoin(PostReactions, eq(PostReactions.postId, Posts.id))
          .innerJoin(Spaces, eq(Spaces.id, Posts.spaceId))
          .innerJoin(SpaceMembers, eq(SpaceMembers.spaceId, Spaces.id))
          .where(
            and(
              eq(PostReactions.userId, user.id),
              eq(Posts.state, 'PUBLISHED'),
              eq(Spaces.state, 'ACTIVE'),
              or(
                eq(Posts.visibility, 'PUBLIC'),
                eq(Posts.visibility, 'UNLISTED'),
                and(eq(Posts.visibility, 'SPACE'), eq(SpaceMembers.userId, user.id)),
              ),
              or(
                eq(Spaces.visibility, 'PUBLIC'),
                and(eq(Spaces.visibility, 'PRIVATE'), eq(SpaceMembers.userId, user.id)),
              ),
            ),
          )
          .orderBy(desc(PostLikes.createdAt));

        return posts.map((post) => post.id);
      },
    }),

    purchasedPosts: t.field({
      type: [Post],
      resolve: async (user) => {
        const purchases = await database
          .select({ postId: PostPurchases.postId })
          .from(PostPurchases)
          .where(eq(PostPurchases.userId, user.id))
          .orderBy(desc(PostPurchases.createdAt));

        return purchases.map((purchase) => purchase.postId);
      },
    }),

    revenue: t.field({
      type: 'Int',
      args: { withdrawable: t.arg.boolean({ defaultValue: false }) },
      resolve: async (user, args) => {
        return await getUserRevenue({ userId: user.id, withdrawableOnly: args.withdrawable });
      },
    }),

    revenues: t.field({
      type: [Revenue],
      args: {
        page: t.arg.int({ defaultValue: 1 }),
        take: t.arg.int({ defaultValue: 10 }),
      },
      resolve: async (user, args) => {
        const revenues = await database
          .select({ id: Revenues.id })
          .from(Revenues)
          .where(eq(Revenues.userId, user.id))
          .orderBy(desc(Revenues.createdAt))
          .limit(args.take)
          .offset((args.page - 1) * args.take);

        return revenues.map((revenue) => revenue.id);
      },
    }),

    revenueWithdrawals: t.field({
      type: [RevenueWithdrawal],
      resolve: async (user) => {
        const withdrawals = await database
          .select({ id: RevenueWithdrawals.id })
          .from(RevenueWithdrawals)
          .where(eq(RevenueWithdrawals.userId, user.id))
          .orderBy(desc(RevenueWithdrawals.createdAt));

        return withdrawals.map((withdrawal) => withdrawal.id);
      },
    }),

    settlementIdentity: t.field({
      type: UserSettlementIdentity,
      nullable: true,
      resolve: async (user) => {
        const identities = await database
          .select({ id: UserSettlementIdentities.id })
          .from(UserSettlementIdentities)
          .where(eq(UserSettlementIdentities.userId, user.id));

        if (identities.length === 0) {
          return null;
        }

        return identities[0].id;
      },
    }),

    withdrawalConfig: t.field({
      type: UserWithdrawalConfig,
      nullable: true,
      resolve: async (user) => {
        const configs = await database
          .select({ id: UserWithdrawalConfigs.id })
          .from(UserWithdrawalConfigs)
          .where(eq(UserWithdrawalConfigs.userId, user.id));

        if (configs.length === 0) {
          return null;
        }

        return configs[0].id;
      },
    }),

    notifications: t.field({
      type: [IUserNotification],
      args: {
        unreadOnly: t.arg.boolean({ defaultValue: false }),
        category: t.arg({ type: UserNotificationCategory, required: false }),
      },
      resolve: async (user, args) => {
        const notifications = await database
          .select({ id: UserNotifications.id })
          .from(UserNotifications)
          .where(
            and(
              eq(UserNotifications.userId, user.id),
              args.unreadOnly ? eq(UserNotifications.state, 'UNREAD') : undefined,
              args.category ? eq(UserNotifications.category, args.category) : undefined,
            ),
          )
          .orderBy(desc(UserNotifications.createdAt));

        return notifications.map((notification) => notification.id);
      },
    }),

    eventEnrollment: t.field({
      type: UserEventEnrollment,
      nullable: true,
      args: { eventCode: t.arg.string() },
      resolve: async (user, { eventCode }) => {
        const enrollments = await database
          .select({ id: UserEventEnrollments.id })
          .from(UserEventEnrollments)
          .where(and(eq(UserEventEnrollments.userId, user.id), eq(UserEventEnrollments.eventCode, eventCode)));

        if (enrollments.length === 0) {
          return null;
        }

        return enrollments[0].id;
      },
    }),
  }),
});

export const UserContentFilterPreference = createObjectRef('UserContentFilterPreference', UserContentFilterPreferences);
UserContentFilterPreference.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    category: t.expose('category', { type: ContentFilterCategory }),
    action: t.expose('action', { type: ContentFilterAction }),
  }),
});

export const UserEmailVerification = createObjectRef('UserEmailVerification', UserEmailVerifications);
UserEmailVerification.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    kind: t.expose('kind', { type: UserEmailVerificationKind }),
    email: t.exposeString('email'),
    expiresAt: t.expose('expiresAt', { type: 'DateTime' }),
  }),
});

export const UserMarketingConsent = createObjectRef('UserMarketingConsent', UserMarketingConsents);
UserMarketingConsent.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

export const UserNotificationPreference = createObjectRef('UserNotificationPreference', UserNotificationPreferences);
UserNotificationPreference.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    category: t.expose('category', { type: UserNotificationCategory }),
    method: t.expose('method', { type: UserNotificationMethod }),
    opted: t.exposeBoolean('opted'),
  }),
});

export const UserPersonalIdentity = createObjectRef('UserPersonalIdentity', UserPersonalIdentities);
UserPersonalIdentity.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    birthday: t.expose('birthday', { type: 'DateTime' }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

export const UserSingleSignOn = createObjectRef('UserSingleSignOn', UserSingleSignOns);
UserSingleSignOn.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    provider: t.expose('provider', { type: UserSingleSignOnProvider }),
    email: t.exposeString('email'),
  }),
});

export const UserSettlementIdentity = createObjectRef('UserSettlementIdentity', UserSettlementIdentities);
UserSettlementIdentity.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    bankCode: t.exposeString('bankCode'),
    bankAccountNumber: t.exposeString('bankAccountNumber'),
    bankAccountHolderName: t.string({
      resolve: async ({ bankAccountHolderName }) => {
        if (bankAccountHolderName.length <= 1) {
          return '*';
        } else if (bankAccountHolderName.length === 2) {
          return bankAccountHolderName.at(0) + '*';
        } else {
          return (
            bankAccountHolderName.at(0) + '*'.repeat(bankAccountHolderName.length - 2) + bankAccountHolderName.at(-1)
          );
        }
      },
    }),
  }),
});

export const UserWithdrawalConfig = createObjectRef('UserWithdrawalConfig', UserWithdrawalConfigs);
UserWithdrawalConfig.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    monthlyWithdrawalEnabled: t.exposeBoolean('monthlyWithdrawalEnabled'),
    monthlyWithdrawalDue: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: async ({ userId, monthlyWithdrawalEnabled }) => {
        if (!monthlyWithdrawalEnabled) {
          return null;
        }

        const revenueAmount = await getUserRevenue({ userId, monthlyWithdrawableOnly: true });
        if (revenueAmount < 30_000) {
          return null;
        }

        return getMonthlyWithdrawalDayjs().add(dayjs().kst().date() > 10 ? 1 : 0, 'month');
      },
    }),
  }),
});

export const UserEventEnrollment = createObjectRef('UserEventEnrollment', UserEventEnrollments);
UserEventEnrollment.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    eventCode: t.exposeString('eventCode'),
    eligible: t.exposeBoolean('eligible'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    rewardedAt: t.expose('rewardedAt', { type: 'DateTime', nullable: true }),
  }),
});

const IssueUserSingleSignOnAuthorizationUrlResult = builder.simpleObject(
  'IssueUserSingleSignOnAuthorizationUrlResult',
  {
    fields: (t) => ({
      url: t.string(),
    }),
  },
);

const IssueUserEmailAuthorizationUrlResult = builder.simpleObject('IssueUserEmailAuthorizationUrlResult', {
  fields: (t) => ({
    url: t.string(),
  }),
});

/**
 * * Inputs
 */

const IssueUserSingleSignOnAuthorizationUrlInput = builder.inputType('IssueUserSingleSignOnAuthorizationUrlInput', {
  fields: (t) => ({
    type: t.field({ type: UserSingleSignOnAuthorizationType }),
    provider: t.field({ type: UserSingleSignOnProvider }),
  }),
});

const LoginUserInput = builder.inputType('LoginUserInput', {
  fields: (t) => ({
    email: t.string(),
  }),
  validate: { schema: LoginUserSchema },
});

const CreateUserInput = builder.inputType('CreateUserInput', {
  fields: (t) => ({
    token: t.string(),
    name: t.string(),
    termsConsent: t.boolean(),
    marketingConsent: t.boolean(),
  }),
  validate: { schema: CreateUserSchema },
});

const UpdateUserEmailInput = builder.inputType('UpdateUserEmailInput', {
  fields: (t) => ({
    email: t.string(),
  }),
  validate: { schema: UpdateUserEmailSchema },
});

const UnlinkUserSingleSignOnInput = builder.inputType('UnlinkUserSingleSignOnInput', {
  fields: (t) => ({
    provider: t.field({ type: UserSingleSignOnProvider }),
  }),
});

const UpdateUserContentFilterPreferenceInput = builder.inputType('UpdateUserContentFilterPreferenceInput', {
  fields: (t) => ({
    category: t.field({ type: ContentFilterCategory }),
    action: t.field({ type: ContentFilterAction }),
  }),
});

const UpdateUserMarketingConsentInput = builder.inputType('UpdateUserMarketingConsentInput', {
  fields: (t) => ({
    consent: t.boolean(),
  }),
});

const UpdateUserNotificationPreferenceInput = builder.inputType('UpdateUserNotificationPreferenceInput', {
  fields: (t) => ({
    category: t.field({ type: UserNotificationCategory }),
    method: t.field({ type: UserNotificationMethod }),
    opted: t.boolean(),
  }),
});

const UpdateUserProfileInput = builder.inputType('UpdateUserProfileInput', {
  fields: (t) => ({
    avatarId: t.id(),
    name: t.string(),
  }),
  validate: { schema: UpdateUserProfileSchema },
});

const IssueUserEmailAuthorizationUrlInput = builder.inputType('IssueUserEmailAuthorizationUrlInput', {
  fields: (t) => ({
    email: t.string(),
    code: t.string(),
  }),
  validate: { schema: IssueUserEmailAuthorizationUrlSchema },
});

const DeleteUserInput = builder.inputType('DeleteUserInput', {
  fields: (t) => ({
    email: t.string(),
  }),
  validate: { schema: DeleteUserSchema },
});

const VerifySettlementIdentityInput = builder.inputType('VerifySettlementIdentityInput', {
  fields: (t) => ({
    residentRegistrationNumberBack: t.string(),
    idCardIssuedDate: t.string(),
    bankCode: t.string(),
    bankAccountNumber: t.string(),
  }),
  validate: { schema: VerifySettlementIdentitySchema },
});

const VerifyPassportIdentityInput = builder.inputType('VerifyPassportIdentityInput', {
  fields: (t) => ({
    name: t.string(),
    birthday: t.string(),
    passportNumber: t.string(),
    issuedDate: t.string(),
    expirationDate: t.string(),
  }),
  validate: { schema: VerifyPassportIdentitySchema },
});

/**
 * * Queries
 */

builder.queryFields((t) => ({
  auth: t.field({
    type: 'Void',
    nullable: true,
    authScopes: (_, args) => ({ [args.scope.toLowerCase()]: true }),
    args: { scope: t.arg({ type: AuthScope }) },
    resolve: () => null,
    unauthorizedError: (_, args) =>
      match(args.scope)
        .with('USER', () => new IntentionalError('로그인이 필요해요'))
        .otherwise(() => new PermissionDeniedError()),
  }),

  me: t.field({
    type: User,
    nullable: true,
    resolve: async (_, __, context) => {
      return context.session?.userId ?? null;
    },
  }),

  provisionedUser: t.field({
    type: ProvisionedUser,
    args: { token: t.arg.string() },
    resolve: async (_, args) => {
      const users = await database
        .select({ id: ProvisionedUsers.id })
        .from(ProvisionedUsers)
        .where(eq(ProvisionedUsers.token, args.token));

      if (users.length === 0) {
        throw new NotFoundError();
      }

      return users[0].id;
    },
  }),
}));

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  loginUser: t.field({
    type: UserEmailVerification,
    args: { input: t.arg({ type: LoginUserInput }) },
    resolve: async (_, { input }, context) => {
      const users = await database
        .select({ id: Users.id })
        .from(Users)
        .where(and(eq(Users.email, input.email.toLowerCase()), eq(Users.state, 'ACTIVE')));

      const isEmailExists = users.length > 0;

      const code = random(100_000, 999_999).toString();
      const token = nanoid();

      const [verification] = await database
        .insert(UserEmailVerifications)
        .values({
          kind: 'USER_LOGIN',
          email: input.email.toLowerCase(),
          token,
          code,
          expiresAt: dayjs().add(1, 'hour'),
        })
        .returning({ id: UserEmailVerifications.id });

      await sendEmail({
        subject: `펜슬 ${isEmailExists ? '로그인' : '가입'}하기`,
        recipient: input.email,
        template: LoginUser,
        props: {
          action: isEmailExists ? '로그인' : '가입',
          code,
          url: qs.stringifyUrl({
            url: `${context.event.url.origin}/api/email`,
            query: { token },
          }),
        },
      });

      return verification.id;
    },
  }),

  logoutUser: t.withAuth({ user: true }).field({
    type: 'Void',
    nullable: true,
    resolve: async (_, __, context) => {
      await database.delete(UserSessions).where(eq(UserSessions.id, context.session.id));

      context.event.cookies.delete('penxle-at', { path: '/' });
    },
  }),

  issueUserEmailAuthorizationUrl: t.field({
    type: IssueUserEmailAuthorizationUrlResult,
    args: { input: t.arg({ type: IssueUserEmailAuthorizationUrlInput }) },
    resolve: async (_, { input }, context) => {
      const emailVerifications = await database
        .select({ token: UserEmailVerifications.token })
        .from(UserEmailVerifications)
        .where(
          and(
            eq(UserEmailVerifications.kind, 'USER_LOGIN'),
            eq(UserEmailVerifications.email, input.email),
            eq(UserEmailVerifications.code, input.code),
          ),
        );

      if (emailVerifications.length === 0) {
        throw new IntentionalError('올바르지 않은 코드예요.');
      }

      return {
        url: qs.stringifyUrl({
          url: `${context.event.url.origin}/api/email`,
          query: { token: emailVerifications[0].token },
        }),
      };
    },
  }),

  createUser: t.field({
    type: User,
    args: { input: t.arg({ type: CreateUserInput }) },
    resolve: async (_, { input }, context) => {
      const provisionedUsers = await database
        .select({
          id: ProvisionedUsers.id,
          email: ProvisionedUsers.email,
          token: ProvisionedUsers.token,
          provider: ProvisionedUsers.provider,
          principal: ProvisionedUsers.principal,
        })
        .from(ProvisionedUsers)
        .where(eq(ProvisionedUsers.token, input.token));

      if (provisionedUsers.length === 0) {
        throw new IntentionalError('올바르지 않은 토큰이에요.');
      }

      const [provisionedUser] = provisionedUsers;

      const emailUsages = await database
        .select({ id: Users.id })
        .from(Users)
        .where(and(eq(Users.email, provisionedUser.email.toLowerCase()), eq(Users.state, 'ACTIVE')));

      if (emailUsages.length > 0) {
        throw new IntentionalError('이미 가입된 이메일이에요.');
      }

      const avatarId = await directUploadImage({
        name: 'avatar',
        source: await createRandomAvatar(),
      });

      return await database.transaction(async (tx) => {
        const [profile] = await tx
          .insert(Profiles)
          .values({ name: input.name, avatarId })
          .returning({ id: Profiles.id });

        const [user] = await tx
          .insert(Users)
          .values({
            email: provisionedUser.email,
            profileId: profile.id,
            role: 'USER',
            state: 'ACTIVE',
          })
          .returning({ id: Users.id });

        await tx.update(Images).set({ userId: user.id }).where(eq(Images.id, avatarId));

        if (input.marketingConsent) {
          await tx.insert(UserMarketingConsents).values({ userId: user.id });
        }

        if (provisionedUser.provider && provisionedUser.principal) {
          await tx.insert(UserSingleSignOns).values({
            userId: user.id,
            provider: provisionedUser.provider,
            principal: provisionedUser.principal,
            email: provisionedUser.email.toLowerCase(),
          });
        }

        await tx.delete(ProvisionedUsers).where(eq(ProvisionedUsers.id, provisionedUser.id));

        const [session] = await tx.insert(UserSessions).values({ userId: user.id }).returning({ id: UserSessions.id });

        const accessToken = await createAccessToken(session.id);
        context.event.cookies.set('penxle-at', accessToken, {
          path: '/',
          maxAge: dayjs.duration(1, 'year').asSeconds(),
        });

        return user.id;
      });
    },
  }),

  issueUserSingleSignOnAuthorizationUrl: t.field({
    type: IssueUserSingleSignOnAuthorizationUrlResult,
    args: { input: t.arg({ type: IssueUserSingleSignOnAuthorizationUrlInput }) },
    resolve: async (_, { input }, context) => {
      const provider = match(input.provider)
        .with('GOOGLE', () => google)
        .with('NAVER', () => naver)
        .with('TWITTER', () => twitter)
        .exhaustive();

      return {
        url: await provider.generateAuthorizationUrl(context.event, input.type),
      };
    },
  }),

  updateUserEmail: t.withAuth({ user: true }).field({
    type: 'Void',
    nullable: true,
    args: { input: t.arg({ type: UpdateUserEmailInput }) },
    resolve: async (_, { input }, context) => {
      const emailUsages = await database
        .select({ id: Users.id })
        .from(Users)
        .where(and(eq(Users.email, input.email.toLowerCase()), eq(Users.state, 'ACTIVE')));

      if (emailUsages.length > 0) {
        return;
      }

      const users = await database
        .select({ profile: { name: Profiles.name } })
        .from(Users)
        .innerJoin(Profiles, eq(Users.profileId, Profiles.id))
        .where(eq(Users.id, context.session.userId));

      if (users.length === 0) {
        throw new IntentionalError('사용자를 찾을 수 없어요.');
      }

      const token = nanoid();

      await database.insert(UserEmailVerifications).values({
        userId: context.session.userId,
        kind: 'USER_EMAIL_UPDATE',
        email: input.email.toLowerCase(),
        token,
        expiresAt: dayjs().add(1, 'hour'),
      });

      await sendEmail({
        subject: 'PENXLE 이메일 변경',
        recipient: input.email,
        template: UpdateUserEmail,
        props: {
          name: users[0].profile.name,
          email: input.email,
          url: qs.stringifyUrl({
            url: `${context.event.url.origin}/api/email`,
            query: { token },
          }),
        },
      });
    },
  }),

  updateUserProfile: t.withAuth({ user: true }).field({
    type: Profile,
    args: { input: t.arg({ type: UpdateUserProfileInput }) },
    resolve: async (_, { input }, context) => {
      const avatars = await database
        .select({ id: Images.id })
        .from(Images)
        .where(and(eq(Images.id, input.avatarId), eq(Images.userId, context.session.userId)));

      if (avatars.length === 0) {
        throw new IntentionalError('올바르지 않은 프로필 사진이에요.');
      }

      const profiles = database
        .select({ id: Profiles.id })
        .from(Users)
        .innerJoin(Profiles, eq(Profiles.id, Users.profileId))
        .where(eq(Users.id, context.session.userId))
        .as('sq');

      const [profile] = await database
        .update(Profiles)
        .set({ avatarId: input.avatarId, name: input.name })
        .where(eq(Profiles.id, profiles.id))
        .returning({ id: Profiles.id });

      return profile.id;
    },
  }),

  updateUserMarketingConsent: t.withAuth({ user: true }).field({
    type: User,
    args: { input: t.arg({ type: UpdateUserMarketingConsentInput }) },
    resolve: async (_, { input }, context) => {
      await (input.consent
        ? database.insert(UserMarketingConsents).values({ userId: context.session.userId }).onConflictDoNothing()
        : database.delete(UserMarketingConsents).where(eq(UserMarketingConsents.userId, context.session.userId)));

      return context.session.userId;
    },
  }),

  unlinkUserSingleSignOn: t.withAuth({ user: true }).field({
    type: User,
    args: { input: t.arg({ type: UnlinkUserSingleSignOnInput }) },
    resolve: async (_, { input }, context) => {
      await database
        .delete(UserSingleSignOns)
        .where(
          and(eq(UserSingleSignOns.userId, context.session.userId), eq(UserSingleSignOns.provider, input.provider)),
        );

      return context.session.userId;
    },
  }),

  updateUserNotificationPreference: t.withAuth({ user: true }).field({
    type: User,
    args: { input: t.arg({ type: UpdateUserNotificationPreferenceInput }) },
    resolve: async (_, { input }, context) => {
      await database.transaction(async (tx) => {
        if (input.category === 'ALL') {
          await tx
            .update(UserNotificationPreferences)
            .set({ opted: input.opted })
            .where(
              and(
                eq(UserNotificationPreferences.userId, context.session.userId),
                eq(UserNotificationPreferences.method, input.method),
              ),
            );
        }

        await tx
          .insert(UserNotificationPreferences)
          .values({
            userId: context.session.userId,
            category: input.category,
            method: input.method,
            opted: input.opted,
          })
          .onConflictDoUpdate({
            target: [
              UserNotificationPreferences.userId,
              UserNotificationPreferences.category,
              UserNotificationPreferences.method,
            ],
            set: { opted: input.opted },
          });
      });

      return context.session.userId;
    },
  }),

  updateUserContentFilterPreference: t.withAuth({ user: true }).field({
    type: User,
    args: { input: t.arg({ type: UpdateUserContentFilterPreferenceInput }) },
    resolve: async (_, { input }, context) => {
      if (input.category === 'ADULT' && input.action === 'EXPOSE') {
        const identities = await database
          .select({ birthday: UserPersonalIdentities.birthday })
          .from(UserPersonalIdentities)
          .where(eq(UserPersonalIdentities.userId, context.session.userId));

        if (identities.length === 0 || !isAdulthood(identities[0].birthday)) {
          throw new IntentionalError('성인인증이 필요해요.');
        }
      }

      await database
        .insert(UserContentFilterPreferences)
        .values({
          userId: context.session.userId,
          category: input.category,
          action: input.action,
        })
        .onConflictDoUpdate({
          target: [UserContentFilterPreferences.userId, UserContentFilterPreferences.category],
          set: { action: input.action },
        });

      return context.session.userId;
    },
  }),

  deleteUser: t.withAuth({ user: true }).field({
    type: 'Void',
    nullable: true,
    args: { input: t.arg({ type: DeleteUserInput }) },
    resolve: async (_, { input }, context) => {
      const users = await database
        .select({ email: Users.email })
        .from(Users)
        .where(eq(Users.id, context.session.userId));

      if (users.length === 0) {
        throw new IntentionalError('사용자를 찾을 수 없어요.');
      }

      if (users[0].email !== input.email.toLowerCase()) {
        throw new IntentionalError('이메일이 일치하지 않아요.');
      }

      const spaceMembers = await database
        .select({ id: SpaceMembers.id })
        .from(SpaceMembers)
        .where(and(eq(SpaceMembers.userId, context.session.userId), eq(SpaceMembers.state, 'ACTIVE')));

      if (spaceMembers.length > 0) {
        throw new IntentionalError('아직 속해있는 스페이스가 있어요');
      }

      await database.transaction(async (tx) => {
        await tx.delete(UserSessions).where(eq(UserSessions.userId, context.session.userId));
        await tx.delete(UserSingleSignOns).where(eq(UserSingleSignOns.userId, context.session.userId));
        await tx.update(Users).set({ state: 'INACTIVE' }).where(eq(Users.id, context.session.userId));
      });

      context.event.cookies.delete('penxle-at', { path: '/' });
    },
  }),

  verifySettlementIdentity: t.withAuth({ user: true }).field({
    type: UserSettlementIdentity,
    args: { input: t.arg({ type: VerifySettlementIdentityInput }) },
    resolve: async (_, { input }, context) => {
      const personalIdentities = await database
        .select({ name: UserPersonalIdentities.name, birthday: UserPersonalIdentities.birthday })
        .from(UserPersonalIdentities)
        .where(eq(UserPersonalIdentities.userId, context.session.userId));

      if (personalIdentities.length === 0) {
        throw new IntentionalError('먼저 본인인증을 해주세요');
      }

      const [personalIdentity] = personalIdentities;

      const residentRegistrationNumber = `${personalIdentity.birthday.kst().format('YYMMDD')}${
        input.residentRegistrationNumberBack
      }`;

      const rrnVerification = await coocon.verifyResidentRegistrationNumber({
        name: personalIdentity.name,
        residentRegistrationNumber,
        issuedDate: input.idCardIssuedDate,
      });

      if (!rrnVerification.success) {
        throw new IntentionalError('주민등록증 인증에 실패했어요');
      }

      const accountHolderName = await coocon.getAccountHolderName({
        bankCode: input.bankCode,
        accountNumber: input.bankAccountNumber,
      });

      if (
        !personalIdentity.name
          .replaceAll(' ', '')
          .toLowerCase()
          .startsWith(accountHolderName.replaceAll(' ', '').toLowerCase())
      ) {
        throw new IntentionalError('예금주가 일치하지 않아요');
      }

      const settlementIdentities = await database
        .select({
          encryptedResidentRegistrationNumber: UserSettlementIdentities.encryptedResidentRegistrationNumber,
          encryptedResidentRegistrationNumberNonce: UserSettlementIdentities.encryptedResidentRegistrationNumberNonce,
        })
        .from(UserSettlementIdentities)
        .where(eq(UserSettlementIdentities.userId, context.session.userId));

      if (settlementIdentities.length > 0) {
        const previousRRN = await decryptAES(
          settlementIdentities[0].encryptedResidentRegistrationNumber,
          settlementIdentities[0].encryptedResidentRegistrationNumberNonce,
        );

        if (previousRRN !== residentRegistrationNumber) {
          throw new IntentionalError('주민등록번호를 변경한 경우에는 문의를 남겨주세요');
        }

        const [settlementIdentity] = await database
          .update(UserSettlementIdentities)
          .set({ bankCode: input.bankCode, bankAccountNumber: input.bankAccountNumber })
          .where(eq(UserSettlementIdentities.userId, context.session.userId))
          .returning({ id: UserSettlementIdentities.id });

        return settlementIdentity.id;
      } else {
        const { encrypted, nonce } = await encryptAES(residentRegistrationNumber);
        const hash = Buffer.from(
          await webcrypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(`penxle_rrn_hash_${residentRegistrationNumber}`),
          ),
        ).toString('hex');

        const [settlementIdentity] = await database
          .insert(UserSettlementIdentities)
          .values({
            userId: context.session.userId,
            encryptedResidentRegistrationNumber: encrypted,
            encryptedResidentRegistrationNumberNonce: nonce,
            residentRegistrationNumberHash: hash,
            bankCode: input.bankCode,
            bankAccountNumber: input.bankAccountNumber,
            bankAccountHolderName: accountHolderName,
          })
          .returning({ id: UserSettlementIdentities.id });

        return settlementIdentity.id;
      }
    },
  }),

  verifyPassportIdentity: t.withAuth({ user: true }).field({
    type: User,
    args: { input: t.arg({ type: VerifyPassportIdentityInput }) },
    resolve: async (_, { input }, context) => {
      const personalIdentities = await database
        .select({ id: UserPersonalIdentities.id })
        .from(UserPersonalIdentities)
        .where(eq(UserPersonalIdentities.userId, context.session.userId));

      if (personalIdentities.length > 0) {
        throw new IntentionalError('이미 본인인증된 계정이에요');
      }

      const passportVerification = await coocon.verifyPassportNumber({
        name: input.name,
        birthday: input.birthday,
        passportNumber: input.passportNumber,
        issuedDate: input.issuedDate,
        expirationDate: input.expirationDate,
      });

      if (!passportVerification.success) {
        throw new IntentionalError('여권 인증에 실패했어요');
      }

      await database.insert(UserPersonalIdentities).values({
        userId: context.session.userId,
        kind: 'PASSPORT',
        name: input.name,
        birthday: dayjs.kst(input.birthday, 'YYYYMMDD'),
        ci: input.passportNumber,
      });

      return context.session.userId;
    },
  }),
}));
