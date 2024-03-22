import dayjs from 'dayjs';

export const getKoreanAge = (birthday?: dayjs.Dayjs) => {
  if (!birthday) {
    return 0;
  }

  const birthYear = birthday.kst().year();
  const currentYear = dayjs.kst().year();

  const koreanAge = currentYear - birthYear + 1;

  return koreanAge;
};

export const isAdulthood = (birthday?: dayjs.Dayjs) => {
  return getKoreanAge(birthday) >= 20;
};

export const isGte15 = (birthday?: dayjs.Dayjs) => {
  return getKoreanAge(birthday) >= 15;
};
