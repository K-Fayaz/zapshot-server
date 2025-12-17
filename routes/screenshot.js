const express = require("express");
const router = express.Router();
const conntroller = require("../controllers/screenshots");

router.post("/screenshots",conntroller.getDetails);

module.exports = router;