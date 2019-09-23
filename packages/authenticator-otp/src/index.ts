import { DatabaseInterface } from '@accounts/types';
import { AccountsServer } from '@accounts/server';
import * as otplib from 'otplib';

interface AuthenticatorService {
  server: any;
  serviceName: string;
  setStore(store: DatabaseInterface): void;
  associate(userId: string, params: any): Promise<any>;
  authenticate(authenticatorId: string, params: any): Promise<boolean>;
  // TODO ability to delete an authenticator
}

export interface AuthenticatorOtpOptions {
  /**
   * Two factor app name that will be displayed inside the user authenticator app.
   */
  appName?: string;

  /**
   * Two factor user name that will be displayed inside the user authenticator app.
   * Will be called every time a user register a new device.
   */
  userName?: (userId: string) => Promise<string> | string;
}

const defaultOptions = {
  appName: 'accounts-js',
};

export class AuthenticatorOtp implements AuthenticatorService {
  public serviceName = 'otp';
  public server!: AccountsServer;

  private options: AuthenticatorOtpOptions & typeof defaultOptions;
  private db!: DatabaseInterface;

  constructor(options: AuthenticatorOtpOptions = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  public setStore(store: DatabaseInterface) {
    this.db = store;
  }

  /**
   * Start the association of a new OTP device
   */
  public async associate(userId: string, params: any) {
    const secret = otplib.authenticator.generateSecret();
    const userName = this.options.userName ? await this.options.userName(userId) : userId;
    const otpauthUri = otplib.authenticator.keyuri(userName, this.options.appName, secret);
    // TODO generate some recovery codes like slack is doing?

    const authenticatorId = await this.db.createAuthenticator({
      type: this.serviceName,
      userId,
      secret,
    });

    return {
      id: authenticatorId,
      secret,
      otpauthUri,
    };
  }

  /**
   * Verify that the code provided by the user is valid
   */
  public async authenticate(authenticatorId: string, { code }: { code?: string }) {
    if (!code) {
      throw new Error('Code required');
    }

    // Should this be in accounts-js server before calling authenticate?
    const authenticator: any = await this.db.findAuthenticatorById(authenticatorId);
    if (!authenticator || authenticator.type !== this.serviceName) {
      throw new Error('Authenticator not found');
    }

    return otplib.authenticator.check(code, authenticator.secret);
  }
}