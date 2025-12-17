const mongoose = require("mongoose");
const { type } = require("os");
const { string } = require("zod");
const { Schema } = mongoose;

const userSchema = new Schema({
    username:{
        type:String,
        required: true
    },
    email:{
        type:String,
        required: true
    },
    password:{
        type:String,
        required: false
    },
    profilePhoto: {
        type:String,
        required: false
    },
    subscription: {
        type: String,
        enum: ["free", "premium"],
        default: "free",
    },
    plan: {
        type: String,
        enum: ["free", "basic", "pro"],
        default: "free"
    },
    credits: {
        type: Number,
        default: 5,
    }
});

const User = mongoose.model("User",userSchema);
module.exports = User;