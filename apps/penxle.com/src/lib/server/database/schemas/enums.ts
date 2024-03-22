import { pgEnum } from 'drizzle-orm/pg-core';
import * as E from '$lib/enums';

// createPgEnum 함수 정의
function createPgEnum<T extends string>(enumName: string, obj: Record<string, T>) {
  return pgEnum(enumName, Object.values(obj) as [T, ...T[]]);
}

// createPgEnum 함수를 사용하여 pgEnum 호출, 알파벳 순으로 정렬
export const _ContentFilterAction = createPgEnum('_content_filter_action', E.ContentFilterAction);
export const _ContentFilterCategory = createPgEnum('_content_filter_category', E.ContentFilterCategory);
export const _PaymentMethod = createPgEnum('_payment_method', E.PaymentMethod);
export const _PointKind = createPgEnum('_point_kind', E.PointKind);
export const _PointPurchaseState = createPgEnum('_point_purchase_state', E.PointPurchaseState);
export const _PointTransactionCause = createPgEnum('_point_transaction_cause', E.PointTransactionCause);
export const _PostAgeRating = createPgEnum('_post_age_rating', E.PostAgeRating);
export const _PostCategory = createPgEnum('_post_category', E.PostCategory);
export const _PostCommentQualification = createPgEnum('_post_comment_qualification', E.PostCommentQualification);
export const _PostCommentState = createPgEnum('_post_comment_state', E.PostCommentState);
export const _PostCommentVisibility = createPgEnum('_post_comment_visibility', E.PostCommentVisibility);
export const _PostPair = createPgEnum('_post_pair', E.PostPair);
export const _PostRevisionContentKind = createPgEnum('_post_revision_content_kind', E.PostRevisionContentKind);
export const _PostRevisionKind = createPgEnum('_post_revision_kind', E.PostRevisionKind);
export const _PostState = createPgEnum('_post_state', E.PostState);
export const _PostTagKind = createPgEnum('_post_tag_kind', E.PostTagKind);
export const _PostVisibility = createPgEnum('_post_visibility', E.PostVisibility);
export const _PreferenceType = createPgEnum('_preference_type', E.PreferenceType);
export const _RevenueKind = createPgEnum('_revenue_kind', E.RevenueKind);
export const _RevenueState = createPgEnum('_revenue_state', E.RevenueState);
export const _RevenueWithdrawalKind = createPgEnum('_revenue_withdrawal_kind', E.RevenueWithdrawalKind);
export const _RevenueWithdrawalState = createPgEnum('_revenue_withdrawal_state', E.RevenueWithdrawalState);
export const _SpaceCollectionState = createPgEnum('_space_collection_state', E.SpaceCollectionState);
export const _SpaceMemberInvitationState = createPgEnum('_space_member_invitation_state', E.SpaceMemberInvitationState);
export const _SpaceMemberRole = createPgEnum('_space_member_role', E.SpaceMemberRole);
export const _SpaceMemberState = createPgEnum('_space_member_state', E.SpaceMemberState);
export const _SpaceState = createPgEnum('_space_state', E.SpaceState);
export const _SpaceVisibility = createPgEnum('_space_visibility', E.SpaceVisibility);
export const _UserEmailVerificationKind = createPgEnum('_user_email_verification_kind', E.UserEmailVerificationKind);
export const _UserNotificationCategory = createPgEnum('_user_notification_category', E.UserNotificationCategory);
export const _UserNotificationMethod = createPgEnum('_user_notification_method', E.UserNotificationMethod);
export const _UserNotificationState = createPgEnum('_user_notification_state', E.UserNotificationState);
export const _UserPersonalIdentityKind = createPgEnum('_user_personal_identity_kind', E.UserPersonalIdentityKind);
export const _UserSingleSignOnProvider = createPgEnum('_user_single_sign_on_provider', E.UserSingleSignOnProvider);
export const _UserState = createPgEnum('_user_state', E.UserState);
export const _UserRole = createPgEnum('_user_role', E.UserRole);
