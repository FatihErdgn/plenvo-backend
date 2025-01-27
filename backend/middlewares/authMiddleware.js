// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");

exports.authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer token
  if (!token) {
    return res.status(401).json({ success: false, message: "Token gerekli." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // JWT’den gelen user bilgilerini req.user içine koy
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ success: false, message: "Geçersiz token." });
  }
};
