const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

userSchema.virtual('password').set(function (plain) {
  this._password = plain;
});

userSchema.pre('validate', async function (next) {
  if (this._password) {
    this.passwordHash = await bcrypt.hash(this._password, config.bcrypt.saltRounds);
    this._password = undefined;
  }
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
