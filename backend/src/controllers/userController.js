exports.getUser = (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  return res.json({
    success: true,
    data: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      location: req.user.location,
      createdAt: req.user.createdAt
    },
    message: 'User retrieved successfully'
  });
};

exports.getProfile = (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  return res.json({
    success: true,
    data: {
      profile: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        location: req.user.location,
        createdAt: req.user.createdAt
      }
    },
    message: 'Profile retrieved successfully'
  });
};