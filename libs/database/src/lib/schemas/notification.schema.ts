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
import { Configs } from '@castcle-api/environments';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';
import {
  NotificationPayloadDto,
  NotificationSource,
  NotificationType,
} from '../dtos/notification.dto';
import { Account } from './account.schema';
import { CastcleBase } from './base.schema';
import { User } from './user.schema';
import { Image } from '@castcle-api/utils/aws';
@Schema({ timestamps: true })
class NotificationDocument extends CastcleBase {
  @Prop({ required: true, type: String, index: true })
  source: NotificationSource;

  @Prop({
    required: true,
    type: [SchemaTypes.ObjectId],
    ref: 'User',
    index: true,
  })
  sourceUserId: Types.ObjectId[];

  @Prop({ required: true, type: String, index: true })
  type: NotificationType;

  @Prop({ type: SchemaTypes.ObjectId, index: true })
  contentRef: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, index: true })
  commentRef: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, index: true })
  replyRef: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, index: true })
  adsRef: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, index: true })
  profileRef: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, index: true })
  systemRef: Types.ObjectId;

  @Prop({ index: true })
  read: boolean;

  @Prop({
    required: true,
    type: SchemaTypes.ObjectId,
    ref: 'Account',
    index: true,
  })
  account: Account;
}

type NotifyResponseOption = {
  message: string;
  user?: User;
  isDate?: boolean;
};

export const NotificationSchema =
  SchemaFactory.createForClass(NotificationDocument);

export class Notification extends NotificationDocument {
  toNotificationPayload: (
    option: NotifyResponseOption
  ) => NotificationPayloadDto;
}

NotificationSchema.methods.toNotificationPayload = function ({
  message,
  user,
  isDate = false,
}: NotifyResponseOption) {
  return {
    id: this._id,
    notifyId: this._id,
    source: this.source,
    message,
    read: this.read,
    avatar: user
      ? user?.profile && user?.profile?.images && user?.profile?.images?.avatar
        ? new Image(user.profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages
      : undefined,
    commentId: this.commentRef,
    contentId: this.contentRef,
    replyId: this.replyRef,
    advertiseId: this.adsRef,
    profileId: this.profileRef,
    systemId: this.systemRef,
    createdAt: isDate ? this.createdAt : undefined,
    updatedAt: isDate ? this.updatedAt : undefined,
  } as NotificationPayloadDto;
};
