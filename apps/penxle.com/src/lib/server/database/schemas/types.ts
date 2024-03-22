import dayjs from 'dayjs';
import { customType } from 'drizzle-orm/pg-core';

export const datetime = customType<{ data: dayjs.Dayjs; driverData: string }>({
  dataType: () => 'timestamp with time zone',
  fromDriver: (value) => dayjs(value),
  toDriver: (value) => value.toISOString(),
});
