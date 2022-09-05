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

import { connect, disconnect, model, Schema } from 'mongoose';
import { Model } from 'mongoose';
import { DBRef } from 'mongodb';
import { Types } from 'mongoose';

async function migrate() {
  const args = {} as Record<string, string>;

  process.argv.forEach((arg) => {
    const v = arg.match(/--(\w+)=(.+)/);
    if (v) args[v[1]] = v[2];
  });

  const dbName = args['dbName'] || 'test';
  const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
  await connect(url);
  const contentModel = model<any>(
    'Content',
    new Schema({
      visibility: 'string',
      engagements: {
        like: {
          count: 'number',
          refs: 'array',
        },
        comment: {
          count: 'number',
          refs: 'array',
        },
        recast: {
          count: 'number',
          refs: 'array',
        },
        quote: {
          count: 'number',
          refs: 'array',
        },
        farm: {
          count: 'number',
          refs: 'array',
        },
      },
    }),
  );

  const engagementModel = model<any>(
    'Engagement',
    new Schema({
      visibility: 'string',
      type: 'string',
      targetRef: 'object',
    }),
  );

  const commentModel = model<any>(
    'Comment',
    new Schema({
      visibility: 'string',
      type: 'string',
      message: 'string',
      targetRef: 'object',
    }),
  );

  await Promise.all([
    migrateEngagement(contentModel, engagementModel),
    migrateEngagementComment(contentModel, commentModel),
  ]);

  await disconnect();
}

async function migrateEngagement(contentModel: any, engagementModel: any) {
  for (let skip = 0, limit = 1000; ; skip += limit) {
    const contents = await contentModel
      .find({
        visibility: 'publish',
      })
      .skip(skip)
      .limit(limit);

    console.log(`migrateEngagement#contents length : ${contents.length}`);

    const $contents = contents.map(async (content, index) => {
      const [engagement] = await engagementModel.aggregate([
        {
          $match: {
            targetRef: new DBRef('content', new Types.ObjectId(content)),
            visibility: 'publish',
          },
        },
        {
          $project: {
            targetRef: '$targetRef',
            type: '$type',
          },
        },
        {
          $group: {
            _id: null,
            liked: { $sum: { $cond: [{ $eq: ['$type', 'like'] }, 1, 0] } },
            farmed: { $sum: { $cond: [{ $eq: ['$type', 'farm'] }, 1, 0] } },
          },
        },
      ]);

      content.engagements.like.count = engagement?.liked ?? 0;
      content.engagements.farm ??= {
        count: engagement?.farmed ?? 0,
        ref: [],
      };

      if (engagement) {
        content.markModified('engagements');
        await content.save();
        console.log(
          `migrateEngagement#content update :: ${JSON.stringify(
            engagement ?? {},
          )}`,
        );
      }
    });

    await Promise.all($contents);

    console.log('contents', { skip, limit, affected: contents.length });
    if (contents.length < limit) break;
  }
}

async function migrateEngagementComment(contentModel: any, commentModel: any) {
  for (let skip = 0, limit = 1000; ; skip += limit) {
    const contents = await contentModel
      .find({
        visibility: 'publish',
      })
      .skip(skip)
      .limit(limit);

    console.log(
      `migrateEngagementComment#contents length : ${contents.length}`,
    );

    const $contents = contents.map(async (content) => {
      const commentCount = await commentModel.countDocuments({
        'targetRef.$id': content._id,
        type: 'comment',
        visibility: 'publish',
      });

      if (commentCount) {
        console.log(`migrateEngagementComment#count : ${commentCount}`);

        content.engagements.comment.count = commentCount ?? 0;

        content.markModified('engagements');
        await content.save();
        console.log(
          `migrateEngagementComment#content update :: ${JSON.stringify(
            commentCount ?? {},
          )}`,
        );
      }
    });

    await Promise.all($contents);

    console.log('contents', { skip, limit, affected: contents.length });
    if (contents.length < limit) break;
  }
}

migrate().catch(console.error);
