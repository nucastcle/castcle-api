import { CampaignType } from '@castcle-api/database';
import { CastcleException } from '@castcle-api/utils/exception';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { CastcleBackofficeSchemas, CastcleDatabaseReadonly } from '../schemas';
import { CampaignService } from './campaign.service';

describe('Campaign', () => {
  let service: CampaignService;
  let mongod: MongoMemoryReplSet;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CastcleDatabaseReadonly,
        CastcleBackofficeSchemas,
      ],
      providers: [CampaignService],
    }).compile();

    service = moduleRef.get<CampaignService>(CampaignService);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Manage Campaign', () => {
    it('should return empty when campaign not exist', async () => {
      const staffs = await service.getCampaigns();
      expect(staffs).toHaveLength(0);
    });

    it('should be create campaign', async () => {
      await expect(
        service.createCampaign({
          name: 'testCampaign',
          type: CampaignType.VERIFY_MOBILE,
          totalRewards: 2000,
          rewardBalance: 2000,
          rewardsPerClaim: 1,
          startDate: new Date(),
          endDate: new Date(),
        }),
      ).resolves.toBeUndefined();
    });

    it('should be return campaign type is exist', async () => {
      await expect(
        service.createCampaign({
          name: 'testCampaign',
          type: CampaignType.VERIFY_MOBILE,
          totalRewards: 2000,
          rewardBalance: 2000,
          rewardsPerClaim: 1,
          startDate: new Date(),
          endDate: new Date(),
        }),
      ).rejects.toEqual(new CastcleException('CAMPAIGN_TYPE_IS_EXIST'));
    });

    it('should be update campaign', async () => {
      const campaign = await service.getCampaigns();
      await expect(
        service.updateCampaign(campaign[0].id, {
          name: 'testCampaign2',
          startDate: new Date(),
          endDate: new Date(),
        }),
      ).resolves.toBeUndefined();
    });

    it('should be return campaign type is exist', async () => {
      await expect(
        service.updateCampaign('618cc797c1a2b319dff12095', {
          name: 'testCampaign2',
          startDate: new Date(),
          endDate: new Date(),
        }),
      ).rejects.toEqual(new CastcleException('CAMPAIGN_NOT_FOUND'));
    });
  });
});
