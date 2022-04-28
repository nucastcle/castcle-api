import * as request from 'supertest';
import { feedsApp } from '../variables';

export class CommentRequest {
  static headers = {
    'Accept-Language': 'en',
    'Accept-Version': '1.0',
    Device: 'CastclePhone',
    Platform: 'CastcleOS',
  };

  static request = (method: string, url: string): request.Test =>
    request(feedsApp.getHttpServer())[method](url).set(CommentRequest.headers);

  static delete = (url: string) => CommentRequest.request('delete', url);
  static get = (url: string) => CommentRequest.request('get', url);
  static patch = (url: string) => CommentRequest.request('patch', url);
  static post = (url: string) => CommentRequest.request('post', url);
  static put = (url: string) => CommentRequest.request('put', url);

  static getCommentFromContent = (contentId: string) =>
    CommentRequest.get(`/v2/contents/${contentId}/comments`);
  static getReplyComment = (contentId: string, sourceCommentId: string) =>
    CommentRequest.get(
      `/v2/contents/${contentId}/comments/${sourceCommentId}/reply`
    );
}
