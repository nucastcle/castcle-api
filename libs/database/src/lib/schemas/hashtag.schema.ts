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

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HashtagPayloadDto } from '../dtos/hashtag.dto';
import { SearchHashtagResponseDto } from '../dtos/search.dto';
import { CastcleBase } from './base.schema';

@Schema({ timestamps: true })
class HashtagDocument extends CastcleBase {
  @Prop({ required: true, index: true })
  tag: string;

  @Prop({ required: true })
  score: number;

  @Prop({ required: true, type: Object })
  aggregator: any;

  @Prop()
  name: string;
}

export const HashtagSchema = SchemaFactory.createForClass(HashtagDocument);

export class Hashtag extends HashtagDocument {
  toHashtagPayload: () => HashtagPayloadDto;
  toSearchTopTrendhPayload: (index: number) => SearchHashtagResponseDto;
  toSearchPayload: () => SearchHashtagResponseDto;
}

HashtagSchema.methods.toHashtagPayload = function () {
  return {
    id: this._id,
    slug: this.tag,
    name: this.name,
    key: 'hashtag.castcle',
  } as HashtagPayloadDto;
};

HashtagSchema.methods.toSearchTopTrendhPayload = function (index) {
  return {
    rank: index + 1,
    id: this._id,
    slug: this.tag,
    name: this.name,
    key: 'hashtag.castcle',
    count: this.score,
    // TODO !!! need implement trends
    trends: 'up',
  } as SearchHashtagResponseDto;
};

HashtagSchema.methods.toSearchPayload = function () {
  return {
    id: this._id,
    slug: this.tag,
    name: this.name,
    key: 'hashtag.castcle',
    // TODO !!! need implement isTrending
    isTrending: true,
  } as SearchHashtagResponseDto;
};
