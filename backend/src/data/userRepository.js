const { v4: uuidv4 } = require('uuid');

const users = [];

exports.findByEmail = (email) => {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase());
};

exports.findById = (id) => {
  return users.find((user) => user.id === id);
};

exports.create = ({ name, email, passwordHash, role, location }) => {
  const user = {
    id: uuidv4(),
    name,
    email,
    passwordHash,
    role,
    location,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  return user;
};