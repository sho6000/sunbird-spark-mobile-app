export interface TestUser {
  email: string;
  password: string;
  username: string;
}

export const testUsers: Record<string, TestUser> = {
  default: {
    email: process.env.SUNBIRD_EMAIL || '',
    password: process.env.SUNBIRD_PASSWORD || '',
    username: process.env.SUNBIRD_USERNAME || '',
  },
};
