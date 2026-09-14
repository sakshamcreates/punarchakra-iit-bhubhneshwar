const authService = require('../services/authService');
const userRepository = require('../data/userRepository');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Authorization header missing or malformed');
      error.status = 401;
      throw error;
    }

    const token = authHeader.split(' ')[1];
    const payload = authService.verifyToken(token);
    const user = userRepository.findById(payload.id);
    if (!user) {
      const error = new Error('User not found');
      error.status = 401;
      throw error;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};