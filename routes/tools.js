const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/tools")

router.get('/threads-video-downloader',controller.ThreadsVideoDownloader);
router.get('/twitter-video-downloader',controller.TwitterVideoDownloader);
router.get('/reddit-video-downloader',controller.getRedditVideo);
router.post('/twitter/download',controller.TwitterDownload);
router.get('/video/download',controller.videoDownload);
router.get('/reddit/video/download',controller.downloadRedditVideo);

module.exports = router;