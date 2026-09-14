const authService = require('../services/authService');

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, location } = req.body;
    const user = await authService.register({ name, email, password, role, location });

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        createdAt: user.createdAt
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login({ email, password });

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          location: user.location,
          createdAt: user.createdAt
        }
      },
      message: 'Login successful'
    });
  } catch (error) {
    next(error);
  }
};