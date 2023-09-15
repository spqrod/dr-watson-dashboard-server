const jwt = require("jsonwebtoken");

function checkAccessLevel (req, res, next) {
    const token = req.cookies["token"];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, data) => {
        if (error) return res.sendStatus(403);
        if (data.accessLevel !== "director" ) return res.sendStatus(403);
        next();
    });
}

module.exports = checkAccessLevel;