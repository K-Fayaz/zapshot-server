const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const SECRET = process.env.SECRET;

const isAuthenticated = async (req,res,next)=>{
    try{
        const { authorization } = req.headers;

        if (!authorization || !authorization.startsWith('Bearer ')) {
            return res.status(401).json({ status: false,message:"You need to login first" });
        }

        const token = authorization.split(' ')[1];

        let isValid = jwt.verify(token,SECRET);

        if (!isValid){
            console.log("Invalid")
            return res.status(401).json({ status: false,message:"You need to login first" });
        }

        // Proceed with next operation
        next();

    }
    catch(err){
        console.log("error: ",err.message);
        console.log("Name: ",err.name);

        if (err.name === "TokenExpiredError" || err.name == "JsonWebTokenError") {
            return res.status(401).json({ status: false, message: "Session expired. Please login again." });
        }

        res.status(500).json({
            status: false,
            message:err.message || "Something went wrong"
        })
    }
}

module.exports = isAuthenticated;