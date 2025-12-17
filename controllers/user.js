const jwt  = require("jsonwebtoken");
const User = require("../models/User");


const getUserDetails = async(req,res) => {
    try {   
        const { authorization } = req.headers;
        const token = authorization.split(' ')[1];

        let payload = jwt.decode(token);

        let user = await User.findById(payload.id);

        if (!user) {
            return res.status(404).json({
                status: false,
                message:"User not found"
            });
        }
        
        return res.status(200).json({
            status: true,
            username: user.username,
            profile: user.profilePhoto,
            type: user.subscription,
            credits: user.credits,
        });
    }
    catch(err){
        console.log(err);
        return res.status(200).json({
            status: false,
            message:"Something went wrong!"
        });
    }
}

const fakePostDownload = async(req,res) => {
    try {
        const { authorization } = req.headers;
        const token = authorization.split(' ')[1];

        let payload = jwt.decode(token);

        let user = await User.findById(payload.id);

        if (!user) {
            return res.status(404).json({
                status: false,
                message:"User not found"
            });
        }

        if (user.credits > 0) {
            user.credits -= 1;
            await user.save();
            return res.status(200).json({
                status: true,
                message:"OK"
            });
        }

        res.status(400).json({
            status: false,
            message:"Buy credits to download"
        });
    }
    catch(err) {
        console.log(err);
        return res.status(500).json({
            status: false,
            message:"Something went wrong!"
        });
    }
}

module.exports = {
    getUserDetails,
    fakePostDownload
}