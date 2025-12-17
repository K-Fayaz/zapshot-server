const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/user");
const isLoggedIn = require("../middleware/isLoggedIn");

router.get('/get',isLoggedIn,controller.getUserDetails);

router.post('/fake-post-download', isLoggedIn, controller.fakePostDownload);

module.exports = router;