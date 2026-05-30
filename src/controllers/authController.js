const User = require('../models/User');
const { sign } = require('../utils/jwt');

async function register(req, res, next) {
  try {
    const { email, username, password } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = new User({ email, username });
    user.password = password;
    await user.save();

    const token = sign({ sub: user._id.toString(), email: user.email });
    return res.status(201).json({ user: user.toJSON(), token });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = sign({ sub: user._id.toString(), email: user.email });
    return res.json({ user: user.toJSON(), token });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: user.toJSON() });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, me };
