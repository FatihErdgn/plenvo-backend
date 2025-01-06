const express = require('express');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { createUser, getAllUsers, deleteUser } = require('../controllers/adminController');

const router = express.Router();

router.post('/create', protect, authorize('admin'), createUser);
router.get('/users', protect, authorize('admin'), getAllUsers);
router.delete('/users/:userId', protect, authorize('admin'), deleteUser);

module.exports = router;
