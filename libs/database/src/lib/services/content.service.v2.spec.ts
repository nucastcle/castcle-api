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
import { NotificationServiceV2 } from './notification.service.v2';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  ContentServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
} from '../database.module';
import { ContentType, NotificationType } from '../dtos';
import {
  generateMockUsers,
  MockUserDetail,
  mockContents,
  mockDeposit,
} from '../mocks';
import { ContentFarmingStatus, QueueName, WalletType } from '../models';
import { Content, ContentFarming } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UserService } from './user.service';
import { TAccountService } from './taccount.service';

describe('ContentServiceV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: ContentServiceV2;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userService: UserService;
  let taccountService: TAccountService;
  let content: Content;
  let mocksUsers: MockUserDetail[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        AuthenticationService,
        ContentServiceV2,
        ContentService,
        HashtagService,
        UserService,
        NotificationService,
        NotificationServiceV2,
        TAccountService,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    authService = app.get(AuthenticationService);
    contentService = app.get(ContentService);
    service = app.get(ContentServiceV2);
    userService = app.get(UserService);
    taccountService = app.get(TAccountService);

    mocksUsers = await generateMockUsers(3, 0, {
      userService: userService,
      accountService: authService,
    });

    const user = mocksUsers[0].user;
    content = await contentService.createContentFromUser(user, {
      payload: { message: 'content v2' },
      type: ContentType.Short,
      castcleId: user.displayId,
    });
  });

  describe('#likeCast()', () => {
    it('should create like cast.', async () => {
      await service.likeCast(
        content,
        mocksUsers[1].user,
        mocksUsers[1].account
      );
      const engagement = await (service as any)._engagementModel.findOne({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'content',
          $id: content._id,
        },
      });
      expect(engagement).toBeTruthy();
      expect(String(engagement.user)).toEqual(String(mocksUsers[1].user._id));
      expect(String(engagement.targetRef.oid)).toEqual(String(content._id));
      expect(engagement.type).toEqual(NotificationType.Like);
    });
  });
  describe('#unlikeCast()', () => {
    it('should delete unlike cast.', async () => {
      await service.unlikeCast(content._id, mocksUsers[1].user);
      const engagement = await (service as any)._engagementModel.findOne({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'content',
          $id: content._id,
        },
      });
      expect(engagement).toBeNull();
    });
  });
  describe('Farming', () => {
    let mockFarmingUsers: MockUserDetail[];
    let testContents: Content[] = [];
    const initialBalance = 1000;
    const expectedBalances = [
      950, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250,
      200, 150, 100, 50, 0,
    ];
    beforeAll(async () => {
      mockFarmingUsers = await generateMockUsers(3, 1, {
        accountService: authService,
        userService,
      });
      //user 0 create a content
      const user = mockFarmingUsers[0].user;
      testContents = await mockContents(user, (service as any).contentModel, {
        amount: 21,
        type: ContentType.Short,
      });

      //top up user 1 for 1000 CAST
      await mockDeposit(
        mockFarmingUsers[1].account,
        initialBalance,
        taccountService._transactionModel
      );
      const balance = await taccountService.getAccountBalance(
        mockFarmingUsers[1].account.id,
        WalletType.PERSONAL
      );
      expect(balance).toEqual(initialBalance);

      //mocksUsers[1]
    });
    describe('#createContentFarming', () => {
      let contentFarming: ContentFarming;
      beforeAll(async () => {
        expect(await taccountService._transactionModel.count()).toEqual(1);
        contentFarming = await service.createContentFarming(
          testContents[0].id,
          mockFarmingUsers[1].account.id
        );
        expect(await taccountService._transactionModel.count()).toEqual(2);
      });
      it('should be able to create content farming instance if have balance > 5% total', async () => {
        expect(String(contentFarming.content)).toEqual(testContents[0].id);
        expect(String(contentFarming.account)).toEqual(
          mockFarmingUsers[1].account.id
        );
        expect(contentFarming.status).toEqual(ContentFarmingStatus.Farming);
      });
      it('should have 95% balance of %initialBalance', async () => {
        const currentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].account.id,
          WalletType.PERSONAL
        );
        expect(currentBalance).toEqual(0.95 * initialBalance);
      });
      it('should spend 5% each until it can\t spend it', async () => {
        for (let i = 1; i < testContents.length - 1; i++) {
          await service.createContentFarming(
            testContents[i].id,
            mockFarmingUsers[1].account.id
          );
          const currentBalance = await taccountService.getAccountBalance(
            mockFarmingUsers[1].account.id,
            WalletType.PERSONAL
          );
          expect(currentBalance).toEqual(expectedBalances[i]);
        }
        //do this time expected error
      });
    });

    describe('#unfarm', () => {
      it('should get balance back once unfarm and the farm status of that should be farmed', async () => {
        const currentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].account.id,
          WalletType.PERSONAL
        );
        const unfarmResult = await service.unfarm(
          testContents[0].id,
          mockFarmingUsers[1].account.id
        );
        const afterBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].account.id,
          WalletType.PERSONAL
        );
        expect(afterBalance).toEqual(unfarmResult.farmAmount + currentBalance);
        const recentContentFarming = await service.getContentFarming(
          testContents[0].id,
          mockFarmingUsers[1].account.id
        );
        expect(recentContentFarming.status).toEqual(
          ContentFarmingStatus.Farmed
        );
      });
    });
    describe('#updateContentFarming', () => {
      it('should change status from farmed to farming', async () => {
        const currentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].account.id,
          WalletType.PERSONAL
        );
        const recentContentFarming = await service.getContentFarming(
          testContents[0].id,
          mockFarmingUsers[1].account.id
        );
        const updateFarmingResult = await service.updateContentFarming(
          recentContentFarming
        );
        expect(updateFarmingResult.status).toEqual(
          ContentFarmingStatus.Farming
        );
        const recentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].account.id,
          WalletType.PERSONAL
        );
        expect(currentBalance).not.toEqual(recentBalance);
        expect(recentBalance).toEqual(
          currentBalance - updateFarmingResult.farmAmount
        );
      });
    });

    describe('#expire', () => {
      it('should return all tokens to users and all status should be farmed', async () => {
        const currentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].account.id,
          WalletType.PERSONAL
        );
        expect(currentBalance).toEqual(0);
        let start = 0;
        for (let i = 0; i < testContents.length - 1; i++) {
          const unfarmResult = await service.expireFarm(
            testContents[i].id,
            mockFarmingUsers[1].account.id
          );
          start += unfarmResult.farmAmount;
          const recentBalance = await taccountService.getAccountBalance(
            mockFarmingUsers[1].account.id,
            WalletType.PERSONAL
          );
          expect(recentBalance).toEqual(currentBalance + start);
        }
        const latestBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].account.id,
          WalletType.PERSONAL
        );
        expect(latestBalance).toEqual(initialBalance);
      });
    });

    describe('#farm', () => {
      let finalTestContents: Content[] = [];
      beforeAll(async () => {
        const user = mockFarmingUsers[0].user;
        finalTestContents = await mockContents(
          user,
          (service as any).contentModel,
          { amount: 21, type: ContentType.Short }
        );
      });
      it('should create new contentFarming if not yet create', async () => {
        for (let i = 0; i < finalTestContents.length - 1; i++) {
          await service.farm(
            finalTestContents[i].id,
            mockFarmingUsers[1].account.id
          );
          const currentBalance = await taccountService.getAccountBalance(
            mockFarmingUsers[1].account.id,
            WalletType.PERSONAL
          );
          expect(currentBalance).toEqual(expectedBalances[i]);
        }
        const recentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].account.id,
          WalletType.PERSONAL
        );
        expect(recentBalance).toEqual(0);
      });
    });
  });
  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });
});
