const jwt = require('jsonwebtoken');
const config = require('../config');

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expire,
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpire,
  });
};

module.exports = { generateAccessToken, generateRefreshToken };
