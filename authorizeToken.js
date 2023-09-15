const jwt = require("jsonwebtoken");

function authorizeToken (req, res, next) {
    const token = req.cookies["token"];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error) => {
        if (error) return res.sendStatus(403);
        next();
    });
}

module.exports = authorizeToken;