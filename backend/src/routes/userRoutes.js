const express = require('express');
const { getUser, getProfile } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/user', authMiddleware, getUser);
router.get('/profile', authMiddleware, getProfile);

module.exports = router;
