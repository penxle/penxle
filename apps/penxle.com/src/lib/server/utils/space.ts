import { and, eq } from 'drizzle-orm';
import { database, SpaceMembers } from '../database';
import type { Context } from '../context';

export const getSpaceMember = async (context: Context, spaceId: string) => {
  if (!context.session) {
    return null;
  }

  const meAsMembers = await database
    .select()
    .from(SpaceMembers)
    .where(
      and(
        eq(SpaceMembers.spaceId, spaceId),
        eq(SpaceMembers.userId, context.session.userId),
        eq(SpaceMembers.state, 'ACTIVE'),
      ),
    );

  if (meAsMembers.length === 0) {
    return null;
  }

  return meAsMembers[0];
};
