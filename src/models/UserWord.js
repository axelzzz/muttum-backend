const mongoose = require('mongoose');

const userWordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Word',
      required: true,
      index: true,
    },
    firstSearchedAt: {
      type: Date,
      default: Date.now,
    },
    lastSearchedAt: {
      type: Date,
      default: Date.now,
    },
    searchCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    notes: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    tags: {
      type: [String],
      default: [],
    },
    favorite: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userWordSchema.index({ userId: 1, wordId: 1 }, { unique: true });

module.exports = mongoose.model('UserWord', userWordSchema);
