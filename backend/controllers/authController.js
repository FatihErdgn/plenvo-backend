const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Kullanıcı giriş işlemi
const loginUser = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Şifre hatalı.' });
        }

        // JWT token oluştur
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        res.status(200).json({ token, role: user.role });
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.', error });
    }
};

module.exports = { loginUser };
