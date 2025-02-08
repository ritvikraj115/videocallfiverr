const jwt = require('jsonwebtoken');  // Assuming JWT is used

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token

    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, "your_secret_key"); // Replace with your actual secret key
        req.user = decoded; // Attach user data to request
        next();
    } catch (error) {
        return res.status(403).json({ error: "Invalid token." });
    }
};

module.exports = verifyToken;
