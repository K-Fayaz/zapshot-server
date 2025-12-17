const mongoose = require("mongoose");

const MONGO_URL = process.env.MONGO_URL;

mongoose.connect(MONGO_URL)
    .then(()=>{
        // console.log("url: ",MONGO_URL);
        console.log("Connected to DB ");
    })
    .catch((err)=>{
        console.log("Error while connecting to DB");
        console.log(err); 
    })