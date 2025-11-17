import { SSEConnectionType, Market } from '../infra/types.js';
import { buildSecid } from '../utils/utils.js';
import { getRandomServer, generateCnameHash } from '../utils/sse-utils.js';

/**
 * SSE URL builder for different connection types
 */
export class SSEUrlBuilder {
  /**
   * Build SSE URL based on connection type
   */
  static buildUrl(
    type: SSEConnectionType,
    code: string,
    market: Market,
    utToken: string
  ): string {
    const secid = buildSecid(market, code);
    const server = getRandomServer();

    switch (type) {
      case SSEConnectionType.QUOTE:
        return this.buildQuoteUrl(server, secid, utToken);
      case SSEConnectionType.TREND:
        return this.buildTrendUrl(server, secid, utToken);
      case SSEConnectionType.DETAIL:
        return this.buildDetailUrl(server, secid, utToken);
      case SSEConnectionType.NEWS:
        return this.buildNewsUrl(server);
      default:
        throw new Error(`Unsupported SSE connection type: ${type}`);
    }
  }

  /**
   * Build quote SSE URL
   */
  private static buildQuoteUrl(server: number, secid: string, utToken: string): string {
    const fields = 'f58,f734,f107,f57,f43,f59,f169,f301,f60,f170,f152,f177,f111,f46,f44,f45,f47,f260,f48,f261,f279,f277,f278,f288,f19,f17,f531,f15,f13,f11,f20,f18,f16,f14,f12,f39,f37,f35,f33,f31,f40,f38,f36,f34,f32,f211,f212,f213,f214,f215,f210,f209,f208,f207,f206,f161,f49,f171,f50,f86,f84,f85,f168,f108,f116,f167,f164,f162,f163,f92,f71,f117,f292,f51,f52,f191,f192,f262,f294,f181,f295,f269,f270,f256,f257,f285,f286,f748,f747';
    const params = new URLSearchParams({
      fields,
      mpi: '1000',
      invt: '2',
      fltt: '1',
      secid,
      ut: utToken,
      dect: '1',
      wbp2u: '|0|0|0|web',
    });
    return `https://${server}.push2.eastmoney.com/api/qt/stock/sse?${params.toString()}`;
  }

  /**
   * Build trend SSE URL
   */
  private static buildTrendUrl(server: number, secid: string, utToken: string): string {
    const params = new URLSearchParams({
      fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f17',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
      mpi: '1000',
      ut: utToken,
      secid,
      ndays: '1',
      iscr: '0',
      iscca: '0',
      wbp2u: '|0|0|0|web',
    });
    return `https://${server}.push2.eastmoney.com/api/qt/stock/trends2/sse?${params.toString()}`;
  }

  /**
   * Build detail SSE URL
   */
  private static buildDetailUrl(server: number, secid: string, utToken: string): string {
    const params = new URLSearchParams({
      fields1: 'f1,f2,f3,f4',
      fields2: 'f51,f52,f53,f54,f55',
      mpi: '1000',
      dect: '1',
      ut: utToken,
      fltt: '2',
      pos: '-11',
      secid,
      wbp2u: '|0|0|0|web',
    });
    return `https://${server}.push2.eastmoney.com/api/qt/stock/details/sse?${params.toString()}`;
  }

  /**
   * Build news SSE URL
   */
  private static buildNewsUrl(server: number): string {
    const cname = generateCnameHash();
    const params = new URLSearchParams({
      cb: 'icomet_cb_0',
      cname,
      seq: '0',
      noop: '0',
      token: '',
      _: Date.now().toString(),
    });
    return `https://${server}.newspush.eastmoney.com/sse?${params.toString()}`;
  }
}

