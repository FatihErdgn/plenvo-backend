const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer token formatında bekliyoruz

    if (!token) {
        return res.status(401).json({ message: 'Yetkilendirme başarısız.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Token içeriğini request'e ekle
        next();
    } catch (error) {
        res.status(401).json({ message: 'Geçersiz token.' });
    }
};

const authorize = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Bu işlemi gerçekleştirmek için yetkiniz yok.' });
    }
    next();
};

module.exports = { protect, authorize };
