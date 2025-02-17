import {
  CampaignSchema,
  OtpSchema,
  User as UserDocument,
  UserSchema,
} from '@castcle-api/database/schemas';
import { model } from 'mongoose';
import { User } from '../models';

export const campaignModel = model('Campaign', CampaignSchema);
export const otpModel = model('Otp', OtpSchema);
export const userModel = model<UserDocument>('User', UserSchema);

/** verified: `mobile` */
export const userAlpha = new User({ name: 'alpha' });

/** verified: `none` */
export const userBeta = new User({ name: 'beta' });

/** account.isGuest: true */
export const guest = new User({ name: 'guest' });
