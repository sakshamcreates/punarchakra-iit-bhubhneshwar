const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../data/userRepository');

const allowedRoles = [
  'consumer',
  'kabadiwala',
  'business',
  'repair_shop',
  'recycler',
  'admin'
];

const jwtSecret = process.env.JWT_SECRET || 'supersecretkey';
const jwtExpiry = '2h';

exports.register = async ({ name, email, password, role, location }) => {
  if (!name || !email || !password || !role || !location) {
    const error = new Error('Missing required fields');
    error.status = 400;
    throw error;
  }

  if (!allowedRoles.includes(role)) {
    const error = new Error('Invalid role');
    error.status = 400;
    throw error;
  }

  const existingUser = userRepository.findByEmail(email);
  if (existingUser) {
    const error = new Error('User already exists');
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = userRepository.create({ name, email, passwordHash, role, location });
  return user;
};

exports.login = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.status = 400;
    throw error;
  }

  const user = userRepository.findByEmail(email);
  if (!user) {
    const error = new Error('Invalid credentials');
    error.status = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    const error = new Error('Invalid credentials');
    error.status = 401;
    throw error;
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    jwtSecret,
    { expiresIn: jwtExpiry }
  );

  return { user, token };
};

exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (err) {
    const error = new Error('Invalid or expired token');
    error.status = 401;
    throw error;
  }
};