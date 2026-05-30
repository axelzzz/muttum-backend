const User = require('../../src/models/User');
const { sign } = require('../../src/utils/jwt');

async function createUser(overrides = {}) {
  const data = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
    ...overrides,
  };
  const user = new User({ email: data.email, username: data.username });
  user.password = data.password;
  await user.save();
  return user;
}

function buildToken(user) {
  return sign({ sub: user._id.toString(), email: user.email });
}

async function createUserAndToken(overrides = {}) {
  const user = await createUser(overrides);
  const token = buildToken(user);
  return { user, token };
}

module.exports = { createUser, buildToken, createUserAndToken };
