import { and, eq } from 'drizzle-orm';
import { generateRandomName } from '$lib/utils';
import { database, Profiles, SpaceMasquerades } from '../database';
import { createRandomIcon } from './icon';
import { directUploadImage } from './image';

type MakeMasqueradeParams = {
  spaceId: string;
  userId: string;
};

export const makeMasquerade = async ({
  spaceId,
  userId,
}: MakeMasqueradeParams): Promise<typeof SpaceMasquerades.$inferSelect> => {
  const rows = await database
    .select()
    .from(SpaceMasquerades)
    .where(and(eq(SpaceMasquerades.spaceId, spaceId), eq(SpaceMasquerades.userId, userId)));

  if (rows.length > 0) {
    return rows[0];
  }

  const avatarId = await directUploadImage({
    userId,
    name: 'icon',
    source: await createRandomIcon(),
  });

  return await database.transaction(async (tx) => {
    const [profile] = await tx
      .insert(Profiles)
      .values({ name: generateRandomName(spaceId + userId), avatarId })
      .returning({ id: Profiles.id });

    const [masquerade] = await tx
      .insert(SpaceMasquerades)
      .values({ userId, spaceId, profileId: profile.id })
      .returning();

    return masquerade;
  });
};
