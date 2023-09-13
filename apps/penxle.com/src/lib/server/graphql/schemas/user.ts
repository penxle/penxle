import { UserSSOProvider } from '@prisma/client';
import argon2 from 'argon2';
import dayjs from 'dayjs';
import { FormValidationError } from '$lib/errors';
import { sendEmail } from '$lib/server/email';
import {
  EmailChange,
  EmailChangeNotice,
  EmailVerification,
  PasswordReset,
  PasswordResetRequest,
} from '$lib/server/email/templates';
import { google } from '$lib/server/external-api';
import {
  createAccessToken,
  createRandomAvatar,
  directUploadImage,
  renderAvatar,
} from '$lib/server/utils';
import { createId } from '$lib/utils';
import {
  LoginInputSchema,
  RequestEmailUpdateInputSchema,
  RequestPasswordResetInputSchema,
  ResetPasswordInputSchema,
  SignUpInputSchema,
  UpdatePasswordInputSchema,
  UpdateUserProfileInputSchema,
} from '$lib/validations';
import { builder } from '../builder';

/**
 * * Types
 */

builder.prismaObject('User', {
  select: { id: true },
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email', { authScopes: (user) => ({ user }) }),

    profile: t.relation('profile'),

    spaces: t.prismaField({
      type: ['Space'],
      select: (_, __, nestedSelection) => ({
        spaces: {
          select: { space: nestedSelection() },
          where: { space: { state: 'ACTIVE' } },
        },
      }),
      resolve: (_, { spaces }) => spaces.map(({ space }) => space),
    }),
  }),
});

builder.prismaObject('Profile', {
  select: { id: true },
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),

    avatar: t.relation('avatar'),
  }),
});

builder.prismaObject('UserEmailVerification', {
  select: { id: true },
  fields: (t) => ({
    expiresAt: t.expose('expiresAt', {
      type: 'DateTime',
    }),
  }),
});

/**
 * * Enums
 */

builder.enumType(UserSSOProvider, { name: 'UserSSOProvider' });

/**
 * * Inputs
 */

const LoginInput = builder.inputType('LoginInput', {
  fields: (t) => ({
    email: t.string(),
    password: t.string(),
  }),
  validate: { schema: LoginInputSchema },
});

const SignUpInput = builder.inputType('SignUpInput', {
  fields: (t) => ({
    email: t.string(),
    password: t.string(),
    passwordConfirm: t.string(),
    name: t.string(),
    isAgreed: t.boolean(),
    isMarketingAgreed: t.boolean(),
  }),
  validate: { schema: SignUpInputSchema },
});

const IssueSSOAuthorizationUrlInput = builder.inputType(
  'IssueSSOAuthorizationUrlInput',
  {
    fields: (t) => ({
      provider: t.field({ type: UserSSOProvider }),
    }),
  },
);

const RequestPasswordResetInput = builder.inputType(
  'RequestPasswordResetInput',
  {
    fields: (t) => ({
      email: t.string(),
    }),
    validate: { schema: RequestPasswordResetInputSchema },
  },
);

const RequestEmailUpdateInput = builder.inputType('requestEmailUpdateInput', {
  fields: (t) => ({
    email: t.string(),
  }),
  validate: { schema: RequestEmailUpdateInputSchema },
});

const ResetPasswordInput = builder.inputType('ResetPasswordInput', {
  fields: (t) => ({
    token: t.string(),
    password: t.string(),
  }),
  validate: { schema: ResetPasswordInputSchema },
});

const VerifyEmailInput = builder.inputType('VerifyEmailInput', {
  fields: (t) => ({
    token: t.string(),
  }),
});

const UpdateUserProfileInput = builder.inputType('UpdateUserProfileInput', {
  fields: (t) => ({
    name: t.string(),
  }),
  validate: { schema: UpdateUserProfileInputSchema },
});

const UpdatePasswordInput = builder.inputType('UpdatePasswordInput', {
  fields: (t) => ({
    oldPassword: t.string(),
    newPassword: t.string(),
  }),
  validate: { schema: UpdatePasswordInputSchema },
});

/**
 * * Queries
 */

builder.queryFields((t) => ({
  me: t.prismaField({
    type: 'User',
    nullable: true,
    resolve: async (query, _, __, { db, ...context }) => {
      if (!context.session) {
        return null;
      }

      return await db.user.findUnique({
        ...query,
        where: { id: context.session.userId },
      });
    },
  }),
}));

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  login: t.prismaField({
    type: 'User',
    args: { input: t.arg({ type: LoginInput }) },
    resolve: async (query, _, { input }, context) => {
      const db = context.db;

      const user = await db.user.findUnique({
        select: { id: true, password: { select: { hash: true } } },
        where: { email: input.email.toLowerCase(), state: 'ACTIVE' },
      });

      if (!user?.password) {
        await argon2.hash(input.password);
        throw new FormValidationError(
          'password',
          '잘못된 이메일이거나 비밀번호에요.',
        );
      }

      if (!(await argon2.verify(user.password.hash, input.password))) {
        throw new FormValidationError(
          'password',
          '잘못된 이메일이거나 비밀번호에요.',
        );
      }

      const session = await db.session.create({
        select: { id: true },
        data: { id: createId(), userId: user.id },
      });

      const accessToken = await createAccessToken(session.id);

      context.session = { id: session.id, userId: user.id };
      context.cookies.set('penxle-at', accessToken, {
        path: '/',
        maxAge: dayjs.duration(1, 'year').asSeconds(),
      });

      return await db.user.findUniqueOrThrow({
        ...query,
        where: { id: user.id },
      });
    },
  }),

  logout: t.withAuth({ auth: true }).prismaField({
    type: 'User',
    resolve: async (query, _, __, { db, ...context }) => {
      const { user } = await db.session.delete({
        include: { user: query },
        where: { id: context.session.id },
      });

      context.cookies.delete('penxle-at', { path: '/' });

      return user;
    },
  }),

  signUp: t.prismaField({
    type: 'User',
    args: { input: t.arg({ type: SignUpInput }) },
    resolve: async (query, _, { input }, context) => {
      const db = context.db;

      const isEmailUsed = await db.user.exists({
        where: { email: input.email.toLowerCase(), state: 'ACTIVE' },
      });

      if (isEmailUsed) {
        throw new FormValidationError('email', '이미 사용중인 이메일이에요.');
      }

      const randomAvatar = createRandomAvatar();
      const avatarId = await directUploadImage({
        db,
        name: 'random-avatar.png',
        buffer: await renderAvatar(randomAvatar),
      });

      const profile = await db.profile.create({
        data: {
          id: createId(),
          name: input.name,
          avatarId,
        },
      });

      const user = await db.user.create({
        ...query,
        data: {
          id: createId(),
          email: input.email.toLowerCase(),
          profileId: profile.id,
          state: 'ACTIVE',
          password: {
            create: {
              id: createId(),
              hash: await argon2.hash(input.password),
            },
          },
        },
      });

      if (input.isMarketingAgreed) {
        await db.userMarketingAgreement.create({
          data: {
            id: createId(),
            userId: user.id,
          },
        });
      }

      const token = createId();

      await db.userEmailVerification.create({
        data: {
          id: createId(),
          userId: user.id,
          email: user.email,
          type: 'FIRST_SIGNUP',
          token,
          expiresAt: dayjs().add(2, 'day').toDate(),
        },
      });

      await sendEmail({
        subject: 'PENXLE 이메일 인증',
        recipient: user.email,
        template: EmailVerification,
        props: {
          name: profile.name,
          url: `${context.url.origin}/email-verification?token=${token}`, // TODO: 이메일 인증 페이지 URL 확정 필요
        },
      });

      await db.image.update({
        where: { id: avatarId },
        data: { userId: user.id },
      });

      const session = await db.session.create({
        select: { id: true },
        data: { id: createId(), userId: user.id },
      });

      const accessToken = await createAccessToken(session.id);

      context.session = { id: session.id, userId: user.id };
      context.cookies.set('penxle-at', accessToken, {
        path: '/',
        maxAge: dayjs.duration(1, 'year').asSeconds(),
      });

      return user;
    },
  }),

  issueSSOAuthorizationUrl: t.string({
    args: { input: t.arg({ type: IssueSSOAuthorizationUrlInput }) },
    resolve: (_, { input }, context) => {
      if (input.provider === UserSSOProvider.GOOGLE) {
        return google.generateAuthorizationUrl(context);
      } else {
        throw new Error('Unsupported provider');
      }
    },
  }),

  requestPasswordReset: t.prismaField({
    type: 'UserEmailVerification',
    args: { input: t.arg({ type: RequestPasswordResetInput }) },
    resolve: async (query, _, { input }, { db, ...context }) => {
      const user = await db.user.findUnique({
        select: {
          id: true,
          email: true,
          profile: {
            select: { name: true },
          },
        },
        where: { email: input.email.toLowerCase(), state: 'ACTIVE' },
      });

      if (!user) {
        throw new FormValidationError('email', '잘못된 이메일이에요.');
      }

      const token = createId();

      await sendEmail({
        subject: 'PENXLE 비밀번호 재설정',
        recipient: user.email,
        template: PasswordResetRequest,
        props: {
          name: user.profile.name,
          url: `${context.url.origin}/reset-password?token=${token}`, // TODO: 비밀번호 재설정 페이지 URL 확정 필요
        },
      });

      return await db.userEmailVerification.create({
        ...query,
        data: {
          id: createId(),
          userId: user.id,
          email: user.email,
          type: 'PASSWORD_RESET',
          token,
          expiresAt: dayjs().add(1, 'hour').toDate(),
        },
      });
    },
  }),

  resetPassword: t.prismaField({
    type: 'User',
    args: { input: t.arg({ type: ResetPasswordInput }) },
    resolve: async (query, _, { input }, { db }) => {
      const request = await db.userEmailVerification.findUniqueOrThrow({
        where: {
          token: input.token,
          type: 'PASSWORD_RESET',
          expiresAt: {
            gte: new Date(),
          },
        },
      });

      await db.userEmailVerification.delete({
        where: { id: request.id },
      });

      const user = await db.user.update({
        ...query,
        include: {
          profile: {
            select: {
              name: true,
            },
          },
        },
        where: { id: request.userId },
        data: {
          password: {
            create: {
              id: createId(),
              hash: await argon2.hash(input.password),
            },
          },
        },
      });

      await sendEmail({
        subject: 'PENXLE 비밀번호가 재설정되었어요.',
        recipient: user.email,
        template: PasswordReset,
        props: {
          name: user.profile.name,
        },
      });

      return user;
    },
  }),

  requestEmailUpdate: t.withAuth({ auth: true }).prismaField({
    type: 'UserEmailVerification',
    args: { input: t.arg({ type: RequestEmailUpdateInput }) },
    resolve: async (query, _, { input }, { db, ...context }) => {
      const isEmailUsed = await db.user.exists({
        where: { email: input.email.toLowerCase() },
      });

      if (isEmailUsed) {
        throw new FormValidationError('email', '이미 사용중인 이메일이에요.');
      }

      const user = await db.user.findUniqueOrThrow({
        select: {
          id: true,
          profile: {
            select: { name: true },
          },
        },
        where: { id: context.session.userId, state: 'ACTIVE' },
      });

      const token = createId();

      const request = await db.userEmailVerification.create({
        ...query,
        data: {
          id: createId(),
          userId: user.id,
          type: 'EMAIL_CHANGE',
          email: input.email.toLowerCase(),
          token,
          expiresAt: dayjs().add(1, 'hour').toDate(),
        },
      });

      await sendEmail({
        subject: 'PENXLE 이메일 변경',
        recipient: input.email,
        template: EmailChange,
        props: {
          name: user.profile.name,
          url: `${context.url.origin}/email-verification?token=${token}`, // TODO: 이메일 인증 페이지 URL 확정 필요
          email: input.email,
        },
      });

      return request;
    },
  }),

  verifyEmail: t.prismaField({
    type: 'User',
    args: { input: t.arg({ type: VerifyEmailInput }) },
    resolve: async (query, _, { input }, { db }) => {
      const request = await db.userEmailVerification.findUniqueOrThrow({
        include: {
          user: {
            include: {
              profile: {
                select: { name: true },
              },
            },
          },
        },
        where: {
          token: input.token,
          expiresAt: {
            gte: new Date(),
          },
        },
      });

      if (request.type === 'EMAIL_CHANGE') {
        const newEmail = request.email.toLowerCase();

        await db.user.update({
          where: { id: request.user.id },
          data: {
            email: newEmail,
          },
        });

        await sendEmail({
          subject: 'PENXLE 이메일이 변경되었어요.',
          recipient: request.user.email,
          template: EmailChangeNotice,
          props: {
            name: request.user.profile.name,
            email: newEmail,
          },
        });
      }

      await db.userEmailVerification.delete({
        where: { id: request.id },
      });

      return await db.user.update({
        ...query,
        where: { id: request.user.id },
        data: {
          isVerified: true,
        },
      });
    },
  }),

  updateUserProfile: t.withAuth({ auth: true }).prismaField({
    type: 'Profile',
    args: { input: t.arg({ type: UpdateUserProfileInput }) },
    resolve: async (query, _, { input }, { db, ...context }) => {
      const { profile } = await db.user.update({
        select: { profile: query },
        where: { id: context.session.userId },
        data: {
          profile: {
            update: {
              name: input.name,
            },
          },
        },
      });

      return profile;
    },
  }),

  updatePassword: t.withAuth({ auth: true }).prismaField({
    type: 'User',
    args: { input: t.arg({ type: UpdatePasswordInput }) },
    resolve: async (query, _, { input }, { db, ...context }) => {
      const user = await db.user.findUniqueOrThrow({
        ...query,
        include: {
          profile: {
            select: {
              name: true,
            },
          },
          password: {
            select: {
              id: true,
              hash: true,
            },
          },
        },
        where: { id: context.session.userId },
      });

      if (user.password) {
        if (!(await argon2.verify(user.password.hash, input.oldPassword))) {
          throw new FormValidationError('oldPassword', '잘못된 비밀번호에요.');
        }
        await db.userPassword.delete({
          where: { id: user.password.id },
        });
      }

      await sendEmail({
        subject: 'PENXLE 비밀번호가 재설정되었어요.',
        recipient: user.email,
        template: PasswordReset,
        props: {
          name: user.profile.name,
        },
      });

      return await db.user.update({
        where: { id: context.session.userId },
        data: {
          password: {
            create: {
              id: createId(),
              hash: await argon2.hash(input.newPassword),
            },
          },
        },
      });
    },
  }),

  resendEmailVerification: t.withAuth({ auth: true }).prismaField({
    type: 'UserEmailVerification',
    resolve: async (query, _, __, { db, ...context }) => {
      const user = await db.user.findUniqueOrThrow({
        select: {
          id: true,
          email: true,
          profile: {
            select: { name: true },
          },
          isVerified: true,
        },
        where: { id: context.session.userId, state: 'ACTIVE' },
      });

      if (user.isVerified) {
        throw new FormValidationError('email', '이미 인증된 이메일이에요.'); // 지금 생각해보니까 418이 맞는 듯 해요...
      }

      let verification = await db.userEmailVerification.findFirst({
        ...query,
        where: {
          userId: context.session.userId,
        },
      });

      if (verification) {
        await db.userEmailVerification.update({
          where: {
            id: verification.id,
          },
          data: {
            expiresAt: dayjs().add(2, 'day').toDate(),
          },
        });
      } else {
        verification = await db.userEmailVerification.create({
          ...query,
          data: {
            id: createId(),
            userId: context.session.userId,
            email: user.email,
            type: 'FIRST_SIGNUP',
            token: createId(),
            expiresAt: dayjs().add(2, 'day').toDate(),
          },
        });
      }

      await sendEmail({
        subject: 'PENXLE 이메일 인증',
        recipient: user.email,
        template: EmailVerification,
        props: {
          name: user.profile.name,
          url: `${context.url.origin}/email-verification?token=${verification.token}`, // TODO: 이메일 인증 페이지 URL 확정 필요
        },
      });

      return verification;
    },
  }),
}));
