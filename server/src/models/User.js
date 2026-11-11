import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationCode: String,
    verificationCodeExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    subscription: {
      plan: {
        type: String,
        default: 'free',
      },
      status: {
        type: String,
        enum: ['active', 'expired', 'cancelled'],
        default: 'active',
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      endDate: Date,
      scansPerMonth: {
        type: Number,
        default: 5,
      },
      scansUsed: {
        type: Number,
        default: 0,
      },
      lastResetDate: {
        type: Date,
        default: Date.now,
      },
      renewalCount: {
        type: Number,
        default: 0,
      },
      lastRenewedAt: {
        type: Date,
        default: null,
      },
      isRenewed: {
        type: Boolean,
        default: false,
      },
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    // Referral / Parrainage System
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    referral: {
      enabled: { type: Boolean, default: false }, // Activated by Admin
      commissionRate: { type: Number, default: 20 }, // 20%
      balance: { type: Number, default: 0 }, // Solde disponible en FCFA
      totalEarned: { type: Number, default: 0 },
      totalWithdrawn: { type: Number, default: 0 },
    },

    // VIP Partnership Program (Accès à vie + Commission mensuelle configurable)
    partnership: {
      isActive: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['none', 'pending_form', 'active', 'excluded', 'disabled'],
        default: 'none',
      },
      joinedAt: { type: Date, default: null },
      lifetimeAccess: { type: Boolean, default: false },
      formSubmitted: { type: Boolean, default: false },
      formSubmittedAt: { type: Date, default: null },
      fullName: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      paymentRef: { type: String, default: '' },
      paidAmount: { type: Number, default: 0 },
      balance: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      totalWithdrawn: { type: Number, default: 0 },
      lastAffiliateAt: { type: Date, default: null },
      excludedReason: { type: String, default: '' },
      excludedAt: { type: Date, default: null },
    },

    // Anti-Abuse device & IP tracking
    registrationIp: { type: String, default: '' },
    deviceFingerprint: { type: String, default: '' },

    // Free-trial tracking (per-user custom days, expiration & anti-abuse)
    trial: {
      startedAt: Date,
      endsAt: Date,
      days: { type: Number, default: 0 },
      appliedFor: String, // plan id the trial was applied to
      isActive: { type: Boolean, default: false },
      isUsed: { type: Boolean, default: false },
    },

    // Trading preferences — personalize AI Trading Assistant responses.
    preferences: {
      level: {
        type: String,
        enum: ['beginner', 'intermediate', 'expert'],
        default: 'intermediate',
      },
      // Favorite methodology (can be any system, admin, or custom strategy key).
      favoriteStrategy: {
        type: String,
        default: 'smc',
      },
      customStrategyName: { type: String, default: '' },
      customStrategy: { type: String, default: '' }, // injected into the AI prompt and robot scanner
      customTradingPlan: { type: String, default: '' }, // detailed personal trading plan & execution guidelines
      favoriteSession: { type: String, default: 'London' }, // target trading session
      opportunityEmailAlerts: { type: Boolean, default: true }, // receive high-probability setups by email when active
      minOpportunityConfidence: { type: Number, min: 70, max: 100, default: 80 }, // filter for email dispatch
      riskPercent: { type: Number, min: 0.1, max: 100, default: 1 },
      minRiskReward: { type: Number, min: 0.5, max: 20, default: 2 }, // e.g. 3 → require 1:3
      favoriteMarkets: { type: [String], default: [] }, // ['forex','crypto',...] or symbols
      favoriteTimeframes: { type: [String], default: [] }, // ['H1','H4']
      language: { type: String, enum: ['fr', 'en'], default: 'fr' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes (email already indexed via `unique: true` on the field)
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ registrationIp: 1 });
userSchema.index({ deviceFingerprint: 1 });

// Virtual: scans remaining this month (all plans are unlimited)
userSchema.virtual('subscription.scansRemaining').get(function () {
  return Infinity;
});

// Hash password and ensure referral code before saving
userSchema.pre('save', async function (next) {
  if (!this.referralCode) {
    this.referralCode = (this.firstName ? this.firstName.slice(0, 3).toUpperCase() : 'TRD') + crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check and reset monthly scans if needed
userSchema.methods.checkAndResetMonthlyScans = function () {
  const now = new Date();
  const lastReset = this.subscription.lastResetDate;
  const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

  if (daysSinceReset >= 30) {
    this.subscription.scansUsed = 0;
    this.subscription.lastResetDate = now;
    return true;
  }
  return false;
};

// Check if user can scan (unlimited scans on all active accounts, lifetime partners and trials)
userSchema.methods.canScan = function () {
  if (this.role === 'admin') return true;

  // Active VIP Partner with lifetime access
  if (this.partnership?.isActive && this.partnership?.status === 'active' && this.partnership?.lifetimeAccess) {
    return true;
  }

  // Active free trial
  if (this.trial?.isActive && this.trial?.endsAt && new Date() < new Date(this.trial.endsAt)) {
    return true;
  }

  // Active paid or free plan
  return this.subscription?.status === 'active';
};

// Increment scan count for tracking
userSchema.methods.useScan = async function () {
  this.subscription.scansUsed = (this.subscription.scansUsed || 0) + 1;
  await this.save();
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verificationToken;
  delete obj.verificationCode;
  delete obj.verificationCodeExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.__v;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
