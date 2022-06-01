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

import { QueueName, UserService, UserMessage } from '@castcle-api/database';
import { CastcleQueueAction } from '@castcle-api/database';
import { CastLogger } from '@castcle-api/logger';
import { Processor, Process } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';

@Injectable()
@Processor(QueueName.USER)
export class UserConsumer {
  private logger = new CastLogger(UserConsumer.name);

  constructor(private userService: UserService) {}

  @Process()
  async readOperationJob(job: Job<UserMessage>) {
    try {
      this.logger.log(`consume user message '${JSON.stringify(job.data)}' `);

      if (job.data.action === CastcleQueueAction.UpdateProfile) {
        this.userService.updateUserInEmbedContentBackground(job.data.id);
        this.logger.log(`Updating profile of user ${job.data.id}`);
      }
    } catch (error) {
      this.logger.error(error);
    }
  }
}
