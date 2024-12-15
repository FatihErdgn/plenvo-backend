const User = require('../models/User');

// Yeni kullanıcı oluşturma
const createUser = async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const user = await User.create({ username, password, role });
        res.status(201).json({ message: 'Kullanıcı başarıyla oluşturuldu.', user });
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.', error });
    }
};

// Tüm kullanıcıları listeleme
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Şifreyi döndürme
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.', error });
    }
};

// Kullanıcı silme
const deleteUser = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findByIdAndDelete(userId);

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        res.status(200).json({ message: 'Kullanıcı başarıyla silindi.' });
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.', error });
    }
};

module.exports = { createUser, getAllUsers, deleteUser };
