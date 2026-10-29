import mongoose from 'mongoose';
import { encrypt, decrypt } from '../services/settings/crypto.js';

/**
 * Broker account connection credentials and state.
 *
 * Security rules:
 * - Sensitive tokens/secrets are ALWAYS encrypted using AES-256-GCM via encrypt().
 * - Secrets are NEVER exposed in toJSON / toObject output to prevent leaks to the client.
 * - Explicitly tracks permission scopes ('read' vs 'trade').
 */

const brokerAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    broker: {
      type: String,
      enum: ['deriv', 'binance', 'metaapi_mt5', 'paper'],
      required: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    accountId: {
      type: String,
      required: true,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['demo', 'real', 'paper'],
      default: 'demo',
    },
    authType: {
      type: String,
      enum: ['api_token', 'oauth', 'api_key_secret'],
      default: 'api_token',
    },
    // AES-256-GCM Encrypted Token (hidden by default)
    encryptedToken: {
      type: String,
      required: true,
      select: false,
    },
    // Optional encrypted API Secret for brokers like Binance
    encryptedSecret: {
      type: String,
      default: '',
      select: false,
    },
    // Distinct permissions verified from broker response
    permissions: {
      type: [String],
      enum: ['read', 'trade', 'admin', 'payments'],
      default: ['read'],
    },
    isTradeAuthorized: {
      type: Boolean,
      default: false,
      index: true,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    equity: {
      type: Number,
      default: 0,
    },
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'error', 'expired', 'invalid_permissions'],
      default: 'disconnected',
      index: true,
    },
    lastConnectedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.encryptedToken;
        delete ret.encryptedSecret;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.encryptedToken;
        delete ret.encryptedSecret;
        return ret;
      },
    },
  }
);

brokerAccountSchema.index({ userId: 1, broker: 1, accountId: 1 }, { unique: true });

// Methods to safely store and retrieve credentials
brokerAccountSchema.methods.setToken = function (token) {
  this.encryptedToken = encrypt(token);
};

brokerAccountSchema.methods.getToken = function () {
  return decrypt(this.encryptedToken);
};

brokerAccountSchema.methods.setSecret = function (secret) {
  this.encryptedSecret = encrypt(secret);
};

brokerAccountSchema.methods.getSecret = function () {
  return decrypt(this.encryptedSecret);
};

const BrokerAccount = mongoose.model('BrokerAccount', brokerAccountSchema);

export default BrokerAccount;
