// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");

exports.authMiddleware = (req, res, next) => {
  // header yerine cookie'den:
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ success: false, message: "Token gerekli." });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).json({ success: false, message: "Geçersiz token." });
  }
};
