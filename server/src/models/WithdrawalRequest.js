import mongoose from 'mongoose';

const withdrawalRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Montant de retrait requis'],
      min: [500, 'Le montant minimum de retrait est de 500 FCFA'],
    },
    method: {
      type: String,
      enum: ['mtn_mobile_money', 'orange_money'],
      required: true,
      default: 'mtn_mobile_money',
    },
    phone: {
      type: String,
      required: [true, 'Numéro Mobile Money requis'],
      trim: true,
    },
    accountHolder: {
      type: String,
      required: [true, 'Nom du titulaire du compte requis'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: {
      type: String,
      default: '',
    },
    processedAt: {
      type: Date,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

withdrawalRequestSchema.index({ createdAt: -1 });

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

export default WithdrawalRequest;
