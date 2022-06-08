/*
 * Copyright (c) 2021, Castcle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 3 only, as
 * published by the Free Software Foundation.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * version 3 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 3 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Castcle, 22 Phet Kasem 47/2 Alley, Bang Khae, Bangkok,
 * Thailand 10160, or visit www.castcle.com if you need additional information
 * or have any questions.
 */

import {
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  Image,
} from '@castcle-api/utils/aws';
import { TwilioChannel } from '@castcle-api/utils/clients';
import { CastcleName, CastcleRegExp } from '@castcle-api/utils/commons';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isArray, isBoolean, isMongoId, isString } from 'class-validator';
import {
  AnyKeys,
  ClientSession,
  FilterQuery,
  Model,
  QueryOptions,
  SaveOptions,
  Types,
  UpdateQuery,
} from 'mongoose';
import { lastValueFrom, map } from 'rxjs';
import {
  GetAvailableIdResponse,
  GetBalanceResponse,
  pipelineGetContents,
  pipelineOfGetAvailableId,
  pipelineOfGetBalance,
} from '../aggregations';
import {
  AccessTokenPayload,
  BlogPayload,
  ContentType,
  CreateContentDto,
  CreateCredentialDto,
  EntityVisibility,
  NotificationSource,
  NotificationType,
  RefreshTokenPayload,
  ShortPayload,
  Url,
} from '../dtos';
import {
  AdsBoostStatus,
  AdsPaymentMethod,
  CACCOUNT_NO,
  CastcleNumber,
  KeywordType,
  OtpObjective,
  QueueStatus,
  SearchType,
  UserType,
} from '../models';
import {
  Account,
  AccountDeviceV1,
  AccountActivationModel as ActivationModel,
  AdsCampaign,
  AdsPlacement,
  AccountAuthenId as AuthenId,
  CAccount,
  CAccountNature,
  Comment,
  Content,
  Credential,
  CredentialModel,
  Engagement,
  FeedItem,
  Hashtag,
  Notification,
  Otp,
  OtpModel,
  Queue,
  AccountReferral as Referral,
  Relationship,
  Revision,
  SocialSync,
  Transaction,
  User,
  UxEngagement,
} from '../schemas';
import { createCastcleFilter } from '../utils/common';

type AccountQuery = {
  _id?: any;
  email?: string;
  provider?: string;
  socialId?: string;
  mobileCountryCode?: string;
  mobileNumber?: string;
  referredBy?: string;
  uuid?: string;
  platform?: string;
  activationToken?: string;
};

type UserQuery = {
  /** Mongo ID or castcle ID */
  _id?: string | Types.ObjectId[] | string[];
  accountId?: string;
  castcleId?: string;
  excludeRelationship?: string[] | User[];
  keyword?: {
    input: string;
    type: KeywordType;
  };
  sinceId?: string;
  type?: UserType;
  untilId?: string;
};

type EngagementQuery = {
  contentId?: string;
  type?: string;
  sinceId?: string;
  untilId?: string;
  user?: User | User[] | Types.ObjectId;
  targetRef?: any;
  itemId?: string;
};

type RelationshipQuery = {
  userId?: User | User[] | Types.ObjectId;
  followedUser?: User | User[] | Types.ObjectId;
  blocking?: boolean;
  sinceId?: string;
  untilId?: string;
};

type CredentialQuery = {
  refreshToken?: string;
  accessToken?: string;
  deviceUUID?: string;
  'account.isGuest'?: boolean;
};

type NotificationQueryOption = {
  _id?: string;
  account?: Account;
  user?: User | Types.ObjectId;
  source?: NotificationSource;
  sinceId?: string;
  untilId?: string;
  read?: boolean;
  type?: NotificationType;
  contentRef?: Types.ObjectId | any;
  commentRef?: Types.ObjectId | any;
  replyRef?: Types.ObjectId | any;
  adsRef?: Types.ObjectId | any;
  profileRef?: Types.ObjectId | any;
  sourceUserId?: Types.ObjectId;
};

type ContentQuery = {
  _id?: string | string[];
  author?: string | Types.ObjectId;
  contentType?: string;
  decayDays?: number;
  excludeAuthor?: string[] | User[];
  excludeContents?: Content[];
  isQuote?: boolean;
  isRecast?: boolean;
  keyword?: {
    input: string;
    type: KeywordType;
  };
  maxResults?: number;
  message?: string;
  originalPost?: string;
  sinceId?: string;
  type?: string[];
  sortBy?: {
    [key: string]: string;
  };
  untilId?: string;
  viewer?: User;
};

type HashtagQuery = {
  tag?: string;
  tags?: string[];
  score?: number;
  keyword?: {
    input: string;
    type: KeywordType;
  };
};

type SocialSyncQuery = {
  _id?: string;
  authorId?: string;
};

@Injectable()
export class Repository {
  constructor(
    /** @deprecated */
    @InjectModel('AccountActivation') private activationModel: ActivationModel,
    /** @deprecated */
    @InjectModel('AccountAuthenId') private authenIdModel: Model<AuthenId>,
    /** @deprecated */
    @InjectModel('AccountDevice') private deviceModel: Model<AccountDeviceV1>,
    /** @deprecated */
    @InjectModel('AccountReferral') private referralModel: Model<Referral>,
    /** @deprecated */
    @InjectModel('Credential') private credentialModel: CredentialModel,
    @InjectModel('Account') private accountModel: Model<Account>,
    @InjectModel('AdsCampaign') private adsCampaignModel: Model<AdsCampaign>,
    @InjectModel('Content') private contentModel: Model<Content>,
    @InjectModel('Comment') private commentModel: Model<Comment>,
    @InjectModel('Engagement') private engagementModel: Model<Engagement>,
    @InjectModel('FeedItem') private feedItemModel: Model<FeedItem>,
    @InjectModel('Hashtag') private hashtagModel: Model<Hashtag>,
    @InjectModel('Notification') private notificationModel: Model<Notification>,
    @InjectModel('Otp') private otpModel: OtpModel,
    @InjectModel('Queue') private queueModel: Model<Queue>,
    @InjectModel('Relationship') private relationshipModel: Model<Relationship>,
    @InjectModel('Revision') private revisionModel: Model<Revision>,
    @InjectModel('SocialSync') private socialSyncModel: Model<SocialSync>,
    @InjectModel('Transaction') private transactionModel: Model<Transaction>,
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('CAccount') private caccountModel: Model<CAccount>,
    @InjectModel('AdsPlacement') private adsPlacementModel: Model<AdsPlacement>,
    @InjectModel('UxEngagement') private uxEngagementModel: Model<UxEngagement>,
    private httpService: HttpService,
  ) {}

  private getBase64FromUrl(url: string) {
    return lastValueFrom(
      this.httpService
        .get(url, {
          responseType: 'arraybuffer',
        })
        .pipe(
          map(({ data }) => Buffer.from(data, 'binary').toString('base64')),
        ),
    );
  }

  private getAccountQuery(filter: AccountQuery) {
    const query: FilterQuery<Account> = {
      visibility: EntityVisibility.Publish,
    };

    if (filter._id) query._id = filter._id;
    if (filter.email) query.email = CastcleRegExp.fromString(filter.email);
    if (filter.mobileNumber) query['mobile.number'] = filter.mobileNumber;
    if (filter.referredBy) query.referralBy = filter.referredBy;
    if (filter.uuid) query['devices.uuid'] = filter.uuid;
    if (filter.platform) query['devices.platform'] = filter.platform;
    if (filter.mobileCountryCode)
      query['mobile.countryCode'] = filter.mobileCountryCode;
    if (filter.provider && filter.socialId) {
      query[`authentications.${filter.provider}.socialId`] = filter.socialId;
    }
    if (filter.activationToken)
      query['activations.verifyToken'] = filter.activationToken;

    return query;
  }

  private getRelationshipQuery = (filter: RelationshipQuery) => {
    const query: FilterQuery<Relationship> = {};

    if (filter.sinceId || filter.untilId) {
      query.followedUser = {};
      if (filter.sinceId) query.followedUser.$gt = filter.sinceId as any;
      if (filter.untilId) query.followedUser.$lt = filter.untilId as any;
    }
    if (filter.blocking) query.blocking = filter.blocking;
    if (filter.followedUser) query.followedUser = filter.followedUser as any;
    if (isArray(filter.followedUser))
      query.followedUser = { $in: filter.followedUser as any };
    if (filter.userId) query.user = filter.userId as any;
    if (isArray(filter.userId)) query.user = { $in: filter.userId as any };

    return query;
  };

  private getContentQuery = (filter: ContentQuery) => {
    const query: FilterQuery<Content> = {
      visibility: EntityVisibility.Publish,
    };

    if (isArray(filter._id))
      query._id = {
        $in: (filter._id as any).map((id) =>
          isString(id) ? Types.ObjectId(id) : id,
        ),
      };
    else if (filter._id)
      query._id = isString(filter._id)
        ? Types.ObjectId(filter._id as any)
        : filter._id;

    if (filter.message) query['payload.message'] = filter.message;
    if (filter.originalPost)
      query['originalPost._id'] = Types.ObjectId(filter.originalPost);
    if (filter.author) query['author.id'] = filter.author;
    if (filter.isRecast) query.isRecast = filter.isRecast;
    if (filter.isQuote) query.isQuote = filter.isQuote;
    if (isArray(filter.type)) query.type = { $in: filter.type };

    if (filter.keyword?.input) {
      if (filter.keyword.type === KeywordType.Hashtag) {
        query.hashtags = filter.keyword.input;
      } else if (filter.keyword.type === KeywordType.Mention) {
        query.$or = [
          {
            'author.castcleId': CastcleRegExp.fromString(filter.keyword.input, {
              exactMatch: false,
            }),
          },
          {
            'author.displayName': CastcleRegExp.fromString(
              filter.keyword.input,
              {
                exactMatch: false,
              },
            ),
          },
        ];
      } else {
        query['payload.message'] = CastcleRegExp.fromString(
          filter.keyword.input,
          {
            exactMatch: false,
          },
        );
      }
    }

    if (filter.contentType) {
      query[`payload.${filter.contentType}`] = { $exists: true };

      if (filter.contentType === SearchType.PHOTO)
        query[`payload.${filter.contentType}.contents`] = {
          $not: { $size: 0 },
        };
    }

    if (filter.decayDays) {
      query.$and = [
        { createdAt: { $lte: new Date() } },
        {
          createdAt: {
            $gte: new Date(
              new Date().getTime() - filter.decayDays * 1000 * 86400,
            ),
          },
        },
      ];
    }
    if (filter.excludeContents?.length)
      query._id = { $nin: filter.excludeContents };

    if (filter.excludeAuthor?.length)
      query['author.id'] = { $nin: filter.excludeAuthor };

    if (filter.sinceId || filter.untilId)
      return createCastcleFilter(query, {
        sinceId: filter.sinceId,
        untilId: filter.untilId,
      });

    return query;
  };

  private getEngagementQuery = (filter: EngagementQuery) => {
    const query: FilterQuery<Engagement> = {
      visibility: EntityVisibility.Publish,
    };

    if (filter.type) query.type = filter.type;
    if (isArray(filter.user)) query.user = { $in: filter.user as any };
    else if (filter.user) query.user = filter.user as any;
    if (filter.itemId) query.itemId = filter.itemId;
    if (filter.targetRef)
      query.targetRef = {
        $ref: filter.targetRef.$ref,
        $id: Types.ObjectId(filter.targetRef.$id),
      };
    if (filter.sinceId || filter.untilId)
      return createCastcleFilter(query, {
        sinceId: filter.sinceId,
        untilId: filter.untilId,
      });

    return query;
  };

  private getNotificationQuery = (filter: NotificationQueryOption) => {
    const query: FilterQuery<Notification> = {};
    if (filter?._id) query._id = filter._id;
    if (filter?.account) query.account = filter.account;
    if (filter?.source) query.source = filter.source;
    if (filter?.read) query.read = filter.read;
    if (filter?.type) query.type = filter.type;
    if (filter?.contentRef) query.contentRef = filter.contentRef;
    if (filter?.commentRef) query.commentRef = filter.commentRef;
    if (filter?.replyRef) query.replyRef = filter.replyRef;
    if (filter?.profileRef) query.profileRef = filter.profileRef;
    if (filter?.adsRef) query.adsRef = filter.adsRef;
    if (filter?.sourceUserId) query.sourceUserId = filter.sourceUserId;

    return createCastcleFilter(query, {
      sinceId: filter?.sinceId,
      untilId: filter?.untilId,
    });
  };

  private getHashtagQuery = (filter: HashtagQuery) => {
    const query: FilterQuery<Hashtag> = {
      score: {
        $gt: 0,
      },
    };
    if (filter.tag) query.tag = new CastcleName(filter.tag).slug;
    if (filter.tags)
      query.tags = { $in: filter.tags.map((tag) => new CastcleName(tag).slug) };

    if (filter.keyword) {
      query.tag = CastcleRegExp.fromString(filter.keyword.input, {
        exactMatch: false,
      });
    }
    return query;
  };

  private getSocialSyncQuery(filter: SocialSyncQuery) {
    const query: FilterQuery<SocialSync> = {};
    if (filter._id)
      query._id = isString(filter._id)
        ? Types.ObjectId(filter._id)
        : filter._id;
    if (filter.authorId) query['author.id'] = filter.authorId;

    return query;
  }
  deleteAccount(filter: AccountQuery) {
    return this.accountModel.deleteOne(this.getAccountQuery(filter));
  }

  findAccount(filter: AccountQuery) {
    return this.accountModel.findOne(this.getAccountQuery(filter));
  }

  findAccounts(filter: AccountQuery) {
    return this.accountModel.find(this.getAccountQuery(filter));
  }

  updateAccount(filter: AccountQuery, updateQuery?: UpdateQuery<Account>) {
    return this.accountModel.updateOne(
      this.getAccountQuery(filter),
      updateQuery,
    );
  }

  updateCredentials(
    filter: FilterQuery<Credential>,
    updateQuery?: UpdateQuery<Credential>,
  ) {
    return this.credentialModel.updateMany(filter, updateQuery);
  }
  async createAccount(
    accountRequirements: AnyKeys<Account>,
    queryOptions?: SaveOptions,
  ) {
    const newAccount: Partial<Account> = {
      isGuest: true,
      preferences: {
        languages: accountRequirements['languagesPreferences'],
      },
      geolocation: accountRequirements.geolocation,
      visibility: EntityVisibility.Publish,
    };

    return new this.accountModel(newAccount).save(queryOptions);
  }

  async createContentImage(body: CreateContentDto, userId: string) {
    if (body.payload.photo && body.payload.photo.contents) {
      const newContents = await Promise.all(
        (body.payload.photo.contents as Url[]).map(async (item) => {
          return Image.upload(item.image, {
            addTime: true,
            sizes: COMMON_SIZE_CONFIGS,
            subpath: `contents/${userId}`,
          }).then((r) => r.image);
        }),
      );
      body.payload.photo.contents = newContents;
    }
    if (
      body.type === ContentType.Blog &&
      (body.payload as BlogPayload).photo.cover
    ) {
      (body.payload as BlogPayload).photo.cover = (
        await Image.upload(
          ((body.payload as BlogPayload).photo.cover as Url).image,
          {
            addTime: true,
            sizes: COMMON_SIZE_CONFIGS,
            subpath: `contents/${userId}`,
          },
        )
      ).image;
    }

    if ((body.payload as BlogPayload | ShortPayload).link) {
      const newLink = await Promise.all(
        ((body.payload as BlogPayload | ShortPayload).link as Url[]).map(
          async (item) => {
            if (!item?.image) return item;
            return {
              ...item,
              image: await Image.upload(item.image, {
                addTime: true,
                sizes: COMMON_SIZE_CONFIGS,
                subpath: `contents/${userId}`,
              }).then((r) => r.image),
            };
          },
        ),
      );

      (body.payload as any).link = newLink;
    }

    return body;
  }

  async createProfileImage(accountId: string, imageUrl: string) {
    const base64 = await this.getBase64FromUrl(imageUrl);
    const { image } = await Image.upload(base64, {
      filename: `avatar-${accountId}`,
      addTime: true,
      sizes: AVATAR_SIZE_CONFIGS,
      subpath: `account_${accountId}`,
    });

    return image;
  }

  async createCoverImage(accountId: string, imageUrl: string) {
    const base64 = await this.getBase64FromUrl(imageUrl);
    const { image } = await Image.upload(base64, {
      filename: `cover-${accountId}`,
      addTime: true,
      sizes: COMMON_SIZE_CONFIGS,
      subpath: `account_${accountId}`,
    });

    return image;
  }

  async createUser(user: AnyKeys<User>) {
    const { suggestCastcleId } = new CastcleName(
      user.displayId || user.displayName,
    );

    const [availableId] =
      await this.userModel.aggregate<GetAvailableIdResponse>(
        pipelineOfGetAvailableId(suggestCastcleId),
      );

    user.displayId = availableId?.count
      ? suggestCastcleId + (availableId.number || Date.now().toString())
      : suggestCastcleId;

    return new this.userModel(user).save();
  }

  private getUserQuery(filter: UserQuery) {
    const query: FilterQuery<User> = {
      visibility: EntityVisibility.Publish,
    };

    if (filter.accountId) query.ownerAccount = filter.accountId as any;
    if (filter.type) query.type = filter.type;
    let andId = [];

    if (isMongoId(String(filter._id))) {
      andId = [{ _id: filter._id }];
    } else if (isArray(filter._id)) {
      andId = [{ _id: { $in: filter._id } }];
    } else if (filter._id) {
      andId = [
        {
          displayId: CastcleRegExp.fromString(filter._id as string),
        },
      ];
    }

    if (filter.excludeRelationship) {
      andId = [...andId, { _id: { $nin: filter.excludeRelationship } }];
    }

    if (andId.length) query.$and = andId;

    if (filter.keyword?.input) {
      query.$or = [
        {
          displayId: CastcleRegExp.fromString(filter.keyword.input, {
            exactMatch: false,
          }),
        },
        {
          displayName: CastcleRegExp.fromString(filter.keyword.input, {
            exactMatch: false,
          }),
        },
      ];
    }

    if (filter.castcleId) query.displayId = filter.castcleId;

    if (filter.sinceId || filter.untilId)
      return createCastcleFilter(query, {
        sinceId: filter.sinceId,
        untilId: filter.untilId,
      });

    return query;
  }

  findUser(filter: UserQuery, queryOptions?: QueryOptions) {
    return this.userModel.findOne(this.getUserQuery(filter), {}, queryOptions);
  }

  findUsers(filter: UserQuery, queryOptions?: QueryOptions) {
    return this.userModel.find(this.getUserQuery(filter), {}, queryOptions);
  }

  findUserCount(filter: UserQuery) {
    return this.userModel.countDocuments(filter);
  }

  updateUser(
    filter: UserQuery,
    user: UpdateQuery<User>,
    option?: QueryOptions,
  ) {
    return this.userModel.updateOne(filter, user, option);
  }

  findEngagement(filter: EngagementQuery, queryOptions?: QueryOptions) {
    return this.engagementModel
      .findOne(this.getEngagementQuery(filter), {}, queryOptions)
      .exec();
  }

  findEngagements(filter: EngagementQuery, queryOptions?: QueryOptions) {
    return this.engagementModel
      .find(this.getEngagementQuery(filter), {}, queryOptions)
      .exec();
  }

  countEngagements(filter: EngagementQuery) {
    return this.engagementModel
      .countDocuments(this.getEngagementQuery(filter))
      .exec();
  }

  createEngagement(engagement: AnyKeys<Engagement>) {
    return new this.engagementModel(engagement).save();
  }

  async deleteEngagements(filter: EngagementQuery) {
    const filterQuery = this.getEngagementQuery(filter);
    const engagements = await this.engagementModel.find(filterQuery);
    const $deletedEngagements = engagements.map((engagement) => {
      return engagement.set({ visibility: EntityVisibility.Deleted }).save();
    });

    return Promise.all($deletedEngagements);
  }

  updateEngagement(
    filter: EngagementQuery,
    updateQuery: UpdateQuery<Engagement>,
    option: QueryOptions,
  ) {
    return this.engagementModel.updateOne(
      this.getEngagementQuery(filter),
      updateQuery,
      option,
    );
  }

  updateEngagements(
    filter: EngagementQuery,
    updateQuery: UpdateQuery<Engagement>,
    option?: QueryOptions,
  ) {
    return this.engagementModel
      .updateMany(this.getEngagementQuery(filter), updateQuery, option)
      .exec();
  }

  findRelationships(filter: RelationshipQuery, queryOptions?: QueryOptions) {
    return this.relationshipModel.find(
      this.getRelationshipQuery(filter),
      {},
      queryOptions,
    );
  }

  findRelationship(
    filter: FilterQuery<Relationship>,
    queryOptions?: QueryOptions,
  ) {
    return this.relationshipModel.findOne(filter, {}, queryOptions);
  }

  updateRelationship(
    filter: FilterQuery<Relationship>,
    updateQuery?: UpdateQuery<Relationship>,
    queryOptions?: QueryOptions,
  ) {
    return this.relationshipModel.updateOne(filter, updateQuery, queryOptions);
  }

  removeRelationship(
    filter: FilterQuery<Relationship>,
    queryOptions?: QueryOptions,
  ) {
    return this.relationshipModel.deleteOne(filter, queryOptions);
  }

  findContent(filter: ContentQuery) {
    return this.contentModel.findOne(this.getContentQuery(filter)).exec();
  }

  findContents(filter: ContentQuery, queryOptions?: QueryOptions) {
    return this.contentModel
      .find(this.getContentQuery(filter), {}, queryOptions)
      .exec();
  }
  countContents(filter: ContentQuery) {
    return this.contentModel
      .countDocuments(this.getContentQuery(filter))
      .exec();
  }

  aggregationContent({ maxResults, sortBy, ...filter }: ContentQuery) {
    return this.contentModel.aggregate(
      pipelineGetContents({
        maxResults,
        sortBy,
        viewer: filter.viewer,
        filter: this.getContentQuery(filter),
      }),
    );
  }

  aggregateRelationship<T = any>(pipeline: any) {
    return this.relationshipModel.aggregate<T>(pipeline);
  }

  createContent(content: AnyKeys<Content>) {
    return new this.contentModel(content).save();
  }

  updateContent(
    filter: ContentQuery,
    updateQuery?: UpdateQuery<Content>,
    queryOptions?: QueryOptions,
  ) {
    return this.contentModel.updateOne(
      this.getContentQuery(filter),
      updateQuery,
      queryOptions,
    );
  }

  updateContents(
    filter: ContentQuery,
    updateQuery?: UpdateQuery<Content>,
    queryOptions?: QueryOptions,
  ) {
    return this.contentModel
      .updateMany(this.getContentQuery(filter), updateQuery, queryOptions)
      .exec();
  }

  async deleteContents(filterQuery: FilterQuery<Content>) {
    const contents = await this.contentModel.find(filterQuery);
    const hashtags: string[] = [];
    const $deletedContents = contents.map((content) => {
      hashtags.push(...(content.hashtags || []));

      return content.set({ visibility: EntityVisibility.Deleted }).save();
    });

    await Promise.all([
      this.hashtagModel.updateMany(
        { tag: { $in: hashtags }, score: { $gt: 0 } },
        { $inc: { score: -1 } },
      ),
      ...$deletedContents,
    ]);
  }

  findCredential(filter: CredentialQuery) {
    return this.credentialModel.findOne(filter);
  }

  createNotification(notify: AnyKeys<Notification>) {
    return new this.notificationModel(notify).save();
  }

  findNotification(
    filter: NotificationQueryOption,
    queryOptions?: QueryOptions,
  ) {
    return this.notificationModel
      .findOne(this.getNotificationQuery(filter), {}, queryOptions)
      .exec();
  }

  findNotifications(
    filter: NotificationQueryOption,
    queryOptions?: QueryOptions,
  ) {
    return this.notificationModel
      .find(this.getNotificationQuery(filter), {}, queryOptions)
      .exec();
  }

  updateNotification(
    filter: NotificationQueryOption,
    updateQuery?: UpdateQuery<Notification>,
    queryOptions?: QueryOptions,
  ) {
    return this.notificationModel
      .updateOne(this.getNotificationQuery(filter), updateQuery, queryOptions)
      .exec();
  }

  updateNotifications(
    filter: NotificationQueryOption,
    updateQuery?: UpdateQuery<Notification>,
    queryOptions?: QueryOptions,
  ) {
    return this.notificationModel.updateMany(
      this.getNotificationQuery(filter),
      updateQuery,
      queryOptions,
    );
  }

  deleteNotification(filter: NotificationQueryOption) {
    return this.notificationModel.deleteOne(this.getNotificationQuery(filter));
  }

  deleteNotifications(
    filter: NotificationQueryOption,
    queryOptions?: QueryOptions,
  ) {
    return this.notificationModel.deleteMany(
      this.getNotificationQuery(filter),
      queryOptions,
    );
  }

  aggregationNotification(pipeline: any[]) {
    return this.notificationModel.aggregate(pipeline);
  }

  findNotificationCount(filter: NotificationQueryOption) {
    return this.notificationModel
      .countDocuments(this.getNotificationQuery(filter))
      .exec();
  }

  removeFromTag(
    filter: HashtagQuery,
    updateQuery?: UpdateQuery<Hashtag>,
    queryOptions?: QueryOptions,
  ) {
    return this.hashtagModel.updateOne(
      this.getHashtagQuery(filter),
      updateQuery,
      queryOptions,
    );
  }

  removeFromTags(
    tags: string[],
    updateQuery?: UpdateQuery<Hashtag>,
    queryOptions?: QueryOptions,
  ) {
    return this.hashtagModel.updateMany(
      this.getHashtagQuery({ tags }),
      updateQuery,
      queryOptions,
    );
  }

  async createCredential(
    credential: CreateCredentialDto,
    queryOptions?: SaveOptions,
  ) {
    return new this.credentialModel(credential).save(queryOptions);
  }

  generateAccessToken(payload: AccessTokenPayload) {
    return this.credentialModel.generateAccessToken(payload);
  }

  generateRefreshToken(payload: RefreshTokenPayload) {
    return this.credentialModel.generateRefreshToken(payload);
  }

  createOtp(createOtpDto: {
    accountId: string;
    objective: OtpObjective;
    requestId: string;
    channel: TwilioChannel;
    verified: boolean;
    receiver: string;
    sid?: string;
  }) {
    return this.otpModel.generate(
      createOtpDto.accountId,
      createOtpDto.objective,
      createOtpDto.requestId,
      createOtpDto.channel,
      createOtpDto.verified,
      createOtpDto.receiver,
      createOtpDto.sid,
    );
  }

  findOtp(dto: {
    channel?: TwilioChannel;
    verified?: boolean;
    objective?: OtpObjective;
    receiver?: string;
  }) {
    const query: FilterQuery<Otp> = { completedAt: { $exists: false } };

    if (dto.channel) query.channel = dto.channel;
    if (dto.objective) query.action = dto.objective;
    if (dto.receiver) query.receiver = dto.receiver;
    if (isBoolean(dto.verified)) query.isVerify = dto.verified;

    return this.otpModel.findOne(query);
  }

  accountSession(): Promise<ClientSession> {
    return this.accountModel.startSession();
  }

  updateComments(
    filter: FilterQuery<Comment>,
    comment: UpdateQuery<Comment>,
    queryOptions?: QueryOptions,
  ) {
    return this.commentModel.updateMany(filter, comment, queryOptions).exec();
  }

  deleteComments(filter: FilterQuery<Comment>, queryOptions?: QueryOptions) {
    return this.commentModel.deleteMany(filter, queryOptions).exec();
  }

  deleteSocialSyncs(
    filter: FilterQuery<SocialSync>,
    queryOptions?: QueryOptions,
  ) {
    return this.socialSyncModel.deleteMany(filter, queryOptions);
  }

  updateFeedItem(
    filter: FilterQuery<FeedItem>,
    feedItem: UpdateQuery<FeedItem>,
    queryOptions?: QueryOptions,
  ) {
    return this.feedItemModel.updateOne(filter, feedItem, queryOptions);
  }

  findSocialSync(filter: SocialSyncQuery, queryOptions?: QueryOptions) {
    return this.socialSyncModel
      .findOne(this.getSocialSyncQuery(filter), {}, queryOptions)
      .exec();
  }

  updateSocialSync(
    filter: SocialSyncQuery,
    updateQuery: UpdateQuery<SocialSync>,
    queryOptions?: QueryOptions,
  ) {
    return this.socialSyncModel.updateOne(
      this.getSocialSyncQuery(filter),
      updateQuery,
      queryOptions,
    );
  }

  deleteFeedItems(filter: FilterQuery<FeedItem>, queryOptions?: QueryOptions) {
    return this.feedItemModel.deleteMany(filter, queryOptions);
  }

  deleteRevisions(filter: FilterQuery<Revision>, queryOptions?: QueryOptions) {
    return this.revisionModel.deleteMany(filter, queryOptions);
  }

  findHashtags(filter: HashtagQuery, queryOptions?: QueryOptions) {
    return this.hashtagModel.find(
      this.getHashtagQuery(filter),
      {},
      queryOptions,
    );
  }

  /**
   * Get account's balance
   */
  getBalance = async (dto: { accountId: string }) => {
    const [balance] = await this.transactionModel.aggregate<GetBalanceResponse>(
      pipelineOfGetBalance(dto.accountId),
    );

    return CastcleNumber.from(balance?.total?.toString()).toNumber();
  };

  getFindQueryForChild = (caccount: CAccount) => {
    const orQuery = [
      {
        'ledgers.debit.caccountNo': caccount.no,
      },
      {
        'ledgers.credit.caccountNo': caccount.no,
      },
    ];
    if (caccount.child)
      caccount.child.forEach((childNo) => {
        orQuery.push({
          'ledgers.debit.caccountNo': childNo,
        });
        orQuery.push({
          'ledgers.credit.caccountNo': childNo,
        });
      });
    return orQuery;
  };

  findTransactionsOfCAccount = (caccount: CAccount) => {
    const orQuery = this.getFindQueryForChild(caccount);
    const findFilter: FilterQuery<Transaction> = {
      $or: orQuery,
    };
    return this.transactionModel.find(findFilter);
  };

  findCAccountByCaccountNO = (caccountNo: string) =>
    this.caccountModel.findOne({ no: caccountNo });

  getTAccountBalance = async (caccountNo: string) => {
    //get account First
    const caccount = await this.caccountModel.findOne({ no: caccountNo });
    const txs = await this.findTransactionsOfCAccount(caccount);
    const allDebit = txs.reduce((totalDebit, currentTx) => {
      return (
        totalDebit +
        currentTx.ledgers
          .filter(
            (t) =>
              caccount.child.findIndex(
                (childNo) => t.debit.caccountNo === childNo,
              ) >= 0 || caccount.no === t.debit.caccountNo,
          )
          .reduce((sumDebit, now) => now.debit.value + sumDebit, 0)
      );
    }, 0);
    const allCredit = txs.reduce((totalCredit, currentTx) => {
      return (
        totalCredit +
        currentTx.ledgers
          .filter(
            (t) =>
              caccount.child.findIndex(
                (childNo) => t.credit.caccountNo === childNo,
              ) >= 0 || caccount.no === t.credit.caccountNo,
          )
          .reduce((sumCredit, now) => now.debit.value + sumCredit, 0)
      );
    }, 0);
    if (caccount.nature === CAccountNature.DEBIT) return allDebit - allCredit;
    else return allCredit - allDebit;
  };

  getUndistributedAdsplacements = async (
    paymentOptions?: AdsPaymentMethod,
  ): Promise<AdsPlacement[]> => {
    if (!paymentOptions)
      return this.adsPlacementModel.find({
        'cost.CAST': { $exits: false },
      });
    return this.adsPlacementModel.find({
      'cost.CAST': { $exits: false },
      'campaign.campaignPaymentType': paymentOptions,
    });
  };

  getCastUSDDistributeRate = async () => {
    const collectedCast = await this.getTAccountBalance(
      CACCOUNT_NO.SOCIAL_REWARD.NO,
    );
    const adsPlacements = await this.getUndistributedAdsplacements();
    const totalCost = adsPlacements.reduce((a, b) => a + b.cost.UST, 0);
    return collectedCast / totalCost;
  };

  async deleteCastcleAccount(account: Account) {
    const users = await this.userModel.find({ ownerAccount: account._id });
    const userIds = users.map((user) => user._id);
    const $v1Delete = [
      this.activationModel.deleteMany({ account: account._id }),
      this.authenIdModel.deleteMany({ account: account._id }),
      this.credentialModel.deleteMany({ account: account._id }),
      this.deviceModel.deleteMany({ account: account._id }),
      this.referralModel.updateMany(
        {
          $or: [
            { referrerAccount: account._id },
            { referringAccount: account._id },
          ],
        },
        { $set: { visibility: EntityVisibility.Deleted } },
      ),
    ];

    const $hardDelete = [
      this.commentModel.deleteMany({ 'author._id': { $in: userIds } }),
      this.notificationModel.deleteMany({ account: account._id }),
      this.otpModel.deleteMany({ account: account._id }),
      this.socialSyncModel.deleteMany({ account: account._id }),
      this.feedItemModel.deleteMany({ author: account._id }),
      this.relationshipModel.deleteMany({
        $or: [{ followedUser: { $in: userIds } }, { user: { $in: userIds } }],
      }),
      this.revisionModel.deleteMany({ 'payload.author.id': { $in: userIds } }),
      this.uxEngagementModel.deleteMany({ account: account._id }),
    ];

    const $softDelete = [
      account.set({ visibility: EntityVisibility.Deleted }).save(),
      this.adsCampaignModel.updateMany(
        { owner: { $in: userIds } },
        { boostStatus: AdsBoostStatus.End },
      ),
      this.deleteContents({ 'author._id': { $in: userIds } }),
      this.deleteEngagements({ user: userIds }),
      this.queueModel.updateMany(
        { 'payload.to.account': account._id, status: QueueStatus.WAITING },
        { status: QueueStatus.CANCELLED, endedAt: new Date() },
      ),
      this.userModel.updateMany(
        { _id: { $in: userIds } },
        { visibility: EntityVisibility.Deleted },
      ),
    ];

    await Promise.all([...$v1Delete, ...$hardDelete, ...$softDelete]);

    if (account.referralBy) {
      await this.accountModel.updateOne(
        { _id: account.referralBy },
        { $inc: { referralCount: -1 } },
      );
    }
  }

  async deletePage(pageId: Types.ObjectId) {
    const session = await this.userModel.startSession();
    await session.withTransaction(async () => {
      await Promise.all([
        this.updateUser(
          { _id: String(pageId) },
          { visibility: EntityVisibility.Deleted },
          { session },
        ),
        this.relationshipModel.deleteMany({
          $or: [{ followedUser: pageId as any }, { user: pageId as any }],
        }),
        this.deleteContents({ 'author._id': pageId }),
        this.deleteEngagements({ user: pageId }),
        this.deleteComments({ 'author._id': pageId }, { session }),
        this.deleteFeedItems({ author: pageId }, { session }),
        this.deleteRevisions({ author: pageId }, { session }),
        this.deleteSocialSyncs({ 'author.id': pageId }, { session }),
        this.deleteNotifications({ user: pageId }, { session }),
      ]);
      await session.commitTransaction();
      session.endSession();
    });
  }
}
