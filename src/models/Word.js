const mongoose = require('mongoose');

const definitionSchema = new mongoose.Schema(
  {
    partOfSpeech: { type: String, default: '' },
    definition: { type: String, required: true },
    examples: { type: [String], default: [] },
  },
  { _id: false }
);

const wordSchema = new mongoose.Schema(
  {
    word: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    definitions: {
      type: [definitionSchema],
      default: [],
    },
    source: {
      type: String,
      enum: ['wiktionary', 'larousse', 'lerobert', 'manual'],
      default: 'wiktionary',
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/**
 * Normalizes a word to ensure cache uniqueness.
 * - trim, lowercase, Unicode NFC normalization.
 */
wordSchema.statics.normalize = function (raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().normalize('NFC');
};

module.exports = mongoose.model('Word', wordSchema);
